// externals
import { derived, get, readable, Writable, writable } from 'svelte/store'
import type { Readable } from 'svelte/store'
// locals
import { ConfigFile, FragmentStore, GraphQLObject, QueryArtifact } from '../lib'
import {
	extractPageInfo,
	fragmentHandlers,
	nullPageInfo,
	PageInfo,
	PaginatedHandlers,
} from '../lib/pagination'
import { sessionStore } from '../lib/session'
import { getSession } from '../adapter'

// a fragment store exists in multiple places in a given application so we
// can't just return a store directly, the user has to load the version of the
// fragment store for the object the store has been mixed into
export function fragmentStore<_Data extends GraphQLObject, _Input = {}>({
	artifact,
	config,
	paginatedArtifact,
	paginationMethods,
	storeName,
}: {
	artifact: QueryArtifact
	config: ConfigFile
	paginated: QueryArtifact
	paginatedArtifact?: QueryArtifact
	paginationMethods: { [key: string]: keyof PaginatedHandlers<_Data, _Input> }
	storeName: string
}): FragmentStore<_Data | null> {
	return {
		name: artifact.name,
		get(initialValue: _Data | null) {
			const stores: { [reqID: string]: Writable<_Data | null> } = {}

			// at the moment a fragment store doesn't really do anything
			// but we're going to keep it wrapped in a store so we can eventually
			// optimize the updates
			let store: Writable<_Data | null>

			// build up the methods we want to use
			let extraMethods: {} = {}
			let onUnsubscribe = (reqID: string) => {}
			let pageInfos: { [key: string]: Writable<PageInfo> } = {}
			if (paginatedArtifact) {
				const handlers = fragmentHandlers<_Data, {}>({
					storeName,
					config,
					paginationArtifact: paginatedArtifact,
					stores,
				})

				extraMethods = Object.fromEntries(
					Object.entries(paginationMethods).map(([key, value]) => [key, handlers[value]])
				)
				onUnsubscribe = handlers.onUnsubscribe
				pageInfos = handlers.pageInfos
			}

			console.log(extraMethods)

			const written = new Set<string>()

			return {
				subscribe: (...args: Parameters<Readable<_Data | null>['subscribe']>) => {
					// grab the appropriate store for the session
					const [requestStore, reqID] = sessionStore(
						get(getSession()),
						stores,
						() => initialValue
					)

					// if we haven't written anything yet
					if (!written.has(reqID)) {
						written.add(reqID)

						// update the fragment value
						requestStore.set(initialValue)

						// if we have to set up a paginated fragment
						if (paginatedArtifact) {
							// if we don't have an entry for the page info, make one
							if (!pageInfos[reqID]) {
								pageInfos[reqID] = writable(nullPageInfo())
							}

							// update the page info
							pageInfos[reqID].set(
								extractPageInfo(initialValue, paginatedArtifact.refetch!.path)
							)
						}
					}

					store = requestStore

					// we need to add the page info
					const combined = derived<[typeof requestStore, Readable<PageInfo>], _Data>(
						[requestStore, pageInfos[reqID] || readable(null)],
						([$store, $pageInfo]) => {
							const everything = { ...$store }
							if ($pageInfo) {
								everything.pageInfo = $pageInfo
							}

							return everything as _Data
						}
					)

					const unsub = combined.subscribe(...args)

					return () => {
						unsub()
						onUnsubscribe(reqID)
						written.delete(reqID)
					}
				},
				update: (val: _Data | null) => store?.set(val),
				...extraMethods,
			}
		},
	}
}
