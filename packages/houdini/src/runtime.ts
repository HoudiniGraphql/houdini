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

type Record = { [key: string]: any } & {
	id?: string
	__connectionFilters?: { [connectionName: string]: { [key: string]: string | number | boolean } }
}
type Data = Record | Record[]

export function applyPatch(
	patch: Patch,
	updateValue: (newValue: Data, variables: { [key: string]: any }) => void,
	currentState: Data,
	payload: Data,
	variables: { [key: string]: any }
) {
	// a place to write updates to
	const target = currentState
	// walk down the the patch and if there was a mutation, commit the update
	if (walkPatch(patch, payload, target, variables)) {
		updateValue(target, variables)
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
	for (const [fieldName, targetPaths] of Object.entries(patch.fields || {})) {
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
	for (const [operation, paths] of Object.entries(patch.operations || {})) {
		// if this is undefined, ill admit typescript saved me from something
		if (!paths) {
			continue
		}

		// look at every path we have to perform this operation
		for (const { path, parentID, position, when, connectionName } of paths) {
			// if there are conditions for this operation
			if (when) {
				// we only NEED there to be target filters for must's 
				const targets = target.__connectionFilters ? target.__connectionFilters[connectionName || ''] : null
				let ok = true

				// check must's first
				if (when.must && targets) {
					ok = Object.entries(when.must || {}).reduce<boolean>((prev, [key, value]) => Boolean(prev && targets[key] == value), ok)
				}
				// and then must_not
				if (when.must_not) {
					ok = !targets || Object.entries(when.must_not || {}).reduce<boolean>((prev, [key, value]) => Boolean(prev && targets[key] != value), ok)
				}

				// if we didn't satisfy everything we needed to
				if (!ok) {
					continue
				}
			}

			// if we have to add the connection somewhere
			if (
				operation === 'add' &&
				insertInConnection(path, target, parentID, position, payload, variables) &&
				!updated
			) {
				updated = true
			}
			// we could have to remove this element from somewhere
			else if (
				operation === 'remove' &&
				removeFromConnection(path, target, parentID, payload, variables) &&
				!updated
			) {
				updated = true
			}
			// we could have to delete this element from somewhere
			else if (
				operation === 'delete' &&
				// @ts-ignore: the field points to a string, not an object
				deleteFromConnection(path, target, payload) &&
				!updated
			) {
				updated = true
			}
		}
	}

	// walk down any related fields if they exist
	if (patch.edges) {
		for (const edgeName of Object.keys(patch.edges || {})) {
			// walk down and keep track if we updated anything
			if (
				walkPatch(patch.edges[edgeName], payload[edgeName], target, variables) &&
				!updated
			) {
				updated = true
			}
		}
	}

	// bubble up if there was an update
	return updated
}

function insertInConnection(
	path: string[],
	target: Record,
	parentID: { kind: 'Variable' | 'String' | 'Root'; value: string },
	position: 'start' | 'end',
	value: Record,
	variables: { [key: string]: any }
) {
	return walkToConnection(path, target, function (head, path, target) {
		const attributeName = path[0]
		// if we are entering something from root the target should be an object
		if (parentID.kind === 'Root') {
			// if there is an element after this then we need to treat it as an
			// attribute for the item pointed at by head
			if (attributeName) {
				target[head][attributeName] =
					position === 'end'
						? [...(target[head][attributeName] || []), value]
						: [value, ...(target[head][attributeName] || [])]
			}
			// no attribute name means head is in fact the accesor and we just need to push
			else {
				// target[head] = [...(target[head] || []), value]
				target[head] =
					position === 'end'
						? [...(target[head] || []), value]
						: [value, ...(target[head] || [])]
			}

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

				// check if we're supposed to add it to the end
				if (position === 'end') {
					entry[attributeName] = [...(entry[attributeName] || []), value]
				}
				// we're supposed to add it to the front
				else {
					entry[attributeName] = [value, ...(entry[attributeName] || [])]
				}

				// we did in fact update something
				return true
			}
		}

		// we didn't update anything
		return false
	})
}

function deleteFromConnection(path: string[], target: Record, targetID: string) {
	return walkToConnection(path, target, function (head, path, target) {
		const attributeName = path[0]

		// if this is a root list
		if (!attributeName) {
			const lengthBefore = target[head].length || 0
			// remove any entries with the matching id
			target[head] = target[head].filter(({ id }: { id?: string }) => id !== targetID)
			const lengthAfter = target[head].length || 0

			// track if we did infact update something
			return lengthBefore !== lengthAfter
		}

		// the head points to the list we have to look at for possible parents
		const parents = target[head]
		if (!Array.isArray(parents)) {
			throw new Error('Expected array in response')
		}

		// start off having not udpated anything
		let updated = false

		// look at every option for a matching id
		for (const entry of parents) {
			// if the element does not exist in the target
			if (attributeName && !entry[attributeName]) {
				// there's nothing to remove
				continue
			}

			const lengthBefore = entry[attributeName].length || 0
			// remove any entries with the matching id
			entry[attributeName] = entry[attributeName].filter(
				({ id }: { id?: string }) => id !== targetID
			)
			const lengthAfter = entry[attributeName].length || 0

			// track if we did infact update something
			updated = lengthBefore !== lengthAfter
		}

		// we didn't update anything
		return updated
	})
}

function removeFromConnection(
	path: string[],
	target: Record,
	parentID: { kind: 'Variable' | 'String' | 'Root'; value: string },
	value: Record,
	variables: { [key: string]: any }
) {
	return walkToConnection(path, target, function (head, path, target) {
		const attributeName = path[0]
		// if we are entering something from root the target should be an object
		if (parentID.kind === 'Root') {
			// if there is an element after this then we need to treat it as an
			// attribute for the item pointed at by head
			if (attributeName) {
				target[head][attributeName] = (target[head][attributeName] || []).filter(
					({ id }: { id: string }) => id !== value.id
				)
			}
			// no attribute name means head is in fact the accesor and we just need to push
			else {
				target[head] = (target[head] || []).filter(
					({ id }: { id: string }) => id !== value.id
				)
			}

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
				// we found the parent so remove the element from the connection
				entry[attributeName] = (entry[attributeName] || []).filter(
					({ id }: { id: string }) => id !== value.id
				)

				// TODO: we might not have updated something, returning true anyway
				return true
			}
		}

		// we didn't update anything
		return false
	})
}

function walkToConnection(
	path: string[],
	target: Record,
	onConnection: (head: string, path: string[], target: Record) => boolean
) {
	// keep track if we updated a field
	let updated = false

	// since we are entering something into a list, we need to stop on the second to
	// last element to find the node with matching id
	if (path.length <= 2) {
		if (onConnection(path[0], path.slice(1), target) && !updated) {
			updated = true
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
				if (walkToConnection(tail, entry, onConnection)) {
					updated = true
					// dont keep searching
					break
				}
			}
		}
		// the element is an object
		else {
			// keep going down
			if (walkToConnection(tail, element, onConnection) && !updated) {
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

export function updateStoreData(storeName: string, data: any, variables: any) {
	// TODO: this is definitely not what we want. the same query could show up
	// in multiple places and get the same update
	// apply the new update to every store matching the name
	for (const store of getDocumentStores(storeName)) {
		// apply the new date
		store.updateValue(data, variables)
	}
}
