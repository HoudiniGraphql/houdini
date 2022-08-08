import { derived, get, readable, Writable, writable } from 'svelte/store'
import type { Readable } from 'svelte/store'

import { getSession, isBrowser } from '../adapter'
import {
	CompiledFragmentKind,
	ConfigFile,
	FragmentStore,
	GraphQLObject,
	QueryArtifact,
	HoudiniDocumentProxy,
} from '../lib'
import { extractPageInfo, fragmentHandlers, PageInfo, PaginatedHandlers } from '../lib/pagination'

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
	paginationMethods: (keyof PaginatedHandlers<_Data, _Input>)[]
	storeName: string
}): FragmentStore<_Data | null> {
	return {
		name: artifact.name,
		kind: CompiledFragmentKind,
		paginated: !!paginatedArtifact,
		get(initialValue: _Data | null) {
			// at the moment a fragment store doesn't really do anything
			// but we're going to keep it wrapped in a store so we can eventually
			// optimize the updates
			let store: Writable<_Data | null> = writable(initialValue)

			// build up the methods we want to use
			let extraMethods: Record<string, any> = {}
			let onUnsubscribe = (reqID: string) => {}
			let pageInfo: Writable<PageInfo> | null = null
			if (paginatedArtifact) {
				const handlers = fragmentHandlers<_Data, {}>({
					storeName,
					config,
					paginationArtifact: paginatedArtifact,
					store,
				})

				extraMethods = Object.fromEntries(
					paginationMethods.map((key) => [key, handlers[key]])
				)
				extraMethods.paginationStrategy = handlers.paginationStrategy

				onUnsubscribe = handlers.onUnsubscribe
				pageInfo = handlers.pageInfo ?? null
			}

			return {
				subscribe: (...args: Parameters<Readable<_Data | null>['subscribe']>) => {
					// we need to add the page info
					const combined = derived<
						[typeof store, Readable<PageInfo | null>],
						_Data | null
					>([store, pageInfo || readable(null)], ([$store, $pageInfo]) => {
						if ($store === null) {
							return null
						}

						// combine the state and page info values
						const everything: _Data & { pageInfo?: PageInfo } = { ...$store }
						if ($pageInfo) {
							everything.pageInfo = $pageInfo
						}

						return everything
					})

					return combined.subscribe(...args)
				},
				proxy: new HoudiniDocumentProxy(),
				update: (val: _Data | null) => store?.set(val),
				...extraMethods,
			}
		},
	}
}
