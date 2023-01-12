import type { HoudiniClient } from '.'
import { Layer } from '../cache/storage'
import {
	ArtifactKind,
	CachePolicy,
	ConfigFile,
	deepEquals,
	DocumentArtifact,
	FetchQueryResult,
	getCurrentConfig,
	GraphQLObject,
	marshalInputs,
	QueryArtifact,
	SubscriptionSpec,
} from '../lib'
import { Writable } from '../lib/store'
import { cachePolicyPlugin } from './plugins'

type NetworkResult<_Data> = FetchQueryResult<_Data> & { fetching: boolean; variables: {} }

export class DocumentObserver<_Data extends GraphQLObject, _Input extends {}> extends Writable<
	NetworkResult<_Data>
> {
	#artifact: DocumentArtifact
	#client: HoudiniClient
	#configFile: ConfigFile | null = null

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
	}: {
		artifact: DocumentArtifact
		plugins: ClientPlugin[]
		client: HoudiniClient
		cache?: boolean
	}) {
		// the initial store state
		const initialState = {
			result: { data: null, errors: [] },
			partial: false,
			source: null,
			fetching: false,
			variables: {},
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

		this.#plugins = [
			// cache policy needs to always come first so that it can be the first fetch_enter to fire
			cachePolicyPlugin(cache, (fetching: boolean) =>
				this.update((state) => ({ ...state, fetching }))
			)(),
		].concat(plugins.map((factory) => factory()))
	}

	// used by the client to send a new set of variables to the pipeline
	async send({
		variables,
		metadata,
		session,
		fetch = globalThis.fetch,
		policy,
		stuff,
	}: {
		variables?: _Input
		metadata?: {}
		fetch?: Fetch
		session?: App.Session
		policy?: CachePolicy
		stuff?: {}
	} = {}): Promise<_Data | null> {
		// if we dont have the config file yet, load it
		if (!this.#configFile) {
			this.#configFile = await getCurrentConfig()
		}

		// start off with the initial context
		const context = {
			config: this.#configFile!,
			policy: policy ?? (this.#artifact as QueryArtifact).policy,
			variables: {},
			metadata,
			session,
			fetch,
			stuff: stuff ?? {},
			artifact: this.#artifact,
		}

		return await new Promise((resolve, reject) => {
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
				context: this.#patchContext(context, {
					...context,
					variables,
				}),
			}

			// start walking down the chain
			this.#next(state)
		})
	}

	#next(ctx: IteratorState): void {
		// look for the next plugin that defines an enter of the correct step
		for (let index = ctx.index + 1; index <= this.#plugins.length; index++) {
			let target = this.#plugins[index]?.[ctx.currentStep]?.enter
			if (target) {
				try {
					// invoke the target
					const result = target(
						{ ...ctx.context },
						{
							client: this.#client,
							variablesChanged,
							marshalVariables,
							next: (newContext) => {
								this.#next({
									...ctx,
									context: this.#patchContext(ctx.context, newContext),
									index,
								})
							},
							resolve: (newContext, value) => {
								// start the journey back
								this.#terminate(
									{
										...ctx,
										context: this.#patchContext(ctx.context, newContext),
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
						}
					)
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

	#terminate(ctx: IteratorState, value: Partial<NetworkResult<_Data>>): void {
		// starting one less than the current index
		for (let index = ctx.index - 1; index >= 0; index--) {
			// if we find a plugin in the same phase, call it
			let target = this.#plugins[index]?.[ctx.currentStep]?.exit
			if (target) {
				try {
					// invoke the target
					const result = target(
						{
							...ctx.context,
							value,
						},
						{
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
									context: this.#patchContext(ctx.context, newContext),
								})
							},
							resolve: (context, val) => {
								// if we were given a value, use it. otherwise use the previous value
								const newValue = typeof val !== 'undefined' ? val : ctx.value

								// be brave. take the next step.
								this.#terminate(
									{
										...ctx,
										...context,
										value: newValue,
										index,
									},
									newValue
								)
							},
						}
					)
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

		// if the promise hasn't been resolved yet, do it
		if (!ctx.promise.resolved) {
			ctx.promise.resolve(value)

			// make sure we dont resolve it again
			ctx.promise.resolved = true
		}

		// the latest value should be written to the store
		this.update((state) => ({
			...state,
			variables: ctx.context.variables ?? {},
			...value,
			fetching: false,
		}))
	}

	#error(ctx: IteratorState, error: unknown) {
		// propagating an error up only visits plugins that come before the
		// current
		let propagate = true
		for (let i = ctx.index; i >= 0 && propagate; i--) {
			// if the step has an error handler, invoke it
			const errorHandler = this.#plugins[i].error
			if (errorHandler) {
				errorHandler(ctx.context, {
					error,
					// calling next in response to a
					next: (newContext) => {
						this.#next({
							...ctx,
							context: this.#patchContext(ctx.context, newContext),
							currentStep: 'setup',
							index: i,
						})

						// don't step through the rest of the errors
						propagate = false
					},
				})
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

	// #patchContext is responsible for keeping any of the internal state up to date
	#patchContext(old: ClientPluginContext, update: ClientPluginContext) {
		// look at the variables for ones that are different
		let changed: Required<ClientPluginContext>['variables'] = {}
		if (update.variables !== old.variables) {
			for (const [name, value] of Object.entries(update.variables ?? {})) {
				if (value !== old.variables?.[name]) {
					// we need to marshal the new value
					changed[name] = value
				}
			}
		}

		const hasChanged =
			Object.keys(changed).length > 0 || !update.stuff.inputs || !update.stuff.inputs.init
		if (update.artifact.kind !== ArtifactKind.Fragment && hasChanged) {
			// only marshal the changed variables so we don't double marshal
			const newVariables = {
				...update.stuff.inputs?.marshaled,
				...marshalInputs({
					artifact: update.artifact,
					input: changed,
					config: update.config,
				}),
			}

			update.stuff.inputs = {
				init: true,
				marshaled: newVariables,
				changed: !deepEquals(this.#lastVariables, newVariables),
			}

			// track the last variables used
			this.#lastVariables = update.stuff.inputs.marshaled
		}

		return update
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
		// error is called when a plugin after this raises an exception
		error?(
			ctx: ClientPluginContext,
			args: { error: unknown } & Pick<ClientPluginHandlers, 'next'>
		): void | Promise<void>
	}

type IteratorState = {
	context: ClientPluginContext
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

function marshalVariables(ctx: ClientPluginContext) {
	return ctx.stuff.inputs?.marshaled ?? {}
}

function variablesChanged(ctx: ClientPluginContext) {
	return ctx.stuff.inputs?.changed
}

export type Fetch = typeof globalThis.fetch

export type ClientPluginContext = {
	config: ConfigFile
	artifact: DocumentArtifact
	policy?: CachePolicy
	fetch?: Fetch
	variables?: Record<string, any>
	metadata?: App.Metadata | null
	session?: App.Session
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
	exit?(ctx: ExitContext, handlers: ClientPluginExitHandlers): void | Promise<void>
}

export type ExitContext = ClientPluginContext & { value: any }

export type ClientPluginHandlers = {
	/** A reference to the houdini client to access any configuration values */
	client: HoudiniClient
	/** Move onto the next step using the provided context.  */
	next(ctx: ClientPluginContext): void
	/** Terminate the current chain  */
	resolve(ctx: ClientPluginContext, data: Partial<NetworkResult<any>>): void
	/** Return true if the variables have chaged */
	variablesChanged: (ctx: ClientPluginContext) => boolean
	/** Returns the marshaled variables for the operation */
	marshalVariables: typeof marshalVariables
}

// /** Exit handlers are the same as enter handles but don't need to resolve with a specific value */
export type ClientPluginExitHandlers = Omit<ClientPluginHandlers, 'resolve'> & {
	resolve: (ctx: ClientPluginContext, data?: Partial<NetworkResult<any>>) => void
	value: Partial<NetworkResult<any>>
}
