// externals
import { Patch } from 'houdini-compiler'
// locals
import { getEnvironment } from './environment'

// fetchQuery is used by the preprocess-generated runtime to send an operation to the server
export function fetchQuery({
	text,
	variables,
}: {
	text: string
	variables: { [name: string]: unknown }
}) {
	return getEnvironment()?.sendRequest({ text, variables })
}

// the dispatch table
export type DocumentStore = {
	name: string
	currentValue: any
	set: (value: any) => void
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
	_stores[target.name] = getDocumentStores(target.name).filter(({ set }) => set !== target.set)
}

type Record = { [key: string]: any } & { id?: string }
type Data = Record | Record[]

export function applyPatch(
	patch: Patch,
	set: (newValue: Data) => void,
	currentState: Data,
	payload: Data,
	variables: { [key: string]: any }
) {
	// a place to write updates to
	const target = currentState

	// walk down the the patch and if there was a mutation, commit the update
	if (walkPatch(patch, payload, target, variables)) {
		set(target)
	}
}

function walkPatch(
	patch: Patch,
	payload: Data,
	target: Record,
	variables: { [key: string]: any }
): boolean {
	// track if we update something
	let updated = false

	// if we are walking down a list then we need to take one more step
	if (Array.isArray(payload)) {
		for (const subobj of payload) {
			// if walking down updated something and we don't think we have
			if (walkPatch(patch, subobj, target, variables) && !updated) {
				// keep us up to date
				updated = true
			}
		}

		// we're done with this entry (ignore fields and edges on lists)
		return updated
	}

	// during the search for fields to update, we might need to go searching through
	// many nodes for the response
	for (const [fieldName, targetPaths] of Object.entries(patch.fields)) {
		// update the target object at every path we need to
		for (const path of targetPaths) {
			// if there is no id, we can update the fields
			if (!payload.id) {
				throw new Error('Cannot update fields without id in payload')
			}

			if (updateField(path, target, payload.id, payload[fieldName]) && !updated) {
				updated = true
			}
		}
	}

	// we might need to add this entity to some connections in the response
	for (const [operation, paths] of Object.entries(patch.operations)) {
		// if this is undefined, ill admit typescript saved me from something
		if (!paths) {
			continue
		}

		// copy the entry into every path in the response
		for (const { path, parentID } of paths) {
			if (operation === 'add') {
				// add the entity to the connection

				if (
					insertInConnection(path, target, parentID, payload, variables, path.length) &&
					!updated
				) {
					updated = true
				}
			}
		}
	}

	// walk down any related fields
	for (const edgeName of Object.keys(patch.edges)) {
		// walk down and keep track if we updated anything
		if (walkPatch(patch.edges[edgeName], payload[edgeName], target, variables) && !updated) {
			updated = true
		}
	}

	// bubble up if there was an update
	return updated
}

function insertInConnection(
	path: string[],
	target: Record,
	parentID: { kind: 'Variable' | 'String' | 'Root'; value: string },
	value: Record,
	variables: { [key: string]: any },
	pathLength: number
) {
	// keep track if we updated a field
	let updated = false

	// dry
	const head = path[0]

	// since we are entering something into a list, we need to stop on the second to
	// last element to find the node with matching id
	if (path.length <= 2) {
		const attributeName = path[1]
		// if we are entering something from root the target should be an object
		if (parentID.kind === 'Root') {
			// if there is an element after this then we need to treat it as an
			// attribute for the item pointed at by head
			if (attributeName) {
				target[head][attributeName] = [...(target[head][attributeName] || []), value]
			}
			// no attribute name means head is in fact the accesor and we just need to push
			else {
				target[head] = [...(target[head] || []), value]
			}

			// the current head of the list is the container for the attribute

			// we did update something
			return true
		}

		// the head points to the list we have to look at for possible parents
		const parents = target[head]
		if (!Array.isArray(parents)) {
			throw new Error('Expected array in response')
		}

		// look at every option for a matching id
		for (const entry of parents) {
			// the id we are looking for
			const targetID = parentID.kind === 'String' ? parentID.value : variables[parentID.value]

			// if the id matches
			if (entry.id === targetID) {
				// we found it!

				// add the value to the entry's list
				entry[attributeName] = [...(entry[attributeName] || []), value]
				// we did in fact update something
				return true
			}
		}
	}
	// keep going walking the path
	else {
		// pull the first element off of the list
		const head = path[0]
		const tail = path.slice(1, path.length)

		// look at the value in the response
		const element = target[head]

		// if the element is a list
		if (Array.isArray(element)) {
			// walk down every element in the list
			for (const entry of element) {
				// if we applied the udpate
				if (insertInConnection(tail, entry, parentID, value, variables, pathLength)) {
					updated = true
					// dont keep searching
					break
				}
			}
		}
		// the element is an object
		else {
			// keep going down
			if (
				insertInConnection(tail, element, parentID, value, variables, pathLength) &&
				!updated
			) {
				updated = true
			}
		}
	}

	return updated
}

function updateField(path: string[], target: Record, targetId: string, value: any): boolean {
	// keep track if we updated a field
	let updated = false

	// if we are looking at the last element, the entry in the path corresponds to the field that we need to update
	if (path.length === 1) {
		// if the target is a list, there's something wrong
		if (Array.isArray(target)) {
			throw new Error('final entry in path is a list?')
		}

		// only update fields if the id's match
		if (target.id === targetId) {
			// we need to update the field
			target[path[0]] = value

			// track that we did something
			updated = true
		}
	} else {
		// pull the first element off of the list
		const head = path[0]
		const tail = path.slice(1, path.length)

		// look at the value in the response
		const element = target[head]

		// if the element is a list
		if (Array.isArray(element)) {
			// walk down every element in the list
			for (const entry of element) {
				// if we applied the udpate
				if (updateField(tail, entry, targetId, value)) {
					updated = true
					// dont keep searching
					break
				}
			}
		}
		// the element is an object
		else {
			// keep going down
			if (updateField(tail, element, targetId, value) && !updated) {
				updated = true
			}
		}
	}

	return updated
}
