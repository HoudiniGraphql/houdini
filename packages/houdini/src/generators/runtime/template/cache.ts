// local imports
import { subscribe } from 'graphql'
import { connections } from '../../../transforms'
import { Maybe, TypeLinks, GraphQLValue, SubscriptionSelection } from './types'

// this file holds the implementation (and singleton) for the cache that drives
// houdini queries
export class Cache {
	// the map from entity id to record
	private _data: Map<string, Record> = new Map()
	// associate connection names with the handler that wraps the list
	private _connections: Map<string, Map<string | undefined, ConnectionHandler>> = new Map()

	// save the response in the local store and notify any subscribers
	write(
		{ rootType, fields }: TypeLinks,
		data: { [key: string]: GraphQLValue },
		variables: {},
		parentID = '_root_'
	) {
		const specs: SubscriptionSpec[] = []

		// recursively walk down the payload and update the store. calls to update atomic fields
		// will build up different specs of subscriptions that need to be run against the current state
		this._write(rootType, fields, parentID, data, variables, specs)

		// compute new values for every spec that needs to be run
		this.notifySubscribers(specs)
	}

	// look up the information for a specific record
	get(id: string): Maybe<Record> {
		if (!id) {
			return null
		}

		return this._data.get(id) || null
	}

	// returns the global id of the specified field (used to access the record in the cache)
	id(type: string, data: { id?: string } | null) {
		if (!data) {
			throw new Error('Cannot compute id of null')
		}

		return type + ':' + (data.id || '_root_')
	}

	// returns the list of fields required to compute the id for a type
	idFields(type: string) {
		return [{ name: 'id', type: 'ID' }]
	}

	subscribe(spec: SubscriptionSpec, variables: {} = {}) {
		// find the root record
		let rootRecord = spec.parentID ? this.record(spec.parentID) : this.root()
		if (!rootRecord) {
			throw new Error('Could not find root of subscription')
		}

		// walk down the selection and register any subscribers
		this.addSubscribers(rootRecord, spec, spec.selection, spec.rootType, variables)
	}

	unsubscribe(spec: SubscriptionSpec, variables: {} = {}) {
		// find the root record
		let rootRecord = spec.parentID ? this.record(spec.parentID) : this.root()
		if (!rootRecord) {
			throw new Error('Could not find root of subscription')
		}

		// walk down the selection and remove any subscribers from the list
		this.removeSubscribers(rootRecord, spec, spec.selection)
	}

	// get the connection handler associated by name
	connection(name: string, id?: string) {
		// make sure that the handler exists
		if (!this._connections.has(name) || !this._connections.get(name)?.get(id)) {
			throw new Error(
				`Cannot find connection with name: ${name} under parent: ${id}. ` +
					'Is it possible that the query has not fired yet? '
			)
		}

		// return the handler
		return this._connections.get(name)?.get(id)
	}

	notifySubscribers(specs: SubscriptionSpec[], variables: {} = {}) {
		for (const spec of specs) {
			// find the root record
			let rootRecord = spec.parentID ? this.get(spec.parentID) : this.root()
			if (!rootRecord) {
				throw new Error('Could not find root of subscription')
			}

			// trigger the update
			spec.set(this.getData(spec, rootRecord, spec.selection))
		}
	}

	// walk down the spec
	private getData(
		spec: SubscriptionSpec,
		parent: Record,
		selection: SubscriptionSelection
	): { [key: string]: GraphQLValue } {
		const target: { [key: string]: GraphQLValue } = {}
		// look at every field in the parentFields
		for (const [attributeName, { type, key, fields }] of Object.entries(selection)) {
			// if we are looking at a scalar
			if (this.isScalarLink(type)) {
				target[attributeName] = parent.getField(key)
				continue
			}

			// if the link points to a record then we just have to add it to the one
			const linkedRecord = parent.linkedRecord(key)
			// if the field does point to a linked record
			if (linkedRecord && fields) {
				target[attributeName] = this.getData(spec, linkedRecord, fields)
				continue
			}

			// if the link points to a list
			const linkedList = parent.linkedList(key)
			if (linkedList && fields) {
				target[attributeName] = linkedList.map((linkedRecord) =>
					this.getData(spec, linkedRecord, fields)
				)
			}
		}

		return target
	}

