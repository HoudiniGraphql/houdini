// local imports
import { Maybe, GraphQLValue, SubscriptionSelection, SubscriptionSpec } from './types'

// this file holds the implementation (and singleton) for the cache that drives
// houdini queries
export class Cache {
	// the map from entity id to record
	private _data: Map<string, Record> = new Map()
	// associate connection names with the handler that wraps the list
	private _connections: Map<string, Map<string | undefined, ConnectionHandler>> = new Map()

	// save the response in the local store and notify any subscribers
	write(
		selection: SubscriptionSelection,
		data: { [key: string]: GraphQLValue },
		variables: {},
		parentID = '_root_'
	) {
		const specs: SubscriptionSpec[] = []

		// recursively walk down the payload and update the store. calls to update atomic fields
		// will build up different specs of subscriptions that need to be run against the current state
		this._write(selection, parentID, data, variables, specs)

		// compute new values for every spec that needs to be run
		this.notifySubscribers(specs, variables)
	}

	// look up the information for a specific record
	get(id: string): Maybe<Record> {
		if (!id) {
			return null
		}

		return this._data.get(id) || null
	}

	// returns the global id of the specified field (used to access the record in the cache)
	id(type: string, data: { id?: string } | null): string
	// this is like id but it trusts the value used for the id and just joins it with the
	// type to form the global id
	id(type: string, id: string): string
	id(type: string, data: any): string {
		return type + ':' + (typeof data === 'string' ? data : data.id)
	}

	computeID(data: { [key: string]: GraphQLValue }) {
		return data.id
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
		this.addSubscribers(rootRecord, spec, spec.selection, variables)
	}

	unsubscribe(spec: SubscriptionSpec, variables: {} = {}) {
		// find the root record
		let rootRecord = spec.parentID ? this.record(spec.parentID) : this.root()
		if (!rootRecord) {
			throw new Error('Could not find root of subscription')
		}

		// walk down the selection and remove any subscribers from the list
		this.removeSubscribers(rootRecord, spec, spec.selection, variables)
	}

	// get the connection handler associated by name
	connection(name: string, id?: string): ConnectionHandler {
		// make sure that the handler exists
		const handler = this._connections.get(name)?.get(id)
		if (!handler) {
			throw new Error(
				`Cannot find connection with name: ${name} under parent: ${id}. ` +
					'Is it possible that the query is not mounted?'
			)
		}

		// return the handler
		return handler
	}

	notifySubscribers(specs: SubscriptionSpec[], variables: {} = {}) {
		for (const spec of specs) {
			// find the root record
			let rootRecord = spec.parentID ? this.get(spec.parentID) : this.root()
			if (!rootRecord) {
				throw new Error('Could not find root of subscription')
			}

			// trigger the update
			spec.set(this.getData(spec, rootRecord, spec.selection, variables))
		}
	}

	// remove the record from every connection we know of
	delete(id: string, variables: {} = {}) {
		const record = this.record(id)
		// visit every connection the record knows of
		for (const { name, parentID } of record.connections) {
			// remove the id from the connection
			this.connection(name, parentID)?.removeID(id, variables)
			record.removeConnectionReference({ name, parentID })
		}
	}

	// walk down the spec
	private getData(
		spec: SubscriptionSpec,
		parent: Record,
		selection: SubscriptionSelection,
		variables: {}
	): { [key: string]: GraphQLValue } {
		const target: { [key: string]: GraphQLValue } = {}
		// look at every field in the parentFields
		for (const [attributeName, { type, keyRaw, fields }] of Object.entries(selection)) {
			const key = this.evaluateKey(keyRaw, variables)

			// if we are looking at a scalar
			if (this.isScalarLink(type)) {
				target[attributeName] = parent.getField(key)
				continue
			}

			// if the link points to a record then we just have to add it to the one
			const linkedRecord = parent.linkedRecord(key)
			// if the field does point to a linked record
			if (linkedRecord && fields) {
				target[attributeName] = this.getData(spec, linkedRecord, fields, variables)
				continue
			}

			// if the link points to a list
			const linkedList = parent.linkedList(key)
			if (linkedList && fields) {
				target[attributeName] = linkedList.map((linkedRecord) =>
					this.getData(spec, linkedRecord, fields, variables)
				)
			}
		}

		return target
	}

