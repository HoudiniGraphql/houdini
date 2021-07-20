// local imports
import { SubscriptionSelection, ListWhen, SubscriptionSpec, RefetchUpdateMode } from '../types'
import { Cache } from './cache'
import { Record } from './record'

export class ListHandler {
	readonly record: Record
	readonly key: string
	readonly listType: string
	private cache: Cache
	readonly selection: SubscriptionSelection
	private _when?: ListWhen
	private filters?: { [key: string]: number | boolean | string }
	readonly name: string
	readonly parentID: SubscriptionSpec['parentID']
	private connection: boolean

	constructor({
		name,
		cache,
		record,
		key,
		listType,
		selection,
		when,
		filters,
		parentID,
		connection,
	}: {
		name: string
		connection: boolean
		cache: Cache
		record: Record
		key: string
		listType: string
		selection: SubscriptionSelection
		when?: ListWhen
		filters?: ListHandler['filters']
		parentID?: SubscriptionSpec['parentID']
	}) {
		this.record = record
		this.key = key
		this.listType = listType
		this.cache = cache
		this.selection = selection
		this._when = when
		this.filters = filters
		this.name = name
		this.parentID = parentID
		this.connection = connection
	}

	// when applies a when condition to a new list pointing to the same spot
	when(when?: ListWhen): ListHandler {
		return new ListHandler({
			cache: this.cache,
			record: this.record,
			key: this.key,
			listType: this.listType,
			selection: this.selection,
			when,
			filters: this.filters,
			parentID: this.parentID,
			name: this.name,
			connection: this.connection,
		})
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
		// figure out the id of the type we are adding
		const dataID = this.cache.id(this.listType, data)

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
									type: this.listType,
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
					edges: [{ node: { ...data, __typename: this.listType } }],
				},
			}
		} else {
			insertSelection = {
				newEntries: {
					keyRaw: this.key,
					type: this.listType,
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
				newEntries: [{ ...data, __typename: this.listType }],
			}
		}

		// get the list of specs that are subscribing to the list
		const subscribers = this.record.getSubscribers(this.key)

		// look up the new record in the cache
		const newRecord = this.cache.internal.record(dataID)

		// add the list reference
		newRecord.addListReference({
			parentID: this.parentID,
			name: this.name,
		})

		// walk down the list fields relative to the new record
		// and make sure all of the list's subscribers are listening
		// to that object
		this.cache.internal.insertSubscribers(newRecord, selection, variables, ...subscribers)

		// update the cache with the data we just found
		this.cache.write({
			selection: insertSelection,
			data: insertData,
			variables,
			parent: this.record.id,
			applyUpdates: true,
		})
	}

	removeID(id: string, variables: {} = {}) {
		// if there are conditions for this operation
		if (!this.validateWhen()) {
			return
		}

		// add the record we just created to the list
		this.record.removeFromLinkedList(this.key, id)

		// get the list of specs that are subscribing to the list
		const subscribers = this.record.getSubscribers(this.key)

		// notify the subscribers about the change
		this.cache.internal.notifySubscribers(subscribers, variables)

		// disconnect record from any subscriptions associated with the list
		this.cache.internal.unsubscribeSelection(
			this.cache.internal.record(id),
			this.selection,
			variables,
			...subscribers.map(({ set }) => set)
		)
	}

	remove(data: {}, variables: {} = {}) {
		const targetID = this.cache.id(this.listType, data)
		if (!targetID) {
			return
		}

		// figure out the id of the type we are adding
		this.removeID(targetID, variables)
	}

	private validateWhen() {
		// if this when doesn't apply, we should look at others to see if we should update those behind the scenes

		let ok = true
		// if there are conditions for this operation
		if (this._when) {
			// we only NEED there to be target filters for must's
			const targets = this.filters

			// check must's first
			if (this._when.must && targets) {
				ok = Object.entries(this._when.must).reduce<boolean>(
					(prev, [key, value]) => Boolean(prev && targets[key] == value),
					ok
				)
			}
			// if there are no targets, nothing could be true that can we compare against
			if (this._when.must_not) {
				ok =
					!targets ||
					Object.entries(this._when.must_not).reduce<boolean>(
						(prev, [key, value]) => Boolean(prev && targets[key] != value),
						ok
					)
			}
		}

		return ok
	}

	// iterating over the list handler should be the same as iterating over
	// the underlying linked list
	*[Symbol.iterator]() {
		for (let record of this.record.linkedList(this.key)) {
			yield record
		}
	}
}
