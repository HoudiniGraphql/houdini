import type { HoudiniClient } from '.'
import type { DocumentArtifact, FetchQueryResult, GraphQLObject, QueryResult } from '../lib'
import { Writable } from '../lib/store'

type State<_Data> = FetchQueryResult<_Data> & { fetching: boolean }

export class DocumentObserver<_Data extends GraphQLObject, _Input extends {}> extends Writable<
	State<_Data>
> {
	#artifact: DocumentArtifact
	#client: HoudiniClient

	// the list of instantiated plugins
	#plugins: ReturnType<ClientPlugin>[]

	constructor({
		artifact,
		plugins,
		client,
	}: {
		artifact: DocumentArtifact
		plugins: ClientPlugin[]
		client: HoudiniClient
	}) {
		// the intial store state
		const initialState = {
			result: { data: null, errors: [] },
			partial: false,
			source: null,
			fetching: false,
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
		this.#plugins = plugins.map((factory) => factory())
	}

	// used by the client to send a new set of variables to the pipeline
	send({
		variables,
		metadata,
		session,
		fetch = globalThis.fetch,
	}: {
		variables?: _Input
		metadata?: {}
		fetch?: Fetch
		session?: App.Session
	} = {}): Promise<_Data | null> {
		this.update((state) => ({ ...state, fetching: true }))

		return new Promise((resolve, reject) => {
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
				context: {
					variables,
					metadata,
					session,
					fetch,
					artifact: this.#artifact,
				},
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
							next: (newContext) => {
								this.#next({
									...ctx,
									context: newContext,
									index,
								})
							},
							resolve: (newContext, value) => {
								// start the journey back
								this.#terminate(
									{
										...ctx,
										context: newContext,
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

	#terminate(ctx: IteratorState, value: Partial<State<_Data>>): void {
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
							client: this.#client,
							value,
							next: (newContext) => {
								// push the ctx onto the next step
								this.#next({
									...ctx,
									index: index - 1,
									currentStep: 'setup',
									context: newContext,
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
							context: newContext,
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
}

// prettier-ignore
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

export type Fetch = typeof globalThis.fetch

export type ClientPluginContext = {
	artifact: DocumentArtifact
	fetch?: Fetch
	variables?: {}
	metadata?: App.Metadata | null
	session?: App.Session
	fetchParams?: RequestInit
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
	resolve(ctx: ClientPluginContext, data: Partial<State<any>>): void
}

// /** Exit handlers are the same as enter handles but don't need to resolve with a specific value */
export type ClientPluginExitHandlers = Omit<ClientPluginHandlers, 'resolve'> & {
	resolve: (ctx: ClientPluginContext, data?: Partial<State<any>>) => void
	value: Partial<State<any>>
}
