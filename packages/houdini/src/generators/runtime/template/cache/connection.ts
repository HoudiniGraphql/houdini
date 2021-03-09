// local imports
import { SubscriptionSelection, ConnectionWhen, SubscriptionSpec } from '../types'
import { Cache } from './cache'
import { Record } from './record'

export class ConnectionHandler {
	readonly record: Record
	readonly key: string
	readonly connectionType: string
	private cache: Cache
	readonly selection: SubscriptionSelection
	private _when?: ConnectionWhen
	private filters?: { [key: string]: number | boolean | string }
	readonly name: string
	readonly parentID: SubscriptionSpec['parentID']

	constructor({
		name,
		cache,
		record,
		key,
		connectionType,
		selection,
		when,
		filters,
		parentID,
	}: {
		name: string
		cache: Cache
		record: Record
		key: string
		connectionType: string
		selection: SubscriptionSelection
		when?: ConnectionWhen
		filters?: ConnectionHandler['filters']
		parentID?: SubscriptionSpec['parentID']
	}) {
		this.record = record
		this.key = key
		this.connectionType = connectionType
		this.cache = cache
		this.selection = selection
		this._when = when
		this.filters = filters
		this.name = name
		this.parentID = parentID
	}

	// when applies a when condition to a new connection pointing to the same spot
	when(when?: ConnectionWhen): ConnectionHandler {
		return new ConnectionHandler({
			cache: this.cache,
			record: this.record,
			key: this.key,
			connectionType: this.connectionType,
			selection: this.selection,
			when,
			filters: this.filters,
			parentID: this.parentID,
			name: this.name,
		})
	}

	append(selection: SubscriptionSelection, data: {}, variables: {} = {}) {
		return this.addToConnection(selection, data, variables, 'last')
	}

	prepend(selection: SubscriptionSelection, data: {}, variables: {} = {}) {
		return this.addToConnection(selection, data, variables, 'first')
	}

	addToConnection(
		selection: SubscriptionSelection,
		data: {},
		variables: {} = {},
		where: 'first' | 'last'
	) {
		// if there are conditions for this operation
		if (!this.validateWhen()) {
			return
		}
		// figure out the id of the type we are adding
		const dataID = this.cache.id(this.connectionType, data)

		// update the cache with the data we just found
		this.cache.write(selection, data, variables, dataID)

		if (where === 'first') {
			// add the record we just created to the list
			this.record.prependLinkedList(this.key, dataID)
		} else {
			// add the record we just created to the list
			this.record.appendLinkedList(this.key, dataID)
		}

		// get the list of specs that are subscribing to the connection
		const subscribers = this.record.getSubscribers(this.key)

		// notify the subscribers we care about
		this.cache.internal.notifySubscribers(subscribers, variables)

		// look up the new record in the cache
		const newRecord = this.cache.internal.record(dataID)

		// add the connection reference
		newRecord.addConnectionReference({
			parentID: this.parentID,
			name: this.name,
		})

		// walk down the connection fields relative to the new record
		// and make sure all of the connection's subscribers are listening
		// to that object
		this.cache.internal.insertSubscribers(newRecord, this.selection, variables, ...subscribers)
	}

	removeID(id: string, variables: {} = {}) {
		// if there are conditions for this operation
		if (!this.validateWhen()) {
			return
		}

		// add the record we just created to the list
		this.record.removeFromLinkedList(this.key, id)

		// get the list of specs that are subscribing to the connection
		const subscribers = this.record.getSubscribers(this.key)

		// notify the subscribers about the change
		this.cache.internal.notifySubscribers(subscribers, variables)

		// disconnect record from any subscriptions associated with the connection
		this.cache.internal.unsubscribeSelection(
			this.cache.internal.record(id),
			this.selection,
			variables,
			...subscribers.map(({ set }) => set)
		)
	}

	remove(data: {}, variables: {} = {}) {
		// figure out the id of the type we are adding
		this.removeID(this.cache.id(this.connectionType, data), variables)
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

	// iterating over the connection handler should be the same as iterating over
	// the underlying linked list
	*[Symbol.iterator]() {
		for (let record of this.record.linkedList(this.key)) {
			yield record
		}
	}
}
