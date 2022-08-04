import { SubscriptionSelection, ListWhen, SubscriptionSpec, RefetchUpdateMode } from '../lib/types'
import { Cache, LinkedList, rootID } from './cache'
import { flattenList } from './stuff'

export class ListManager {
	rootID: string
	cache: Cache

	constructor(cache: Cache, rootID: string) {
		this.rootID = rootID
		this.cache = cache
	}

	// associate list names with the handler that wraps the list
	lists: Map<string, Map<string, ListCollection>> = new Map()

	private listsByField: Map<string, Map<string, List[]>> = new Map()

	get(listName: string, id?: string | {}) {
		const matches = this.lists.get(listName)

		// if we don't have a list by that name, we're done
		if (!matches || matches.size === 0) {
			return null
		}

		const head = [...matches.values()][0]

		// if there is only one list with that name, return it
		if (matches?.size === 1) {
			return head
		}

		// there are multiple versions of the list so the user must
		// have provided an id. If they meant to refer to the root object
		// it would have been caught in the size === 1 check above since
		// root's ID is fixed
		if (!id) {
			throw new Error(
				`Found multiple instances of "${listName}". Please provide a ` +
					`parentID that corresponds to the object containing the field marked with @list or @paginate.`
			)
		}

		// the provided id won't match the cache's ID so we have to compute the internal ID, using
		// one of the matches to figure out the type of the list element
		const { recordType } = head.lists[0]
		const parentID = id ? this.cache._internal_unstable.id(recordType || '', id)! : this.rootID

		// return the list pointing to the correct parent
		return this.lists.get(listName)?.get(parentID)
	}

	remove(listName: string, id: string) {
		this.lists.get(listName)?.delete(id || this.rootID)
	}

	add(list: {
		name: string
		connection: boolean
		recordID: SubscriptionSpec['parentID']
		recordType?: string
		key: string
		listType: string
		selection: SubscriptionSelection
		when?: ListWhen
		filters?: List['filters']
		abstract?: boolean
	}) {
		// if we haven't seen this list before
		if (!this.lists.has(list.name)) {
			this.lists.set(list.name, new Map())
		}

		// if we haven't seen the list before, add a new colleciton
		const name = list.name
		const parentID = list.recordID || this.rootID

		// if we already have a handler for the key, don't do anything
		if (this.lists.get(name)?.get(parentID)?.includes(list.key)) {
			return
		}

		if (!this.lists.has(name)) {
			this.lists.set(name, new Map())
		}
		if (!this.lists.get(name)!.has(parentID)) {
			this.lists.get(name)!.set(parentID, new ListCollection([]))
		}

		if (!this.listsByField.has(parentID)) {
			this.listsByField.set(parentID, new Map())
		}
		if (!this.listsByField.get(parentID)!.has(list.key)) {
			this.listsByField.get(parentID)?.set(list.key, [])
		}

		// create the list handler
		const handler = new List({ ...list, manager: this })

		// add the list to the collection
		this.lists.get(list.name)!.get(parentID)!.lists.push(handler)
		this.listsByField.get(parentID)!.get(list.key)!.push(handler)
	}

	removeIDFromAllLists(id: string) {
		for (const fieldMap of this.lists.values()) {
			for (const list of fieldMap.values()) {
				list.removeID(id)
			}
		}
	}

	deleteField(parentID: string, field: string) {
		// if we have no lists associated with the parent/field combo, don't do anything
		if (!this.listsByField.get(parentID)?.has(field)) {
			return
		}

		// grab the list of fields associated with the parent/field combo
		for (const list of this.listsByField.get(parentID)!.get(field)!) {
			this.lists.get(list.name)?.get(list.recordID)?.deleteListWithKey(field)
			if (this.lists.get(list.name)?.get(list.recordID)?.lists.length === 0) {
				this.lists.get(list.name)?.delete(list.recordID)
			}
		}

		// delete the lists by field lookups
		this.listsByField.get(parentID)!.delete(field)
	}
}

export class List {
	readonly recordID: string
	readonly recordType?: string
	readonly key: string
	readonly type: string
	private cache: Cache
	readonly selection: SubscriptionSelection
	private _when?: ListWhen
	private filters?: { [key: string]: number | boolean | string }
	readonly name: string
	private connection: boolean
	private manager: ListManager
	private abstract?: boolean

