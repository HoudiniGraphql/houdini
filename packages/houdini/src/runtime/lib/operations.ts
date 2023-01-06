import { DocumentArtifact, GraphQLObject, SubscriptionSpec } from './types'

type Fetch = typeof globalThis.fetch

export class DocumentObserver<_Data extends GraphQLObject, _Input extends {}> {
	#artifact: DocumentArtifact
	#subscribers: ((data: _Data) => void)[]

	// the chain of middlewares to use to process a request
	#middlewareFactories = [
		queryMiddleware,
		mutationMiddleware,
		subscriptionMiddleware,
		fetchMiddleware,
	]

	#middlewares: ReturnType<ObserverMiddleware>[] = []

	constructor({ artifact }: { artifact: DocumentArtifact }) {
		this.#artifact = artifact
		this.#subscribers = []
		this.#middlewares = this.#middlewareFactories.map((factory) => factory())
	}

	// used by the client to send a new set of variables to the pipeline
	async send({ variables, metadata }: { variables: _Input; metadata: {}; fetch: Fetch }) {}

	set({ data }: { data: _Data }) {}
}

// prettier-ignore
type ObserverMiddleware =
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

const queryMiddleware: ObserverMiddleware = function () {
	// track the bits of state we need to hold onto
	let lastVariables = null
	let subscriptionSpec: SubscriptionSpec | null = null

	// the function to call when a query is sent
	return {}
}

const mutationMiddleware: ObserverMiddleware = function () {
	return {}
}

const subscriptionMiddleware: ObserverMiddleware = function () {
	return {}
}

const fetchMiddleware: ObserverMiddleware = function () {
	return {}
}
