import type { HoudiniClient } from '.'
import type { Cache } from '../cache/cache'
import type { Layer } from '../cache/storage'
import type { ConfigFile } from '../lib/config'
import { getCurrentConfig } from '../lib/config'
import { deepEquals } from '../lib/deepEquals'
import { marshalInputs } from '../lib/scalars'
import { Writable } from '../lib/store'
import type {
	DocumentArtifact,
	QueryResult,
	GraphQLObject,
	QueryArtifact,
	SubscriptionSpec,
	CachePolicies,
	GraphQLVariables,
} from '../lib/types'
import { ArtifactKind } from '../lib/types'
import { cachePolicy } from './plugins'

// the list of states to step in what direction
const steps = {
	forward: ['start', 'beforeNetwork', 'network'],
	backwards: ['end', 'afterNetwork'],
} as const

export class DocumentStore<
	_Data extends GraphQLObject,
	_Input extends GraphQLVariables
> extends Writable<QueryResult<_Data, _Input>> {
	readonly artifact: DocumentArtifact
	#client: HoudiniClient | null
	#configFile: ConfigFile

	// the list of instantiated plugins
	#plugins: ClientHooks[]

	// we need to track the last set of variables used so we can
	// detect if they have changed
	#lastVariables: Record<string, any> | null

	// we need the last context value we've seen in order to pass it during cleanup
	#lastContext: ClientPluginContext | null = null

	// a reference to the earliest resolving open promise that the store has sent
	pendingPromise: { then: (val: any) => void } | null = null

	serverSideFallback?: boolean

	constructor({
		artifact,
		plugins,
		pipeline,
		client,
		cache,
		enableCache = true,
		initialValue,
		initialVariables,
		fetching,
	}: {
		artifact: DocumentArtifact
		plugins?: ClientHooks[]
		pipeline?: ClientHooks[]
		client: HoudiniClient | null
		cache?: Cache
		enableCache?: boolean
		initialValue?: _Data | null
		fetching?: boolean
		serverSideFallback?: boolean
		initialVariables?: _Input
	}) {
		// if fetching is set, respect the value
		// if fetching is not set, we should default fetching on queries and not on the rest.
		fetching ??= artifact.kind === ArtifactKind.Query

		// the initial store state
		const initialState: QueryResult<_Data, _Input> = {
			data: initialValue ?? null,
			errors: null,
			partial: false,
			stale: false,
			source: null,
			fetching,
			variables: initialVariables ?? null,
		}

		super(initialState, () => {
			// unsubscribing from the store means walking down all of the plugins and calling
			// cleanup
			return () => {
				this.#lastVariables = null
				this.cleanup()
			}
		})
		this.artifact = artifact
		this.#client = client
		this.#lastVariables = null
		this.#configFile = getCurrentConfig()

		this.#plugins = pipeline ?? [
			// cache policy needs to always come first so that it can be the first fetch_enter to fire
			cachePolicy({
				cache,
				enabled: enableCache,
				setFetching: (fetching, data) => {
					this.update((state) => {
						const newState = { ...state, fetching }

						// when we set the fetching state to true, we should also generate the appropriate
						// loading state for the document
						if (fetching && data) {
							newState.data = data
						}

						return newState
					})
				},
			})() as ClientHooks,
			...(plugins ?? []),
		]
	}

	// used by the client to send a new set of variables to the pipeline
	async send({
		metadata,
		session,
		fetch = globalThis.fetch,
		variables,
		policy,
		stuff,
		cacheParams,
		setup = false,
		silenceEcho = false,
	}: SendParams = {}) {
		// start off with the initial context
		let context = new ClientPluginContextWrapper({
			config: this.#configFile!,
			name: this.artifact.name,
			text: this.artifact.raw,
			hash: this.artifact.hash,
			policy: policy ?? (this.artifact as QueryArtifact).policy,
			variables: null,
			metadata,
			session,
			fetch,
			stuff: {
				inputs: {
					changed: false,
					init: false,
					marshaled: {},
				},
				...stuff,
			},
			artifact: this.artifact,
			lastVariables: this.#lastVariables,
			cacheParams,
		})

		// assign variables to take advantage of the setter on variables
		const draft = context.draft()
		draft.variables = variables ?? null
		context = context.apply(draft, false)

		// walk through the plugins to get the first result
		const promise = new Promise<QueryResult<_Data, _Input>>((resolve, reject) => {
			// the initial state of the iterator
			const state: IteratorState = {
				setup,
				currentStep: 0,
				index: 0,
				silenceEcho,
				promise: {
					resolved: false,
					resolve,
					reject,
					then: (...args) => promise.then(...args),
				},
				// patch the context with new variables
				context,
			}

			if (this.pendingPromise === null) {
				this.pendingPromise = state.promise
			}

			// start walking down the chain
			this.#step('forward', state)
		})

		return await promise
	}

	async cleanup() {
		for (const plugin of this.#plugins) {
			plugin.cleanup?.(this.#lastContext!)
		}
	}

	#step(direction: 'error', ctx: IteratorState, value: unknown): void
	#step(direction: 'backwards', ctx: IteratorState, value: QueryResult): void
	#step(direction: 'forward', ctx: IteratorState, value?: never): void
	#step(direction: keyof typeof steps | 'error', ctx: IteratorState, value?: any): void {
		// grab the current step
		const hook = direction === 'error' ? 'catch' : steps[direction][ctx.currentStep]

		// figure out which direction we want to go (starting from the specified index)
		let valid = (i: number) => i <= this.#plugins.length
		let step = (i: number) => i + 1
		if (['backwards', 'error'].includes(direction)) {
			valid = (i) => i >= 0
			step = (i) => i - 1
		}

		// walk down the list of plugins
		for (let index = ctx.index; valid(index); index = step(index)) {
			// if we found a handle
			let target = this.#plugins[index]?.[hook]
			if (!target) {
				continue
			}

			// create a new draft
			const draft = ctx.context.draft()

			// detect changes in the variables from the user using object identity
			let variablesRefChanged = (newContext: ClientPluginContext) =>
				newContext.variables !== draft.variables

			// the common handlers
			const common = {
				initialValue: this.state,
				client: this.#client,
				variablesChanged,
				marshalVariables,
				updateState: this.update.bind(this),
				next: (newContext) => {
					// the next index depends on the direction we're going now
					const nextIndex = ['forward', 'error'].includes(direction)
						? // if we're going forward, add one
						  index + 1
						: // if we're moving backwards but called next, we
						  // we need to invoke the same hook
						  index

					// if we are resolving the pipe and fire next, we need to start
					// from the first phase
					const nextStep = ['backwards', 'error'].includes(direction)
						? 0
						: ctx.currentStep

					// move on
					this.#step('forward', {
						...ctx,
						index: nextIndex,
						currentStep: nextStep,
						context: ctx.context.apply(newContext, variablesRefChanged(newContext)),
					})
				},
				resolve: (newContext, value) => {
					// the next index depends on the direction we're going now
					const nextIndex =
						direction === 'backwards'
							? // if we're going backwards, subtract one
							  index - 1
							: // if we're moving forwards but then call resolve
							  // we need to visit the same hook
							  index

					// move on
					this.#step(
						'backwards',
						{
							...ctx,
							index: nextIndex,
							context: ctx.context.apply(newContext, variablesRefChanged(newContext)),
						},
						value
					)
				},
			} as ClientPluginEnterHandlers

			// build up the specific handlers for the direction
			let handlers
			if (direction === 'forward') {
				handlers = common
			} else if (direction === 'backwards') {
				handlers = {
					...common,
					value: value!,
					resolve: ((ctx, data) => {
						return common.resolve(ctx, data ?? value!)
					}) as ClientPluginExitHandlers['resolve'],
				}
			} else if (direction === 'error') {
				handlers = {
					...common,
					error: value,
				}
			}

			try {
				// @ts-expect-error
				// invoke the target with the correct handlers
				const result = target(draft, handlers)

				// if we got _something_ back its a promise so we need to make
				// sure something is listening for error
				result?.catch((err) => {
					this.#step('error', { ...ctx, index: index - 1 }, err)
				})
			} catch (err) {
				// if an exception was thrown it was a synchronous hook so catch the exception
				this.#step('error', { ...ctx, index: index - 1 }, err)
			}

			return
		}

		/// if we got this far, we are at one of the bounds
		/// we're need to move onto the next phase
		/// or we are at the end of the pipeline so we need to resolve
		/// or there is no call to resolve in the enter hooks so we need to catch

		// check forward end conditions
		if (direction === 'forward') {
			// if we triggering a setup cycle phase
			if (ctx.setup) {
				return this.#step(
					'backwards',
					{
						...ctx,
						currentStep: 0,
						index: this.#plugins.length,
					},
					this.state
				)
			}

			// if we still have steps to go forward, do so
			if (ctx.currentStep <= steps.forward.length - 2) {
				return this.#step('forward', {
					...ctx,
					currentStep: ctx.currentStep + 1,
					index: 0,
				})
			}

			// we're at the end of the chain in the last phase. something is wrong.
			throw new Error(
				'Called next() on last possible plugin. Your chain is missing a plugin that calls resolve().'
			)
		}

		// we could be propagating an error up
		if (direction === 'error') {
			// if we got here, we have bubbled up to the last handler
			// see if we still need to resolve the promise
			if (!ctx.promise.resolved) {
				ctx.promise.reject(value)

				// make sure we dont do anything else to the promise
				ctx.promise.resolved = true
			}

			return
		}

		// if we aren't at the last phase then we have more to go
		if (ctx.currentStep > 0) {
			return this.#step(
				'backwards',
				{
					...ctx,
					currentStep: ctx.currentStep - 1,
					index: this.#plugins.length - 1,
				},
				value!
			)
		}

		// don't update the store if the final value is partial and we aren't supposed to send one back, don't update anything
		if (!ctx.silenceEcho || value.data !== this.state.data) {
			// the latest value should be written to the store
			this.set(value)
		}

		// if the promise hasn't been resolved yet, do it
		if (!ctx.promise.resolved) {
			ctx.promise.resolve(value)

			// make sure we dont resolve it again
			ctx.promise.resolved = true
		}

		this.#lastContext = ctx.context.draft()
		this.#lastVariables = this.#lastContext.stuff.inputs.marshaled
	}
}