	constructor({
		name,
		recordID,
		recordType,
		key,
		listType,
		selection,
		when,
		filters,
		connection,
		manager,
		abstract,
	}: Parameters<ListManager['add']>[0] & { manager: ListManager }) {
		this.recordID = recordID || rootID
		this.recordType = recordType
		this.key = key
		this.type = listType
		this.cache = manager.cache
		this.selection = selection
		this._when = when
		this.filters = filters
		this.name = name
		this.connection = connection
		this.manager = manager
		this.abstract = abstract
	}

	// looks for the collection of all of the lists in the cache that satisfies a when
	// condition
	when(when?: ListWhen): ListCollection {
		return this.manager.lists.get(this.name)!.get(this.recordID)!.when(when)
	}

	append(selection: SubscriptionSelection, data: {}, variables: {} = {}) {
		return this.addToList(selection, data, variables, 'last')
	}

	prepend(selection: SubscriptionSelection, data: {}, variables: {} = {}) {
		return this.addToList(selection, data, variables, 'first')
	}

	addToList(
		selection: SubscriptionSelection,
		data: {},
		variables: {} = {},
		where: 'first' | 'last'
	) {
		// figure out the type we're adding
		const listType = this.listType(data)

		// figure out the id of the type we are adding
		const dataID = this.cache._internal_unstable.id(listType, data)

		// if there are conditions for this operation
		if (!this.validateWhen() || !dataID) {
			return
		}

		// we are going to implement the insert as a write with an update flag on a field
		// that matches the key of the list. We'll have to embed the lists data and selection
		// in the appropriate objects
		let insertSelection = selection
		let insertData = data

		// if we are wrapping a connection, we have to embed the data under edges > node
		if (this.connection) {
			insertSelection = {
				newEntry: {
					keyRaw: this.key,
					type: 'Connection',
					fields: {
						edges: {
							keyRaw: 'edges',
							type: 'ConnectionEdge',
							update: (where === 'first' ? 'prepend' : 'append') as RefetchUpdateMode,
							fields: {
								node: {
									type: listType,
									keyRaw: 'node',
									fields: {
										...selection,
										__typename: {
											keyRaw: '__typename',
											type: 'String',
										},
									},
								},
							},
						},
					},
				},
			}
			insertData = {
				newEntry: {
					edges: [{ node: { ...data, __typename: listType } }],
				},
			}
		} else {
			insertSelection = {
				newEntries: {
					keyRaw: this.key,
					type: listType,
					update: (where === 'first' ? 'prepend' : 'append') as RefetchUpdateMode,
					fields: {
						...selection,
						__typename: {
							keyRaw: '__typename',
							type: 'String',
						},
					},
				},
			}
			insertData = {
				newEntries: [{ ...data, __typename: listType }],
			}
		}

		// update the cache with the data we just found
		this.cache.write({
			selection: insertSelection,
			data: insertData,
			variables,
			parent: this.recordID,
			applyUpdates: true,
		})
	}

	removeID(id: string, variables: {} = {}) {
		// if there are conditions for this operation
		if (!this.validateWhen()) {
			return
		}

		// if we are removing from a connection, the id we are removing from
		// has to be computed
		let parentID = this.recordID
		let targetID = id
		let targetKey = this.key

		// if we are removing a record from a connection we have to walk through
		// some embedded references first
		if (this.connection) {
			const { value: embeddedConnection } = this.cache._internal_unstable.storage.get(
				this.recordID,
				this.key
			)
			if (!embeddedConnection) {
				return
			}
			const embeddedConnectionID = embeddedConnection as string

			// look at every embedded edge for the one with a node corresponding to the element
			// we want to delete
			const { value: edges } = this.cache._internal_unstable.storage.get(
				embeddedConnectionID,
				'edges'
			)
			for (const edge of flattenList(edges as LinkedList) || []) {
				if (!edge) {
					continue
				}

				const edgeID = edge as string

				// look at the edge's node
				const { value: nodeID } = this.cache._internal_unstable.storage.get(edgeID, 'node')
				if (!nodeID) {
					continue
				}

				// if we found the node
				if (nodeID === id) {
					targetID = edgeID
				}
			}
			parentID = embeddedConnectionID
			targetKey = 'edges'
		}

		// if the id is not contained in the list, dont notify anyone
		let value = this.cache._internal_unstable.storage.get(parentID, targetKey)
			.value as LinkedList
		if (!value || !value.includes(targetID)) {
			return
		}

		// get the list of specs that are subscribing to the list
		const subscribers = this.cache._internal_unstable.subscriptions.get(this.recordID, this.key)

		// disconnect record from any subscriptions associated with the list
		this.cache._internal_unstable.subscriptions.remove(
			targetID,
			// if we are unsubscribing from a connection, the fields we care about
			// are tucked away under edges
			this.connection ? this.selection.edges.fields! : this.selection,
			subscribers,
			variables
		)

		// remove the target from the parent
		this.cache._internal_unstable.storage.remove(parentID, targetKey, targetID)

		// notify the subscribers about the change
		for (const spec of subscribers) {
			// trigger the update
			spec.set(
				this.cache._internal_unstable.getSelection({
					parent: spec.parentID || this.manager.rootID,
					selection: spec.selection,
					variables: spec.variables?.() || {},
				}).data
			)
		}

		// return true if we deleted something
		return true
	}