	private addSubscribers(
		rootRecord: Record,
		spec: SubscriptionSpec,
		selection: SubscriptionSelection,
		parentType: string,
		variables: {}
	) {
		for (const { type, key, fields, connection } of Object.values(selection)) {
			// add the subscriber to the field
			rootRecord.addSubscriber(key, spec)

			// if the field points to a link, we need to subscribe to any fields of that
			// linked record
			if (!this.isScalarLink(type)) {
				// if the link points to a record then we just have to add it to the one
				const linkedRecord = rootRecord.linkedRecord(key)
				let children = linkedRecord ? [linkedRecord] : null
				if (!children) {
					children = rootRecord.linkedList(key)
				}

				// if this field is marked as a connection, register it
				if (connection && fields) {
					// if we haven't seen this connection before
					if (!this._connections.has(connection)) {
						this._connections.set(connection, new Map())
					}

					// if we haven't already seen this connection handler
					this._connections.get(connection)?.set(
						spec.parentID ? spec.parentID : undefined,
						new ConnectionHandler({
							cache: this,
							record: rootRecord,
							connectionType: type,
							key,
							selection: fields,
						})
					)
				}

				// if we still dont have anything to attach it to then there's no one to subscribe to
				if (!children || !fields) {
					continue
				}

				// add the subscriber to every child
				for (const child of children) {
					this.addSubscribers(child, spec, fields, type, variables)
				}
			}
		}
	}
	private removeSubscribers(
		rootRecord: Record,
		spec: SubscriptionSpec,
		selection: SubscriptionSelection
	) {
		for (const { type, key, fields, connection } of Object.values(selection)) {
			// remove the subscriber to the field
			rootRecord.removeSubscribers(spec)

			// if this field is marked as a connection remove it from teh cache
			if (connection) {
				this._connections.delete(connection)
			}

			// if the field points to a link, we need to remove any subscribers on any fields of that
			// linked record
			if (!this.isScalarLink(type)) {
				// if the link points to a record then we just have to remove it to the one
				const linkedRecord = rootRecord.linkedRecord(key)
				let children = linkedRecord ? [linkedRecord] : null
				if (!children) {
					children = rootRecord.linkedList(key)
				}

				// if we still dont have anything to attach it to then there's no one to subscribe to
				if (!children || !fields) {
					continue
				}

				// remove the subscriber to every child
				for (const child of children) {
					this.removeSubscribers(child, spec, fields)
				}
			}
		}
	}

