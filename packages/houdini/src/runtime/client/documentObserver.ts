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

// the list of states to step forward with
const forwardSteps = ['start', 'beforeNetwork', 'network'] as const
// the list of states to step backwards with
const backwardSteps = ['end', 'afterNetwork'] as const

export class DocumentObserver<
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
			fetching,
			partial: false,
			stale: false,
			source: null,
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
		stuff?: {}
		cacheParams?: ClientPluginContext['cacheParams']
		setup?: boolean
	} = {}): Promise<QueryResult<_Data, _Input>> {
		// start off with the initial context
		let context = new ClientPluginContextWrapper({
			config: this.#configFile!,
			policy: policy ?? (this.#artifact as QueryArtifact).policy,
			variables: {},
			metadata,
			session,
			fetch,
			stuff: stuff ?? {},
			artifact: this.#artifact,
			lastVariables: this.#lastVariables,
			cacheParams,
		})

		// assign variables to take advantage of the setter on variables
		const draft = context.draft()
		draft.variables = variables ?? {}
		context = context.apply(draft)

		// walk through the plugins to get the first result
		const result = await new Promise<QueryResult<_Data, _Input>>((resolve, reject) => {
			// the initial state of the iterator
			const state: IteratorState = {
				currentStep: 0,
				setup,
				index: -1,
				promise: {
					resolved: false,
					resolve,
					reject,
				},
				// patch the context with new variables
				context,
			}

			// start walking down the chain
			this.#next(state)
		})

		// we're done
		return result
	}

	#next(ctx: IteratorState): void {
		const currentStep = forwardSteps[ctx.currentStep]

		// look for the next plugin that defines an enter of the correct step
		for (let index = ctx.index + 1; index <= this.#plugins.length; index++) {
			let target = this.#plugins[index]?.[currentStep]
			if (target) {
				try {
					// invoke the target
					const result = target(ctx.context.draft(), {
						initialValue: this.state,
						client: this.#client,
						variablesChanged,
						marshalVariables,
						updateState: this.update.bind(this),
						next: (newContext) => {
							this.#next({
								...ctx,
								context: ctx.context.apply(newContext),
								index,
							})
						},
						resolve: (newContext, value) => {
							// start the journey back
							this.#terminate(
								{
									...ctx,
									context: ctx.context.apply(newContext),
									// increment the index so that terminate looks at this link again
									index: index + 1,
								},
								value
							)
						},
					})
					result?.catch((err) => {
						this.#error({ ...ctx, index }, err)
					})
				} catch (err) {
					this.#error({ ...ctx, index }, err)
				}
				return
			}
		}

		// if we got this far, we have exhausted the step

		// if we're only supposed to `setup` then turn around
		// and run the rest of the setup
		if (ctx.setup) {
			return this.#terminate(
				{
					...ctx,
					currentStep: 0,
					index: this.#plugins.length,
				},
				this.state
			)
		}

		// if we still have steps to go forward, do so
		if (ctx.currentStep <= forwardSteps.length - 2) {
			return this.#next({
				...ctx,
				currentStep: ctx.currentStep + 1,
				index: -1,
			})
		}

		// if we are in fetch, the last fetch enter called next. there's no terminating link for this
		// chain
		throw new Error(
			'Called next() on last possible plugin. Your chain is missing a terminating link.'
		)
	}

	#terminate(ctx: IteratorState, value: QueryResult): void {
		const currentStep = backwardSteps[ctx.currentStep]
		// starting one less than the current index
		for (let index = ctx.index - 1; index >= 0; index--) {
			// if the current step is never valid, we're done
			if (!currentStep) {
				break
			}

			// if we find a plugin in the same phase, call it
			let target = this.#plugins[index]?.[currentStep]
			if (target) {
				try {
					// invoke the target
					const result = target(ctx.context.draft(), {
						initialValue: this.state,
						value,
						client: this.#client,
						variablesChanged,
						marshalVariables,
						updateState: this.update.bind(this),
						next: (newContext) => {
							// push the ctx onto the next step
							this.#next({
								...ctx,
								index: index - 1,
								currentStep: 0,
								context: ctx.context.apply(newContext),
							})
						},
						resolve: (context, val) => {
							// be brave. take the next step.
							this.#terminate(
								{
									...ctx,
									context: ctx.context.apply(context),
									index,
								},
								// if we were given a value, use it. otherwise use the previous value
								val ?? value
							)
						},
					})
					result?.catch((err) => {
						this.#error({ ...ctx, index }, err)
					})
				} catch (err) {
					this.#error({ ...ctx, index }, err)
				}

				return
			}
		}

		// if we aren't at the last phase then we have more to go
		if (ctx.currentStep > 0) {
			return this.#terminate(
				{
					...ctx,
					currentStep: ctx.currentStep - 1,
					index: this.#plugins.length,
				},
				value
			)
		}

		// we're done with the chain

		// convert the raw value into something we can give to the user
		let data = value.data
		try {
			data =
				unmarshalSelection(this.#configFile!, this.#artifact.selection, value.data) ?? null
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

		this.#lastVariables = ctx.context.draft().stuff.inputs.marshaled
		this.#lastContext = ctx.context.draft()

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
			if (throwHandler) {
				throwHandler(ctx.context.draft(), {
					initialValue: this.state,
					client: this.#client,
					variablesChanged,
					marshalVariables,
					updateState: this.update.bind(this),
					// calling next in response to a
					next: (newContext) => {
						breakBubble = true

						this.#next({
							...ctx,
							context: ctx.context.apply(newContext),
							currentStep: 0,
							index: i,
						})

						// don't step through the rest of the errors
						propagate = false
					},
					error,
				})
			}

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

		const lastVariables = this.#lastVariables

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
				// look at the variables for ones that are different
				let changed: ClientPluginContext['variables'] = {}
				for (const [name, value] of Object.entries(val ?? {})) {
					if (value !== ctx.variables?.[name]) {
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
				const hasChanged =
					Object.keys(changed).length > 0 || !ctx.stuff.inputs || !ctx.stuff.inputs.init
				if (ctx.artifact.kind !== ArtifactKind.Fragment && hasChanged) {
					// only marshal the changed variables so we don't double marshal
					const newVariables = {
						...ctx.stuff.inputs?.marshaled,
						...marshalInputs({
							artifact: ctx.artifact,
							input: changed,
							config: ctx.config,
						}),
					}

					ctx.stuff.inputs = {
						init: true,
						marshaled: newVariables,
					}

					// track the last variables used
					ctx.variables = val
				}
				ctx.stuff = {
					...ctx.stuff,
					inputs: {
						...ctx.stuff.inputs,
						changed: !deepEquals(ctx.stuff.inputs.marshaled, lastVariables),
					},
				}
			},
		}
	}

	// apply applies the draft value in a new context
	apply(values: ClientPluginContext): ClientPluginContextWrapper {
		return new ClientPluginContextWrapper({
			...values,
			lastVariables: this.#lastVariables,
		})
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
	stuff: Record<string, any>
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
export type ClientPluginErrorHandlers = Omit<ClientPluginEnterHandlers, 'resolve'> & {
	error: unknown
}
