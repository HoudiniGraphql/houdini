// externals
import { writable } from 'svelte/store'
// locals
import { ConfigFile } from '../lib'

// a fragment store exists in multiple places in a given application so we
// can't just return a store directly, the user has to load the version of the
// fragment store for the object the store has been mixed into
export function fragmentStore<_Data>({
	config,
	extraMethods,
}: {
	config: ConfigFile
	extraMethods: {}
}) {
	return {
		load(initialValue: _Data) {
			// at the moment a fragment store doesn't really do anything
			// but we're going to keep it wrapped in a store so we can eventually
			// optimize the updates
			const fragmentStore = writable<_Data>(initialValue)

			return {
				subscribe: fragmentStore.subscribe,
				update: fragmentStore.set,
				...extraMethods,
			}
		},
	}
}