// the context is built out of a class so we can easily hide fields from the
// object that we don't want users to access
class ClientPluginContextWrapper {
	// separate the last variables from what we pass to the user
	#context: ClientPluginContext
	#lastVariables: Record<string, any> | null
	constructor({
		lastVariables,
		...values
	}: ClientPluginContext & {
		lastVariables: Required<ClientPluginContext>['variables'] | null
	}) {
		this.#context = values
		this.#lastVariables = lastVariables
	}

	get variables() {
		return this.#context.variables
	}

	// draft produces a wrapper over the context so users can mutate it without
	// actually affecting the context values
	draft(): ClientPluginContext {
		// so there are some values
		const ctx = {
			...this.#context,
		}

		const applyVariables = this.applyVariables.bind(this)

		return {
			...ctx,
			get stuff() {
				return ctx.stuff
			},
			set stuff(val: any) {
				ctx.stuff = val
			},
			get variables() {
				return ctx.variables ?? null
			},
			set variables(val: Required<ClientPluginContext>['variables']) {
				Object.assign(ctx, applyVariables(ctx, { variables: val }))
			},
		}
	}

	applyVariables(source: ClientPluginContext, values: Partial<ClientPluginContext>) {
		const artifact = source.artifact

		// build up the new context
		const ctx = {
			...source,
			...values,
		}

		const val = values.variables

		// look at the variables for ones that are different
		let changed: ClientPluginContext['variables'] = {}
		for (const [name, value] of Object.entries(val ?? {})) {
			if (value !== source.variables?.[name]) {
				// we need to marshal the new value
				changed[name] = value
			}
		}

		// since we are mutating deeply nested values in stuff, we need to make sure we don't modify our parent
		ctx.stuff = {
			...ctx.stuff,
			inputs: {
				...ctx.stuff.inputs,
			},
		}

		// update the marshaled version of the inputs
		// - only update the values that changed (to re-marshal scalars)
		// - or if there are no values to begin with
		const firstInit = !ctx.stuff.inputs || !ctx.stuff.inputs.init
		const hasChanged = Object.keys(changed).length > 0 || firstInit
		if (hasChanged) {
			// only marshal the changed variables so we don't double marshal
			const newVariables = {
				...ctx.stuff.inputs?.marshaled,
				...marshalInputs({
					artifact,
					input: changed,
					config: source.config,
				}),
			}

			ctx.stuff.inputs = {
				init: true,
				marshaled: newVariables,
				changed: true,
			}

			// track the last variables used
			ctx.variables = val
		}

		ctx.stuff = {
			...ctx.stuff,
			inputs: {
				...ctx.stuff.inputs,
				changed: !deepEquals(ctx.stuff.inputs.marshaled, this.#lastVariables),
			},
		}
		return ctx
	}

	// apply applies the draft value in a new context
	apply(values: ClientPluginContext, newVariables: boolean): ClientPluginContextWrapper {
		// if we have a different set of variables
		if (newVariables) {
			values = this.applyVariables(this.#context, values)
		}
		// instantiate a new wrapper to use
		const wrapper = new ClientPluginContextWrapper({
			...values,
			lastVariables: this.#lastVariables,
		})

		return wrapper
	}
}

function marshalVariables<_Data extends GraphQLObject, _Input extends GraphQLVariables>(
	ctx: ClientPluginContext
) {
	return ctx.stuff.inputs?.marshaled ?? {}
}

function variablesChanged<_Data extends GraphQLObject, _Input extends GraphQLVariables>(
	ctx: ClientPluginContext
) {
	return ctx.stuff.inputs?.changed
}

type IteratorState = {
	context: ClientPluginContextWrapper
	index: number
	setup: boolean
	currentStep: number
	silenceEcho: boolean
	promise: {
		resolved: boolean
		resolve(val: any): void
		reject(val: any): void
		then(val: any): any
	}
}

export type ClientPlugin = () => ClientHooks | null | (ClientHooks | ClientPlugin | null)[]

export type ClientHooks = {
	start?: ClientPluginEnterPhase
	beforeNetwork?: ClientPluginEnterPhase
	network?: ClientPluginEnterPhase
	afterNetwork?: ClientPluginExitPhase
	end?: ClientPluginExitPhase
	cleanup?(ctx: ClientPluginContext): void | Promise<void>
	catch?(ctx: ClientPluginContext, args: ClientPluginErrorHandlers): void | Promise<void>
}

export type Fetch = typeof globalThis.fetch

export type ClientPluginContext = {
	config: ConfigFile
	name: string
	text: string
	hash: string
	artifact: DocumentArtifact
	policy?: CachePolicies
	fetch?: Fetch
	variables?: Record<string, any> | null
	metadata?: App.Metadata | null
	session?: App.Session | null
	fetchParams?: RequestInit
	cacheParams?: {
		layer?: Layer
		notifySubscribers?: SubscriptionSpec[]
		forceNotify?: boolean
		disableWrite?: boolean
		disableRead?: boolean
		disableSubscriptions?: boolean
		applyUpdates?: string[]
		serverSideFallback?: boolean
	}
	stuff: App.Stuff
}

type ClientPluginPhase<Handlers> = (
	ctx: ClientPluginContext,
	handlers: Handlers
) => void | Promise<void>

export type ClientPluginEnterPhase = ClientPluginPhase<ClientPluginEnterHandlers>
export type ClientPluginExitPhase = ClientPluginPhase<ClientPluginExitHandlers>

export type ClientPluginEnterHandlers = {
	/* The initial value of the query */
	initialValue: QueryResult
	/** A reference to the houdini client to access any configuration values */
	client: HoudiniClient
	/** Move onto the next step using the provided context.  */
	next(ctx: ClientPluginContext): void
	/** Terminate the current chain  */
	resolve(ctx: ClientPluginContext, data: QueryResult): void

	/** Update the stores state without resolving the promise */
	updateState(updater: (old: QueryResult) => QueryResult): void

	/** Return true if the variables have changed */
	variablesChanged: (ctx: ClientPluginContext) => boolean
	/** Returns the marshaled variables for the operation */
	marshalVariables: typeof marshalVariables
}

/** Exit handlers are the same as enter handles but don't need to resolve with a specific value */
export type ClientPluginExitHandlers = Omit<ClientPluginEnterHandlers, 'resolve'> & {
	resolve: (ctx: ClientPluginContext, data?: QueryResult) => void
	value: QueryResult
}

/** Exit handlers are the same as enter handles but don't need to resolve with a specific value */
export type ClientPluginErrorHandlers = ClientPluginEnterHandlers & {
	error: unknown
}

export type SendParams = {
	fetch?: Fetch
	variables?: Record<string, any> | null
	metadata?: App.Metadata | null
	session?: App.Session | null
	policy?: CachePolicies
	stuff?: Partial<App.Stuff>
	cacheParams?: ClientPluginContext['cacheParams']
	setup?: boolean
	silenceEcho?: boolean
}
