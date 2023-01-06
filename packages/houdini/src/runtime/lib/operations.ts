import { Writable } from './store'
import { DocumentArtifact, GraphQLObject } from './types'

type Fetch = typeof globalThis.fetch

export class DocumentObserver<
	_Data extends GraphQLObject,
	_Input extends {}
> extends Writable<_Data | null> {
	#artifact: DocumentArtifact
	#subscribers: ((data: _Data) => void)[]

	#middlewares: ReturnType<ObserverMiddleware>[] = []

	constructor({
		artifact,
		middlewares,
	}: {
		artifact: DocumentArtifact
		middlewares: ObserverMiddleware[]
	}) {
		super(null, () => {
			this.#middlewares = middlewares.map((factory) => factory())
		})
		this.#artifact = artifact
		this.#subscribers = []
	}

	// used by the client to send a new set of variables to the pipeline
	async send({ variables, metadata }: { variables: _Input; metadata: {}; fetch: Fetch }) {}
}

// prettier-ignore
export type ObserverMiddleware =
	// the first function lets a middleware setup for a particular observer chain
	() => {
		// enter is called when an artifact is pushed through
		enter?(args: { artifact: DocumentArtifact; fetch: Fetch }): any
		// exist is called when the result of the next middleware in the chain
		// is called
		exit?(value: any): any
		// cleanup is called when the observer is being destroyed
		cleanup?(): any
	}
