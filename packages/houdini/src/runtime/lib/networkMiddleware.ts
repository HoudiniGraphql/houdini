import { Writable } from './store'
import { DocumentArtifact, GraphQLObject } from './types'

type Fetch = typeof globalThis.fetch

export class DocumentObserver<
	_Data extends GraphQLObject,
	_Input extends {}
> extends Writable<_Data | null> {
	#artifact: DocumentArtifact

	// the list of instantiated middlewares
	#middlewares: HoudiniMiddlewareInstance[]

	constructor({
		artifact,
		middlewares,
	}: {
		artifact: DocumentArtifact
		middlewares: HoudiniMiddleware[]
	}) {
		super(null)
		this.#artifact = artifact
		this.#middlewares = middlewares.map((factory) => factory())
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
		return new Promise((resolve, reject) => {
			// the initial state of the iterator
			const state: IteratorState = {
				value: null,
				terminatingIndex: null,
				index: -1,
				currentStep: 'phaseOne',
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
		// look for the next middleware that defines an enter of the correct step
		for (let index = ctx.index + 1; index <= this.#middlewares.length; index++) {
			let target = this.#middlewares[index]?.[ctx.currentStep]?.enter
			if (target) {
				// invoke the target
				target(ctx.context, {
					next: (newContext) => {
						this.#next({
							...ctx,
							context: newContext,
							index,
						})
					},
					terminate: (newContext, value) => {
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
				})
				return
			}
		}

		// if we got this far, we have exhausted the step.

		// if we are still in setup, flip over to fetch and start over
		if (ctx.currentStep === 'phaseOne') {
			return this.#next.bind(this)({
				...ctx,
				currentStep: 'phaseTwo',
				index: -1,
			})
		}

		// if we are in fetch, the last fetch enter called next. there's no terminating link for this
		// chain
		throw new Error(
			'Called next() on last possible middleware. Your chain is missing a terminating link.'
		)
	}

	#terminate(ctx: IteratorState, value: _Data | null): void {
		// starting one less than the current index
		for (let index = ctx.index - 1; index >= 0; index--) {
			// if we find a middleware in the same phase, call it
			let target = this.#middlewares[index]?.[ctx.currentStep]?.exit
			if (target) {
				// invoke the target
				target(
					{
						...ctx.context,
						value,
					},
					(context, val) => {
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
					}
				)
				return
			}
		}

		// if we're done with the fetch step, we need to start the setup phase of the termination flow
		if (ctx.currentStep === 'phaseTwo') {
			return this.#terminate(
				{
					...ctx,
					currentStep: 'phaseOne',
					index: ctx.terminatingIndex || this.#middlewares.length,
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
		this.set(value)
	}
}

/**
 * A network plugin has 2 primary entry points to modify the pipeline.
 * - phaseOne happens before the request is potentially cached
 * - phaseTwo happens when a request has not been cached and needs to be resolved from the api
 */
export type HoudiniMiddleware =
	// the first function lets a middleware setup for a particular observer chain
	() => {
		phaseOne?: NetworkMiddleware
		phaseTwo?: NetworkMiddleware
		cleanup?(): any
	}

type HoudiniMiddlewareInstance = ReturnType<HoudiniMiddleware>

type MiddlewareContext = {
	artifact: DocumentArtifact
	fetch?: Fetch
	variables?: {}
	metadata?: App.Metadata | null
	session?: App.Session
}

type IteratorState = {
	context: MiddlewareContext
	index: number
	value: any
	terminatingIndex: number | null
	currentStep: 'phaseOne' | 'phaseTwo'
	promise: {
		resolved: boolean
		resolve(val: any): void
		reject(val: any): void
	}
}

/** NetworkMiddleware describes the logic of the HoudiniClient plugin at a particular stage. */
export type NetworkMiddleware = {
	// enter is called when an artifact is pushed through
	enter?(ctx: MiddlewareContext, handlers: MiddlewareHandlers): void
	// exist is called when the result of the next middleware in the chain
	// is called
	exit?(args: ExitContext, next: (ctx: ExitContext, data?: any) => any): void
}

type ExitContext = MiddlewareContext & { value: any }

type MiddlewareHandlers = {
	next(ctx: MiddlewareContext): void
	// TODO: i hate this name. It kind of make sense for a single request
	// but for a subscription or live query, its more like "push". The semantic
	// meaning is that the chain is done and should be pushed back in reverse order
	terminate(ctx: MiddlewareContext, data: any): void
}
