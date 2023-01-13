import type { HoudiniClient } from '.'
import { Layer } from '../cache/storage'
import {
	ArtifactKind,
	CachePolicy,
	ConfigFile,
	deepEquals,
	DocumentArtifact,
	QueryResult,
	getCurrentConfig,
	GraphQLObject,
	marshalInputs,
	QueryArtifact,
	SubscriptionSpec,
	unmarshalSelection,
	App,
} from '../lib'
import { Writable } from '../lib/store'
import { cachePolicyPlugin } from './plugins'

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

	constructor({
		artifact,
		plugins,
		client,
		cache = true,
		initialValue,
	}: {
		artifact: DocumentArtifact
		plugins: ClientPlugin[]
		client: HoudiniClient
		cache?: boolean
		initialValue?: _Data | null
	}) {
		// the initial store state
		const initialState: QueryResult<_Data, _Input> = {
			data: initialValue ?? null,
			errors: [],
			partial: false,
			source: null,
			fetching: false,
			variables: null,
		}

		super(initialState, () => {
			// unsubscribing from the store means walking down all of the plugins and calling
			// cleanup
			return () => {
				for (const plugin of this.#plugins) {
					plugin.cleanup?.()
				}
			}
		})
		this.#artifact = artifact
		this.#client = client
		this.#lastVariables = null
		this.#configFile = getCurrentConfig()

		this.#plugins = [
			// cache policy needs to always come first so that it can be the first fetch_enter to fire
			cachePolicyPlugin(cache, (fetching: boolean) =>
				this.update((state) => ({ ...state, fetching }))
			)(),
		].concat(plugins.map((factory) => factory()))
	}

	// used by the client to send a new set of variables to the pipeline
	async send({
		metadata,
		session,
		fetch = globalThis.fetch,
		variables,
		policy,
		stuff,
	}: {
		variables?: Record<string, any> | null
		metadata?: App.Metadata | null
		fetch?: Fetch
		session?: App.Session | null
		policy?: CachePolicy
		stuff?: {}
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
		})

		// assign variables to take advantage of the setter on variables
		const draft = context.draft()
		draft.variables = variables ?? {}
		context = context.apply(draft)

		// walk through the plugins to get the first result
		const result = await new Promise<QueryResult<_Data, _Input>>((resolve, reject) => {
			// the initial state of the iterator
			const state: IteratorState = {
				value: null,
				terminatingIndex: null,
				currentStep: 'setup',
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

		// if there are errors, we might need to throw
		if (result.errors && result.errors.length > 0 && this.#configFile.quietErrors) {
			// convert the artifact kind into the matching error pattern
			const whichKind = {
				[ArtifactKind.Mutation]: 'mutation',
				[ArtifactKind.Query]: 'query',
				[ArtifactKind.Fragment]: 'fragment',
				[ArtifactKind.Subscription]: 'subscription',
			}[this.#artifact.kind]

			// we're only going to throw if we're not quieting the error
			if (!(this.#configFile.quietErrors as string[]).includes(whichKind)) {
				throw result.errors
			}
		}

		// we're done
		return result
	}

	#next(ctx: IteratorState): void {
		// look for the next plugin that defines an enter of the correct step
		for (let index = ctx.index + 1; index <= this.#plugins.length; index++) {
			let target = this.#plugins[index]?.[ctx.currentStep]?.enter
			if (target) {
				try {
					// invoke the target
					const result = target(ctx.context.draft(), {
						initialValue: this.state,
						client: this.#client,
						variablesChanged,
						marshalVariables,
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
									// save this value
									value,
									// increment the index so that terminate looks at this link again
									// when we flip phases, we need to start from here
									terminatingIndex: index + 1,
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

		// if we got this far, we have exhausted the step.

		// if we are still in setup, flip over to fetch and start over
		if (ctx.currentStep === 'setup') {
			return this.#next({
				...ctx,
				currentStep: 'network',
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
		// starting one less than the current index
		for (let index = ctx.index - 1; index >= 0; index--) {
			// if we find a plugin in the same phase, call it
			let target = this.#plugins[index]?.[ctx.currentStep]?.exit
			if (target) {
				try {
					// invoke the target
					const result = target(ctx.context.draft(), {
						initialValue: this.state,
						value,
						client: this.#client,
						variablesChanged,
						marshalVariables,
						next: (newContext) => {
							// push the ctx onto the next step
							this.#next({
								...ctx,
								index: index - 1,
								currentStep: 'setup',
								context: ctx.context.apply(newContext),
							})
						},
						resolve: (context, val) => {
							// if we were given a value, use it. otherwise use the previous value
							const newValue = typeof val !== 'undefined' ? val : ctx.value

							// be brave. take the next step.
							this.#terminate(
								{
									...ctx,
									context: ctx.context.apply(context),
									value: newValue,
									index,
								},
								newValue
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

		// if we're done with the fetch step, we need to start the setup phase of the termination flow
		if (ctx.currentStep === 'network') {
			return this.#terminate(
				{
					...ctx,
					currentStep: 'setup',
					index: ctx.terminatingIndex || this.#plugins.length,
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

		// the latest value should be written to the store
		this.update((state) => ({
			...state,
			...finalValue,
		}))
	}

	#error(ctx: IteratorState, error: unknown) {
		// propagating an error up only visits plugins that come before the
		// current
		let propagate = true
		for (let i = ctx.index; i >= 0 && propagate; i--) {
			let breakBubble = false
			// if the step has an error handler, invoke it
			const errorHandler = this.#plugins[i].throw
			if (errorHandler) {
				errorHandler(ctx.context.draft(), {
					initialValue: this.state,
					client: this.#client,
					variablesChanged,
					marshalVariables,
					// calling next in response to a
					next: (newContext) => {
						breakBubble = true

						this.#next({
							...ctx,
							context: ctx.context.apply(newContext),
							currentStep: 'setup',
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

/**
 * A network plugin has 2 primary entry points to modify the pipeline.
 * - phaseOne happens before the request is potentially cached
 * - phaseTwo happens when a request has not been cached and needs to be resolved from the api
 */
export type ClientPlugin =
	// the second function lets a plugin setup for a particular observer chain
	() => {
		setup?: ClientPluginPhase
		network?: ClientPluginPhase
		cleanup?(): any
		// throw is called when a plugin after this raises an exception
		throw?(ctx: ClientPluginContext, args: ClientPluginErrorHandlers): void | Promise<void>
	}

type IteratorState = {
	context: ClientPluginContextWrapper
	index: number
	value: any
	terminatingIndex: number | null
	currentStep: 'network' | 'setup'
	promise: {
		resolved: boolean
		resolve(val: any): void
		reject(val: any): void
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

export type Fetch = typeof globalThis.fetch

export type ClientPluginContext<_Data extends GraphQLObject = GraphQLObject> = {
	config: ConfigFile
	artifact: DocumentArtifact
	policy?: CachePolicy
	fetch?: Fetch
	variables?: Record<string, any>
	// @ts-ignore
	metadata?: App.Metadata | null
	// @ts-ignore
	session?: App.Session | null
	fetchParams?: RequestInit
	cacheParams?: {
		layer?: Layer
		notifySubscribers?: SubscriptionSpec[]
		forceNotify?: boolean
		disableWrite?: boolean
		disableRead?: boolean
	}
	stuff: Record<string, any>
}

/** ClientPlugin describes the logic of the HoudiniClient plugin at a particular stage. */
export type ClientPluginPhase = {
	// enter is called when an artifact is pushed through
	enter?(ctx: ClientPluginContext, handlers: ClientPluginHandlers): void | Promise<void>
	// exist is called when the result of the next plugin in the chain
	// is called
	exit?(ctx: ClientPluginContext, handlers: ClientPluginExitHandlers): void | Promise<void>
}

export type ClientPluginHandlers = {
	/* The initial value of the query */
	initialValue: QueryResult
	/** A reference to the houdini client to access any configuration values */
	client: HoudiniClient
	/** Move onto the next step using the provided context.  */
	next(ctx: ClientPluginContext): void
	/** Terminate the current chain  */
	resolve(ctx: ClientPluginContext, data: QueryResult): void
	/** Return true if the variables have changed */
	variablesChanged: (ctx: ClientPluginContext) => boolean
	/** Returns the marshaled variables for the operation */
	marshalVariables: typeof marshalVariables
}

/** Exit handlers are the same as enter handles but don't need to resolve with a specific value */
export type ClientPluginExitHandlers = Omit<ClientPluginHandlers, 'resolve'> & {
	resolve: (ctx: ClientPluginContext, data?: QueryResult) => void
	value: QueryResult
}

/** Exit handlers are the same as enter handles but don't need to resolve with a specific value */
export type ClientPluginErrorHandlers = Omit<ClientPluginHandlers, 'resolve'> & {
	error: unknown
}
