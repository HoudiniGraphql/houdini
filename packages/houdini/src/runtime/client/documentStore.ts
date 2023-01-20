import type { HoudiniClient } from '.'
import type { Layer } from '../cache/storage'
import type { ConfigFile } from '../lib/config'
import { getCurrentConfig } from '../lib/config'
import { deepEquals } from '../lib/deepEquals'
import { marshalInputs, unmarshalSelection } from '../lib/scalars'
import { Writable } from '../lib/store'
import type {
	CachePolicy,
	DocumentArtifact,
	QueryResult,
	GraphQLObject,
	QueryArtifact,
	SubscriptionSpec,
} from '../lib/types'
import { ArtifactKind } from '../lib/types'
import { cachePolicyPlugin } from './plugins'

// the list of states to step in what direction
const steps = {
	forward: ['start', 'beforeNetwork', 'network'],
	backwards: ['end', 'afterNetwork'],
} as const

export class DocumentStore<
	_Data extends GraphQLObject,
	_Input extends Record<string, any>
> extends Writable<QueryResult<_Data, _Input>> {
	#artifact: DocumentArtifact
	#client: HoudiniClient
	#configFile: ConfigFile

	// the list of instantiated plugins
	#plugins: ReturnType<ClientPlugin>[]

	// we need to track the last set of variables used so we can
	// detect if they have changed
	#lastVariables: Record<string, any> | null

	// we need the last context value we've seen in order to pass it during cleanup
	#lastContext: ClientPluginContext | null = null

	constructor({
		artifact,
		plugins,
		pipeline,
		client,
		cache = true,
		initialValue,
		fetching,
	}: {
		artifact: DocumentArtifact
		plugins?: ClientPlugin[]
		pipeline?: ClientPlugin[]
		client: HoudiniClient
		cache?: boolean
		initialValue?: _Data | null
		fetching?: boolean
	}) {
		// if fetching is set, respect the value
		// if fetching is not set, we should default fetching on queries and not on the rest.
		if (fetching === undefined) {
			fetching = artifact.kind === ArtifactKind.Query
		}

		// the initial store state
		const initialState: QueryResult<_Data, _Input> = {
			data: initialValue ?? null,
			errors: null,
			partial: false,
			source: null,
			fetching,
			variables: null,
		}

		super(initialState, () => {
			// unsubscribing from the store means walking down all of the plugins and calling
			// cleanup
			return () => {
				this.#lastVariables = null
				for (const plugin of this.#plugins) {
					plugin.cleanup?.(this.#lastContext!)
				}
			}
		})
		this.#artifact = artifact
		this.#client = client
		this.#lastVariables = null
		this.#configFile = getCurrentConfig()

		this.#plugins = (
			pipeline ?? [
				// cache policy needs to always come first so that it can be the first fetch_enter to fire
				cachePolicyPlugin({
					enabled: cache,
					setFetching: (fetching: boolean) =>
						this.update((state) => ({ ...state, fetching })),
				}),
				...(plugins ?? []),
			]
		).map((factory) => factory())
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
	}: {
		fetch?: Fetch
		variables?: Record<string, any> | null
		metadata?: App.Metadata | null
		session?: App.Session | null
		policy?: CachePolicy
		stuff?: Partial<App.Stuff>
		cacheParams?: ClientPluginContext['cacheParams']
		setup?: boolean
	} = {}) {
		// start off with the initial context
		let context = new ClientPluginContextWrapper({
			config: this.#configFile!,
			text: this.#artifact.raw,
			policy: policy ?? (this.#artifact as QueryArtifact).policy,
			variables: {},
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
			artifact: this.#artifact,
			lastVariables: this.#lastVariables,
			cacheParams,
		})

		// assign variables to take advantage of the setter on variables
		const draft = context.draft()
		draft.variables = variables ?? {}
		context = context.apply(draft, false)

		// walk through the plugins to get the first result
		return await new Promise<QueryResult<_Data, _Input>>((resolve, reject) => {
			// the initial state of the iterator
			const state: IteratorState = {
				setup,
				currentStep: 0,
				index: 0,
				promise: {
					resolved: false,
					resolve,
					reject,
				},
				// patch the context with new variables
				context,
			}

			// start walking down the chain
			this.#step('forward', state)
		})
	}

	#step(direction: 'backwards', ctx: IteratorState, value: QueryResult): void
	#step(direction: 'forward', ctx: IteratorState, value?: never): void
	#step(direction: keyof typeof steps, ctx: IteratorState, value?: QueryResult): void {
		// grab the current step
		const currentStep = steps[direction][ctx.currentStep]

		// figure out which direction we want to go (starting from the specified index)
		let valid = (i: number) => i <= this.#plugins.length
		let step = (i: number) => i + 1
		if (direction === 'backwards') {
			valid = (i) => i >= 0
			step = (i) => i - 1
		}

		// walk down the list of plugins
		for (let index = ctx.index; valid(index); index = step(index)) {
			// if we found a handle
			let target = this.#plugins[index]?.[currentStep]
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
					const nextIndex =
						direction === 'forward'
							? // if we're going forward, add one
							  index + 1
							: // if we're moving backwards but called next, we
							  // we need to invoke the same hook
							  index

					// if we are resolving the pipe and fire next, we need to start
					// from the first phase
					const nextStep = direction === 'backwards' ? 0 : ctx.currentStep

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

			const handlers = (steps.forward as readonly string[]).includes(currentStep)
				? // enter handlers
				  common
				: // exit handlers need slightly different values
				  {
						...common,
						value: value!,
						resolve: ((ctx, data) => {
							return common.resolve(ctx, data ?? value!)
						}) as ClientPluginExitHandlers['resolve'],
				  }

			try {
				// @ts-expect-error
				// invoke the target with the correct handlers
				const result = target(draft, handlers)

				// if we got _something_ back its a promise so we need to make
				// sure something is listening for error
				result?.catch((err) => {
					this.#error({ ...ctx, index }, err)
				})
			} catch (err) {
				// if an exception was thrown it was a synchronous hook so catch the exception
				this.#error({ ...ctx, index }, err)
			}

			return
		}

		/// if we got this far, we are at one of the bounds
		/// we're need to move onto the next phase
		/// or we are at the end of the pipeline so we need to resolve
		/// or there is no call to resolve in the enter hooks so we need to throw

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

		// convert the raw value into something we can give to the user
		let data = value!.data
		try {
			data = unmarshalSelection(this.#configFile!, this.#artifact.selection, data) ?? null
		} catch {}

		// build up the final state
		const finalValue = {
			...value,
			data,
		} as QueryResult<_Data, _Input>

		// if the promise hasn't been resolved yet, do it
		if (!ctx.promise.resolved) {
			ctx.promise.resolve(finalValue)

			// make sure we dont resolve it again
			ctx.promise.resolved = true
		}

		this.#lastContext = ctx.context.draft()
		this.#lastVariables = this.#lastContext.stuff.inputs.marshaled

		// the latest value should be written to the store
		this.set(finalValue)
	}

	#error(ctx: IteratorState, error: unknown) {
		// propagating an error up only visits plugins that come before the
		// current
		let propagate = true
		for (let i = ctx.index; i >= 0 && propagate; i--) {
			let breakBubble = false
			// if the step has an error handler, invoke it
			const throwHandler = this.#plugins[i].throw
			if (!throwHandler) {
				continue
			}

			const draft = ctx.context.draft()
			const variablesRefChanged = (newContext: ClientPluginContext) =>
				draft.variables !== newContext.variables

			throwHandler(draft, {
				initialValue: this.state,
				client: this.#client,
				variablesChanged,
				marshalVariables,
				updateState: this.update.bind(this),
				next: (newContext) => {
					breakBubble = true

					this.#step('forward', {
						...ctx,
						context: ctx.context.apply(newContext, variablesRefChanged(newContext)),
						currentStep: 0,
						index: i + 1,
					})

					// don't step through the rest of the errors
					propagate = false
				},
				resolve: (newContext, data) => {
					breakBubble = true

					this.#step(
						'backwards',
						{
							...ctx,
							context: ctx.context.apply(newContext, variablesRefChanged(newContext)),
							currentStep: 0,
							index: i + 1,
						},
						data
					)

					// don't step through the rest of the errors
					propagate = false
				},
				error,
			})

			if (breakBubble) {
				break
			}
		}

		// if propagate is still true, we've gone through everything without "breaking"
		if (propagate) {
			// if the promise hasn't been resolved yet, reject it
			if (!ctx.promise.resolved) {
				ctx.promise.reject(error)

				// make sure we dont do anything else to the promise
				ctx.promise.resolved = true
			}
		}
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
				return ctx.variables ?? {}
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
		if (artifact.kind !== ArtifactKind.Fragment && hasChanged) {
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

function marshalVariables<_Data extends GraphQLObject, _Input extends {}>(
	ctx: ClientPluginContext
) {
	return ctx.stuff.inputs?.marshaled ?? {}
}

function variablesChanged<_Data extends GraphQLObject, _Input extends {}>(
	ctx: ClientPluginContext
) {
	return ctx.stuff.inputs?.changed
}

type IteratorState = {
	context: ClientPluginContextWrapper
	index: number
	setup: boolean
	currentStep: number
	promise: {
		resolved: boolean
		resolve(val: any): void
		reject(val: any): void
	}
}

export type ClientPlugin = () => {
	start?: ClientPluginEnterPhase
	beforeNetwork?: ClientPluginEnterPhase
	network?: ClientPluginEnterPhase
	afterNetwork?: ClientPluginExitPhase
	end?: ClientPluginExitPhase
	cleanup?(ctx: ClientPluginContext): void | Promise<void>
	throw?(ctx: ClientPluginContext, args: ClientPluginErrorHandlers): void | Promise<void>
}

export type Fetch = typeof globalThis.fetch

export type ClientPluginContext = {
	config: ConfigFile
	text: string
	artifact: DocumentArtifact
	policy?: CachePolicy
	fetch?: Fetch
	variables?: Record<string, any>
	metadata?: App.Metadata | null
	session?: App.Session | null
	fetchParams?: RequestInit
	cacheParams?: {
		layer?: Layer
		notifySubscribers?: SubscriptionSpec[]
		forceNotify?: boolean
		disableWrite?: boolean
		disableRead?: boolean
		applyUpdates?: boolean
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