	remove(data: {}, variables: {} = {}) {
		const targetID = this.cache._internal_unstable.id(this.listType(data), data)
		if (!targetID) {
			return
		}

		// figure out the id of the type we are adding
		return this.removeID(targetID, variables)
	}

	listType(data: { __typename?: string }) {
		return data.__typename || this.type
	}

	validateWhen(when?: ListWhen) {
		// if this when doesn't apply, we should look at others to see if we should update those behind the scenes
		let filters = when || this._when

		let ok = true
		// if there are conditions for this operation
		if (filters) {
			// we only NEED there to be target filters for must's
			const targets = this.filters

			// check must's first
			if (filters.must && targets) {
				ok = Object.entries(filters.must).reduce<boolean>(
					(prev, [key, value]) => Boolean(prev && targets[key] == value),
					ok
				)
			}
			// if there are no targets, nothing could be true that can we compare against
			if (filters.must_not) {
				ok =
					!targets ||
					Object.entries(filters.must_not).reduce<boolean>(
						(prev, [key, value]) => Boolean(prev && targets[key] != value),
						ok
					)
			}
		}

		return ok
	}

	toggleElement(
		selection: SubscriptionSelection,
		data: {},
		variables: {} = {},
		where: 'first' | 'last'
	) {
		// if we dont have something to remove, then add it instead
		if (!this.remove(data, variables)) {
			this.addToList(selection, data, variables, where)
		}
	}

	// iterating over the list handler should be the same as iterating over
	// the underlying linked list
	*[Symbol.iterator]() {
		let entries: string[] = []

		// grab the underlying value from the cache
		let value = this.cache._internal_unstable.storage.get(this.recordID, this.key).value as
			| LinkedList
			| string

		if (!this.connection) {
			entries = flattenList(value as LinkedList)
		} else {
			// connections need to reference the edges field for the list of entries
			entries = this.cache._internal_unstable.storage.get(value as string, 'edges')
				.value as string[]
		}

		for (let record of entries) {
			yield record
		}
	}
}

export class ListCollection {
	lists: List[] = []

	constructor(lists: List[]) {
		this.lists = lists
	}

	append(...args: Parameters<List['append']>) {
		this.lists.forEach((list) => list.append(...args))
	}

	prepend(...args: Parameters<List['prepend']>) {
		this.lists.forEach((list) => list.prepend(...args))
	}

	addToList(...args: Parameters<List['addToList']>) {
		this.lists.forEach((list) => list.addToList(...args))
	}

	removeID(...args: Parameters<List['removeID']>) {
		this.lists.forEach((list) => list.removeID(...args))
	}

	remove(...args: Parameters<List['remove']>) {
		this.lists.forEach((list) => list.remove(...args))
	}

	toggleElement(...args: Parameters<List['toggleElement']>) {
		this.lists.forEach((list) => list.toggleElement(...args))
	}

	when(when?: ListWhen): ListCollection {
		return new ListCollection(
			this.lists.filter((list) => {
				return list.validateWhen(when)
			})
		)
	}

	includes(key: string) {
		return !!this.lists.find((list) => list.key === key)
	}

	deleteListWithKey(key: string) {
		return (this.lists = this.lists.filter((list) => list.key !== key))
	}

	// iterating over the collection should be the same as iterating over
	// the underlying list
	*[Symbol.iterator]() {
		for (let list of this.lists) {
			for (const entry of list) {
				yield entry
			}
		}
	}
}