	private addSubscribers(
		rootRecord: Record,
		spec: SubscriptionSpec,
		selection: SubscriptionSelection,
		variables: {}
	) {
		for (const { type, keyRaw, fields, connection } of Object.values(selection)) {
			const key = this.evaluateKey(keyRaw, variables)

			// we might be replace a subscriber on rootRecord becuase we have new variables
			// look at every version of the key and remove
			rootRecord.removeAllSubscriptionVerions(keyRaw, spec)

			// add the subscriber to the field
			rootRecord.addSubscriber(keyRaw, key, spec)

			// if the field points to a link, we need to subscribe to any fields of that
			// linked record
			if (!this.isScalarLink(type)) {
				// if the link points to a record then we just have to add it to the one
				const linkedRecord = rootRecord.linkedRecord(key)
				let children = linkedRecord ? [linkedRecord] : rootRecord.linkedList(key)

				// if this field is marked as a connection, register it
				if (connection && fields) {
					// if we haven't seen this connection before
					if (!this._connections.has(connection)) {
						this._connections.set(connection, new Map())
					}

					// if we haven't already registered a handler to this connection in the cache
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

				// if we're not related to anything, we're done
				if (!children || !fields) {
					continue
				}

				// add the subscriber to every child
				for (const child of children) {
					// the children of a connection need the reference back
					if (connection) {
						// add the connection reference to record
						child.addConnectionReference({
							name: connection,
							parentID: spec.parentID,
						})
					}

					// make sure the children update this subscription
					this.addSubscribers(child, spec, fields, variables)
				}
			}
		}
	}

	private removeSubscribers(
		rootRecord: Record,
		spec: SubscriptionSpec,
		selection: SubscriptionSelection,
		variables: {}
	) {
		for (const { type, keyRaw, fields, connection } of Object.values(selection)) {
			// figure out the actual key
			const key = this.evaluateKey(keyRaw, variables)

			// remove the subscriber to the field
			rootRecord.removeSubscribers(spec)

			// if this field is marked as a connection remove it from teh cache
			if (connection) {
				this._connections.delete(connection)
				rootRecord.removeConnectionReference({
					name: connection,
					parentID: spec.parentID,
				})
			}

			// if the field points to a link, we need to remove any subscribers on any fields of that
			// linked record
			if (!this.isScalarLink(type)) {
				// if the link points to a record then we just have to remove it to the one
				const linkedRecord = rootRecord.linkedRecord(key)
				let children = linkedRecord ? [linkedRecord] : rootRecord.linkedList(key)

				// if we still dont have anything to attach it to then there's no one to subscribe to
				if (!children || !fields) {
					continue
				}

				// remove the subscriber to every child
				for (const child of children) {
					this.removeSubscribers(child, spec, fields, variables)
				}
			}
		}
	}

	private _write(
		selection: SubscriptionSelection,
		parentID: string,
		data: { [key: string]: GraphQLValue },
		variables: { [key: string]: GraphQLValue },
		specs: SubscriptionSpec[]
	) {
		// the record we are storing information about this object
		const record = this.record(parentID)

		// look at ever field in the data
		for (const [field, value] of Object.entries(data)) {
			if (!selection[field]) {
				throw new Error(
					'Could not find field listing in selection for ' +
						field +
						' @ ' +
						JSON.stringify(selection)
				)
			}
			// look up the field in our schema
			const { type: linkedType, keyRaw, fields, operations } = selection[field]
			const key = this.evaluateKey(keyRaw, variables)
			// make sure we found the type info
			if (!linkedType) {
				throw new Error('could not find the field information for ' + field)
			}

			// the subscribers we need to register if we updated something
			const subscribers = record.getSubscribers(key)

			// if the value is an object, we know it points to a linked record
			if (value instanceof Object && !Array.isArray(value) && fields) {
				// look up the current known link id
				const oldID = record.linkedRecordID(key)

				// figure out the id of the new linked record
				const linkedID = this.id(linkedType, value)

				// if we are now linked to a new object we need to record the new value
				if (oldID !== linkedID) {
					// record the updated value
					record.writeRecordLink(key, linkedID)

					// if there was a record we replaced
					if (oldID) {
						// we need to remove any subscribers that we just added to the specs
						this.record(oldID).removeSubscribers(...subscribers)
					}

					// add every subscriber to the list of specs to change
					specs.push(...subscribers)
				}

				// update the linked fields too
				this._write(fields, linkedID, value, variables, specs)
			}

			// the value could be a list
			else if (!this.isScalarLink(linkedType) && Array.isArray(value) && fields) {
				// build up the list of linked ids
				const linkedIDs: string[] = []
				// look up the current known link id
				const oldIDs = record.linkedListIDs(key)

				// the ids that have been added since the last time
				const newIDs: string[] = []

				// visit every entry in the list
				for (const entry of value) {
					// this has to be an object for sanity sake (it can't be a link if its a scalar)
					if (!(entry instanceof Object) || Array.isArray(entry)) {
						throw new Error('Encountered link to non objects')
					}

					// figure out the linked id
					const linkedID = this.id(linkedType, entry)

					// update the linked fields too
					this._write(fields, linkedID, entry, variables, specs)

					// add the id to the list
					linkedIDs.push(linkedID)
					// hold onto the new ids
					if (!oldIDs.includes(linkedID)) {
						newIDs.push(linkedID)
					}
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
					record.writeListLink(key, linkedIDs)
				}
			}

			// the value is neither an object or a list so its a scalar
			else {
				// if the value is different
				if (value !== record.getField(key)) {
					// update the cached value
					record.writeField(key, value)

					// add every subscriber to the list of specs to change
					specs.push(...subscribers)
				}
			}

			// handle any operations relative to this node
			for (const operation of operations || []) {
				// turn the ID into something we can use
				let parentID: string | undefined
				if (operation.parentID) {
					// if its a normal scalar we can use the value directly
					if (operation.parentID.kind !== 'Variable') {
						parentID = operation.parentID.value
					} else {
						const value = variables[operation.parentID.value]
						if (typeof value !== 'string') {
							throw new Error('parentID value must be a string')
						}

						parentID = value
					}
				}

				// only insert an object into a connection if we're adding an object with fields
				if (
					operation.action === 'insert' &&
					value instanceof Object &&
					!Array.isArray(value) &&
					fields &&
					operation.connection
				) {
					this.connection(operation.connection, parentID).append(fields, value)
				}

				// only insert an object into a connection if we're adding an object with fields
				else if (
					operation.action === 'remove' &&
					value instanceof Object &&
					!Array.isArray(value) &&
					fields &&
					operation.connection
				) {
					this.connection(operation.connection, parentID).remove(value, variables)
				}

				// delete the operation if we have to
				else if (operation.action === 'delete' && operation.type) {
					if (typeof value !== 'string') {
						throw new Error('Cannot delete a record with a non-string ID')
					}

					this.delete(this.id(operation.type, value), variables)
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
		variables: {},
		...subscribers: SubscriptionSpec[]
	) {
		// look at every field in the selection and add the subscribers
		for (const { keyRaw, fields } of Object.values(selection)) {
			const key = this.evaluateKey(keyRaw, variables)

			// add the subscriber to the
			record.addSubscriber(keyRaw, key, ...subscribers)

			// if there are fields under this
			if (fields) {
				const linkedRecord = record.linkedRecord(key)
				// figure out who else needs subscribers
				const children = linkedRecord ? [linkedRecord] : record.linkedList(key)
				for (const linkedRecord of children) {
					this.insertSubscribers(linkedRecord, fields, variables, ...subscribers)
				}
			}
		}
	}

	unsubscribeRecord(
		record: Record,
		selection: SubscriptionSelection,
		variables: {},
		...subscribers: SubscriptionSpec[]
	) {
		// look at every field in the selection and add the subscribers
		for (const { keyRaw, fields } of Object.values(selection)) {
			const key = this.evaluateKey(keyRaw, variables)
			// add the subscriber to the
			record.removeSubscribers(...subscribers)

			// if there are fields under this
			if (fields) {
				// figure out who else needs subscribers
				const children = record.linkedList(key) || [record.linkedRecord(key)]
				for (const linkedRecord of children) {
					this.unsubscribeRecord(linkedRecord, fields, variables, ...subscribers)
				}
			}
		}
	}

	private isScalarLink(type: string) {
		return ['String', 'Boolean', 'Float', 'ID', 'Int'].includes(type)
	}

	evaluateKey(key: string, variables: { [key: string]: GraphQLValue } = {}): string {
		// accumulate the evaluated key
		let evaluated = ''
		// acumulate a variable name that we're evulating
		let varName = ''
		// some state to track if we are "in" a string
		let inString = false

		for (const char of key) {
			// if we are building up a variable
			if (varName) {
				// if we are looking at a valid variable character
				if (varChars.includes(char)) {
					// add it to the variable name
					varName += char
					continue
				}
				// we are at the end of a variable name so we
				// need to clean up and add before continuing with the string

				// look up the variable and add the result (varName starts with a $)
				const value = variables[varName.slice(1)]

				evaluated += value ? JSON.stringify(value) : 'undefined'

				// clear the variable name accumulator
				varName = ''
			}

			// if we are looking at the start of a variable
			if (char === '$' && !inString) {
				// start the acumulator
				varName = '$'

				// move along
				continue
			}

			// if we found a quote, invert the string state
			if (char === '"') {
				inString = !inString
			}

			// this isn't a special case, just add the letter to the value
			evaluated += char
		}

		return evaluated
	}
}

// the list of characters that make up a valid graphql variable name
const varChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789'

type Connection = {
	name: string
	parentID: string | undefined
}

class Record {
	fields: { [key: string]: GraphQLValue } = {}

	private keyVersions: { [key: string]: Set<string> } = {}
	private subscribers: { [key: string]: SubscriptionSpec[] } = {}
	private recordLinks: { [key: string]: string } = {}
	private listLinks: { [key: string]: string[] } = {}
	private cache: Cache
	connections: Connection[] = []

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
		// this could be the first time we've seen the list
		if (!this.listLinks[fieldName]) {
			this.listLinks[fieldName] = []
		}

		this.listLinks[fieldName].push(id)
	}

	removeFromLinkedList(fieldName: string, id: string) {
		this.listLinks[fieldName] = (this.listLinks[fieldName] || []).filter((link) => link !== id)
	}

	addSubscriber(rawKey: string, key: string, ...specs: SubscriptionSpec[]) {
		// if this is the first time we've seen the raw key
		if (!this.keyVersions[rawKey]) {
			this.keyVersions[rawKey] = new Set()
		}

		// add this verson of the key if we need to
		this.keyVersions[rawKey].add(key)

		// the existing list
		const existingSubscribers = (this.subscribers[key] || []).map(({ set }) => set)
		// the list of new subscribers
		const newSubscribers = specs.filter(({ set }) => !existingSubscribers.includes(set))

		this.subscribers[key] = this.getSubscribers(key).concat(...newSubscribers)
	}

	getSubscribers(fieldName: string): SubscriptionSpec[] {
		return this.subscribers[fieldName] || []
	}

	removeSubscribers(...targets: SubscriptionSpec[]) {
		this._removeSubscribers(targets.map(({ set }) => set))
	}

	addConnectionReference(ref: Connection) {
		this.connections.push(ref)
	}

	removeConnectionReference(ref: Connection) {
		this.connections = this.connections.filter(
			(conn) => !(conn.name === ref.name && conn.parentID === ref.parentID)
		)
	}

	removeAllSubscriptionVerions(keyRaw: string, spec: SubscriptionSpec) {
		// visit every version of the key we've seen and remove the spec from the list of subscribers
		for (const version of this.keyVersions[keyRaw] || []) {
			this.subscribers[version] = this.getSubscribers(version).filter(
				({ set }) => set !== spec.set
			)
		}
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
	readonly record: Record
	readonly key: string
	readonly connectionType: string
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

	append(selection: SubscriptionSelection, data: {}, variables: {} = {}) {
		// figure out the id of the type we are adding
		const dataID = this.cache.id(this.connectionType, data)

		// update the cache with the data we just found
		this.cache.write(selection, data, variables, dataID)

		// add the record we just created to the list
		this.record.addToLinkedList(this.key, dataID)

		// get the list of specs that are subscribing to the connection
		const subscribers = this.record.getSubscribers(this.key)

		// notify the subscribers we care about
		this.cache.notifySubscribers(subscribers)

		// walk down the connection fields relative to the new record
		// and make sure all of the connection's subscribers are listening
		// to that object
		this.cache.insertSubscribers(
			this.cache.record(dataID),
			this.selection,
			variables,
			...subscribers
		)
	}

	removeID(id: string, variables: {} = {}) {
		// add the record we just created to the list
		this.record.removeFromLinkedList(this.key, id)

		// get the list of specs that are subscribing to the connection
		const subscribers = this.record.getSubscribers(this.key)

		// notify the subscribers about the change
		this.cache.notifySubscribers(subscribers)

		// disconnect record from any subscriptions associated with the connection
		this.cache.unsubscribeRecord(
			this.cache.record(id),
			this.selection,
			variables,
			...subscribers
		)
	}

	remove(data: {}, variables: {} = {}) {
		// figure out the id of the type we are adding
		this.removeID(this.cache.id(this.connectionType, data), variables)
	}

	// iterating over the connection handler should be the same as iterating over
	// the underlying linked list
	*[Symbol.iterator]() {
		for (let record of this.record.linkedList(this.key)) {
			yield record
		}
	}
}

const localCache = new Cache()

if (global.window) {
	// @ts-ignore
	window.cache = localCache
}

export default localCache
