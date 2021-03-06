// locals
import { setVariables } from './context'

// the dispatch table
export type DocumentStore = {
	name: string
	currentValue: any
	variables: any
	updateValue: (value: any, variables: any) => void
}

const _stores: { [name: string]: DocumentStore[] } = {}

export function getDocumentStores(name: string): DocumentStore[] {
	return _stores[name] || []
}

// registerDocumentStore is used by query and fragment runtimes to register their updater with the dispatch table
export function registerDocumentStore(store: DocumentStore) {
	_stores[store.name] = [...getDocumentStores(store.name), store]
}

// unregisterDocumentStore is used by query and fragment runtimes to remove their updater from the dispatch table
export function unregisterDocumentStore(target: DocumentStore) {
	_stores[target.name] = getDocumentStores(target.name).filter(
		({ updateValue }) => updateValue !== target.updateValue
	)
}

export function updateStoreData(storeName: string, result: any, variables: any) {
	if (!result) {
		console.log('updating with null result')
		return
	}

	// keep the variables in sync
	setVariables(variables)

	// apply the new update to every store matching the name
	// TODO: this might not be what we want. the same query could show up
	// in multiple places and get the same update
	for (const store of getDocumentStores(storeName)) {
		// apply the new date
		store.updateValue(result.data, variables)
	}
}
