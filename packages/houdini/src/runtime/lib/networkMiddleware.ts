import { Writable } from './store'
import { DocumentArtifact, GraphQLObject } from './types'

type Fetch = typeof globalThis.fetch

export class DocumentObserver<
	_Data extends GraphQLObject,
	_Input extends {}
> extends Writable<_Data | null> {
	#artifact: DocumentArtifact
	#middlewares: ReturnType<ObserverMiddleware>[]

	constructor({
		artifact,
		middlewares,
	}: {
		artifact: DocumentArtifact
		middlewares: ObserverMiddleware[]
	}) {
		super(null)
		this.#artifact = artifact
		this.#middlewares = middlewares.map((factory) => factory())
	}

	// used by the client to send a new set of variables to the pipeline
	async send({
		variables,
		metadata,
		session,
		fetch = globalThis.fetch,
	}: {
		variables?: _Input
		metadata?: {}
		fetch?: Fetch
		session?: App.Session
	} = {}) {
		const [first, ...rest] = this.#middlewares
	}
}

/**
 * A network plugin has 2 primary entry points to modify the pipeline:
 * - setup happens before the request is potentially cached
 * - fetch happens when a request has not been cached
 */
export type ObserverMiddleware =
	// the first function lets a middleware setup for a particular observer chain
	() => {
		setup?: NetworkMiddleware
		fetch?: NetworkMiddleware
		cleanup?(): any
	}

type MiddlewareContext = {
	artifact: DocumentArtifact
	fetch?: Fetch
	variables?: {}
	session?: App.Session
}

/** NetworkMiddleware describes the logic of the HoudiniClient plugin at a particular stage. */
export type NetworkMiddleware = {
	// enter is called when an artifact is pushed through
	enter?(ctx: MiddlewareContext, handlers: MiddlewareHandlers): void
	// exist is called when the result of the next middleware in the chain
	// is called
	exit?(
		args: MiddlewareContext & { value: GraphQLObject },
		handlers: { next: MiddlewareHandlers['terminate'] }
	): void
}

type MiddlewareHandlers = {
	next(ctx: MiddlewareContext): void
	// TODO: i hate this name. It kind of make sense for a single request
	// but for a subscription or live query, its more like "push". The semantic
	// meaning is that the chain is done and should be pushed back in reverse order
	terminate(data: any): any
}