	private _write(
		typeName: string,
		typeLinks: TypeLinks['fields'],
		parentID: string,
		data: { [key: string]: GraphQLValue },
		variables: {},
		specs: SubscriptionSpec[]
	) {
		// the record we are storing information about this object
		const record = this.record(parentID)

		// look at ever field in the data
		for (const [field, value] of Object.entries(data)) {
			// look up the field in our schema
			const linkedType = typeLinks[typeName] && typeLinks[typeName][field]
			// make sure we found the type info
			if (!linkedType) {
				throw new Error(
					'could not find the field information for ' + typeName + '.' + field
				)
			}

			// the subscribers we need to register if we updated something
			const subscribers = record.getSubscribers(linkedType.key)

			// if the value is an object, we know it points to a linked record
			if (value instanceof Object && !Array.isArray(value)) {
				// look up the current known link id
				const oldID = record.linkedRecordID(linkedType.key)

				// figure out the id of the new linked record
				const linkedID = this.id(linkedType.type, value)

				// if we are now linked to a new object we need to record the new value
				if (oldID !== linkedID) {
					// record the updated value
					record.writeRecordLink(linkedType.key, linkedID)

					// if there was a record we replaced
					if (oldID) {
						// we need to remove any subscribers that we just added to the specs
						this.record(oldID).removeSubscribers(...subscribers)
					}

					// add every subscriber to the list of specs to change
					specs.push(...subscribers)
				}

				// update the linked fields too
				this._write(linkedType.type, typeLinks, linkedID, value, variables, specs)
			}

			// the value could be a list
			else if (!this.isScalarLink(linkedType.type) && Array.isArray(value)) {
				// build up the list of linked ids
				const linkedIDs: string[] = []
				// look up the current known link id
				const oldIDs = record.linkedListIDs(linkedType.key)

				// visit every entry in the list
				for (const entry of value) {
					// this has to be an object for sanity sake (it can't be a link if its a scalar)
					if (!(entry instanceof Object) || Array.isArray(entry)) {
						throw new Error('Encountered link to non objects')
					}

					// figure out the linked id
					const linkedID = this.id(linkedType.type, entry)

					// update the linked fields too
					this._write(linkedType.type, typeLinks, linkedID, entry, variables, specs)

					// add the id to the list
					linkedIDs.push(linkedID)
				}

				// if there was a change in the list
				if (JSON.stringify(linkedIDs) !== JSON.stringify(oldIDs)) {
					// look for any records that we don't consider part of this link any more
					for (const lostID of oldIDs.filter((id) => !linkedIDs.includes(id))) {
						this.record(lostID).removeSubscribers(...subscribers)
					}

					// add every subscriber to the list of specs to change
					specs.push(...subscribers)

					// update the cached value
					record.writeListLink(linkedType.key, linkedIDs)
				}
			}

			// the value is neither an object or a list so its a scalar
			else {
				// if the value is different
				if (value !== record.getField(linkedType.key)) {
					// update the cached value
					record.writeField(linkedType.key, value)

					// add every subscriber to the list of specs to change
					specs.push(...subscribers)
				}
			}
		}
	}

	root(): Record {
		return this.record('_root_')
	}

	// grab the record specified by {id}
	record(id: string): Record {
		// if we haven't seen the record before add an entry in the store
		if (!this._data.has(id)) {
			this._data.set(id, new Record(this))
		}

		// write the field value
		return this._data.get(id) as Record
	}

	insertSubscribers(
		record: Record,
		selection: SubscriptionSelection,
		...subscribers: SubscriptionSpec[]
	) {
		// look at every field in the selection and add the subscribers
		for (const { key, fields } of Object.values(selection)) {
			// add the subscriber to the
			record.addSubscriber(key, ...subscribers)

			// if there are fields under this
			if (fields) {
				// figure out who else needs subscribers
				const children = record.linkedList(key) || [record.linkedRecord(key)]
				for (const linkedRecord of children) {
					this.insertSubscribers(linkedRecord, fields, ...subscribers)
				}
			}
		}
	}

	unsubscribeRecord(
		record: Record,
		selection: SubscriptionSelection,
		...subscribers: SubscriptionSpec[]
	) {
		// look at every field in the selection and add the subscribers
		for (const { key, fields } of Object.values(selection)) {
			// add the subscriber to the
			record.removeSubscribers(...subscribers)

			// if there are fields under this
			if (fields) {
				// figure out who else needs subscribers
				const children = record.linkedList(key) || [record.linkedRecord(key)]
				for (const linkedRecord of children) {
					this.unsubscribeRecord(linkedRecord, fields, ...subscribers)
				}
			}
		}
	}

	private isScalarLink(type: string) {
		return ['String', 'Boolean', 'Float', 'ID', 'Int'].includes(type)
	}
}

class Record {
	fields: { [key: string]: GraphQLValue } = {}

	private subscribers: { [key: string]: SubscriptionSpec[] } = {}
	private recordLinks: { [key: string]: string } = {}
	private listLinks: { [key: string]: string[] } = {}
	private cache: Cache

	constructor(cache: Cache) {
		this.cache = cache
	}

	getField(fieldName: string): GraphQLValue {
		return this.fields[fieldName]
	}

	writeField(fieldName: string, value: GraphQLValue) {
		this.fields[fieldName] = value
	}

	writeRecordLink(fieldName: string, value: string) {
		this.recordLinks[fieldName] = value
	}

	writeListLink(fieldName: string, value: string[]) {
		this.listLinks[fieldName] = value
	}

	linkedRecord(fieldName: string) {
		return this.cache.get(this.recordLinks[fieldName])
	}

