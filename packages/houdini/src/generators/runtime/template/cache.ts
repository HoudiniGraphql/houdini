// local imports
import { Maybe, TypeLinks, GraphQLValue, SubscriptionSelection } from './types'

// this file holds the implementation (and singleton) for the cache that drives
// houdini queries
export class Cache {
	// the map from entity id to record
	_data: Map<string, Record> = new Map()

	// save the response
	write({ rootType, fields }: TypeLinks, data: { [key: string]: GraphQLValue }, variables: {}) {
		const specs: SubscriptionSpec[] = []

		// recursively walk down the payload and update the store. calls to update atomic fields
		// will build up different specs of subscriptions that need to be run against the current state
		this._write(rootType, fields, '_root_', data, variables, specs)

		// compute new values for every spec that needs to be run
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

	subscribe(spec: SubscriptionSpec) {
		// find the root record
		let rootRecord = spec.parentID ? this.record(spec.parentID) : this.root()
		if (!rootRecord) {
			throw new Error('Could not find root of subscription')
		}

		// walk down the selection and register any subscribers
		this.addSubscribers(rootRecord, spec, spec.selection)
	}

	unsubscribe(spec: SubscriptionSpec) {
		// find the root record
		let rootRecord = spec.parentID ? this.record(spec.parentID) : this.root()
		if (!rootRecord) {
			throw new Error('Could not find root of subscription')
		}

		// walk down the selection and remove any subscribers from the list
		this.removeSubscribers(rootRecord, spec, spec.selection)
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
		selection: SubscriptionSelection
	) {
		for (const { type, key, fields } of Object.values(selection)) {
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

				// if we still dont have anything to attach it to then there's no one to subscribe to
				if (!children || !fields) {
					continue
				}

				// add the subscriber to every child
				for (const child of children) {
					this.addSubscribers(child, spec, fields)
				}
			}
		}
	}
	private removeSubscribers(
		rootRecord: Record,
		spec: SubscriptionSpec,
		selection: SubscriptionSelection
	) {
		for (const { type, key, fields } of Object.values(selection)) {
			// remove the subscriber to the field
			rootRecord.removeSubscribers(key, spec)

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
						this.record(oldID).removeSubscribers(linkedType.key, ...subscribers)
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
						this.record(lostID).removeSubscribers(linkedType.key, ...subscribers)
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
				if (linkedType.key !== 'id' && value !== record.getField(linkedType.key)) {
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

	// updates the record specified by {id}
	private record(id: string): Record {
		// if we haven't seen the record before add an entry in the store
		if (!this._data.has(id)) {
			this._data.set(id, new Record(this))
		}

		// write the field value
		return this._data.get(id) as Record
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

	addSubscriber(fieldName: string, spec: SubscriptionSpec) {
		this.subscribers[fieldName] = this.getSubscribers(fieldName).concat(spec)
	}

	getSubscribers(fieldName: string): SubscriptionSpec[] {
		return this.subscribers[fieldName] || []
	}

	removeSubscribers(fieldName: string, ...targets: SubscriptionSpec[]) {
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

type SubscriptionSpec = {
	rootType: string
	selection: SubscriptionSelection
	set: (data: any) => void
	parentID?: string
}

export default new Cache()
