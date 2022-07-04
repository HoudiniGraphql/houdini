// externals
import { writable } from 'svelte/store'
// locals
import { ConfigFile, FragmentStore, GraphQLObject, QueryArtifact } from '../lib'
import { fragmentHandlers, PaginatedHandlers } from '../lib/pagination'

// a fragment store exists in multiple places in a given application so we
// can't just return a store directly, the user has to load the version of the
// fragment store for the object the store has been mixed into
export function fragmentStore<_Data extends GraphQLObject, _Input = {}>({
	artifact,
	config,
	paginatedArtifact,
	paginationMethods,
}: {
	artifact: QueryArtifact
	config: ConfigFile
	paginated: QueryArtifact
	paginatedArtifact?: QueryArtifact
	paginationMethods: { [key: string]: keyof PaginatedHandlers<_Data, _Input> }
}): FragmentStore<_Data | null> {
	return {
		name: artifact.name,
		get(initialValue: _Data | null) {
			// at the moment a fragment store doesn't really do anything
			// but we're going to keep it wrapped in a store so we can eventually
			// optimize the updates
			const fragmentStore = writable<_Data | null>(initialValue)

			// build up the methods we want to use
			let extraMethods: {} = {}
			if (paginatedArtifact) {
				const handlers = fragmentHandlers<_Data, {}>({
					config,
					paginationArtifact: paginatedArtifact,
					initialValue,
					store: fragmentStore,
				})

				extraMethods = Object.fromEntries(
					Object.entries(paginationMethods).map(([key, value]) => [key, handlers[value]])
				)
			}

			return {
				subscribe: fragmentStore.subscribe,
				update: fragmentStore.set,
				...extraMethods,
			}
		},
	}
}