	linkedRecordID(fieldName: string) {
		return this.recordLinks[fieldName]
	}

	linkedListIDs(fieldName: string): string[] {
		return this.listLinks[fieldName] || []
	}

	linkedList(fieldName: string): Record[] {
		return (this.listLinks[fieldName] || [])
			.map((link) => this.cache.get(link))
			.filter((record) => record !== null) as Record[]
	}

	addToLinkedList(fieldName: string, id: string) {
		this.listLinks[fieldName].push(id)
	}

	removeFromLinkedList(fieldName: string, id: string) {
		this.listLinks[fieldName] = this.listLinks[fieldName].filter((link) => link !== id)
	}

	addSubscriber(fieldName: string, ...specs: SubscriptionSpec[]) {
		// the existing list
		const existingSubscribers = (this.subscribers[fieldName] || []).map(({ set }) => set)
		// the list of new subscribers
		const newSubscribers = specs.filter(({ set }) => !existingSubscribers.includes(set))

		this.subscribers[fieldName] = this.getSubscribers(fieldName).concat(...newSubscribers)
	}

	getSubscribers(fieldName: string): SubscriptionSpec[] {
		return this.subscribers[fieldName] || []
	}

	removeSubscribers(...targets: SubscriptionSpec[]) {
		this._removeSubscribers(targets.map(({ set }) => set))
	}

	_removeSubscribers(targets: SubscriptionSpec['set'][]) {
		// clean up any subscribers that reference the set
		for (const fieldName of Object.keys(this.subscribers)) {
			this.subscribers[fieldName] = this.getSubscribers(fieldName).filter(
				({ set }) => !targets.includes(set)
			)
		}

		// build up a list of every record we know about
		const linkedIDs = Object.keys(this.recordLinks).concat(
			Object.keys(this.listLinks).flatMap((key) => this.listLinks[key])
		)

		// look at any links and do the same
		for (const linkedRecordID of linkedIDs) {
			this.cache.get(linkedRecordID)?._removeSubscribers(targets)
		}
	}
}

class ConnectionHandler {
	private record: Record
	private key: string
	private connectionType: string
	private cache: Cache
	private selection: SubscriptionSelection

	constructor({
		cache,
		record,
		key,
		connectionType,
		selection,
	}: {
		cache: Cache
		record: Record
		key: string
		connectionType: string
		selection: SubscriptionSelection
	}) {
		this.record = record
		this.key = key
		this.connectionType = connectionType
		this.cache = cache
		this.selection = selection
	}

	append({ fields }: TypeLinks, data: {}, variables: {} = {}) {
		// figure out the id of the type we are adding
		const dataID = this.cache.id(this.connectionType, data)

		// update the cache with the data we just found
		this.cache.write(
			{
				rootType: this.connectionType,
				fields,
			},
			data,
			variables,
			dataID
		)

		// add the record we just created to the list
		this.record.addToLinkedList(this.key, dataID)

		// get the list of specs that are subscribing to the connection
		const subscribers = this.record.getSubscribers(this.key)

		// notify the subscribers we care about
		this.cache.notifySubscribers(subscribers)

		// walk down the connection fields relative to the new record
		// and make sure all of the connection's subscribers are listening
		// to that object
		this.cache.insertSubscribers(this.cache.record(dataID), this.selection, ...subscribers)
	}

	remove(data: {}, variables: {} = {}) {
		// figure out the id of the type we are adding
		const dataID = this.cache.id(this.connectionType, data)

		// add the record we just created to the list
		this.record.removeFromLinkedList(this.key, dataID)

		// get the list of specs that are subscribing to the connection
		const subscribers = this.record.getSubscribers(this.key)

		// notify the subscribers we care about
		this.cache.notifySubscribers(subscribers)

		// disconnect the record we removed from the connection's subscribers
		this.cache.unsubscribeRecord(this.cache.record(dataID), this.selection, ...subscribers)
	}
}

type SubscriptionSpec = {
	rootType: string
	selection: SubscriptionSelection
	set: (data: any) => void
	parentID?: string
}

export default new Cache()
