// local imports
import { Maybe } from './types'

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
			// look up the fields of the parent
			const parentFields = spec.selection.fields[spec.selection.rootType]
			// find the root record
			let rootRecord = spec.parentID ? this.get(spec.parentID) : this.root()
			if (!rootRecord) {
				throw new Error('Could not find root of subscription')
			}

			const result = this.getData(spec, rootRecord, parentFields)

			// trigger the update
			spec.set(result)
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
		this.addSubscribers(rootRecord, spec, spec.selection.fields[spec.selection.rootType])
	}

	unsubscribe(spec: SubscriptionSpec) {
		// find the root record
		let rootRecord = spec.parentID ? this.record(spec.parentID) : this.root()
		if (!rootRecord) {
			throw new Error('Could not find root of subscription')
		}

		// walk down the selection and remove any subscribers from the list
		this.removeSubscribers(rootRecord, spec, spec.selection.fields[spec.selection.rootType])
	}

	// walk down the spec
	private getData(
		spec: SubscriptionSpec,
		parent: Record,
		parentFields: LinkInfo
	): { [key: string]: GraphQLValue } {
		const target: { [key: string]: GraphQLValue } = {}
		// look at every field in the parentFields
		for (const [attributeName, { type, key }] of Object.entries(parentFields)) {
			// if we are looking at a scalar
			if (this.isScalarLink(type)) {
				target[attributeName] = parent.getField(key)
				continue
			}

			// if the link points to a record then we just have to add it to the one
			const linkedRecord = parent.linkedRecord(key)
			// if the field does point to a linked record
			if (linkedRecord) {
				target[attributeName] = this.getData(
					spec,
					linkedRecord,
					spec.selection.fields[type]
				)
				continue
			}

			// if the link points to a list
			const linkedList = parent.linkedList(key)
			if (linkedList) {
				target[attributeName] = linkedList.map((linkedRecord) =>
					this.getData(spec, linkedRecord, spec.selection.fields[type])
				)
			}
		}

		return target
	}

	private addSubscribers(rootRecord: Record, spec: SubscriptionSpec, fields: LinkInfo) {
		for (const { type, key } of Object.values(fields)) {
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
				if (!children) {
					continue
				}

				// add the subscriber to every child
				for (const child of children) {
					this.addSubscribers(child, spec, spec.selection.fields[type])
				}
			}
		}
	}
	private removeSubscribers(rootRecord: Record, spec: SubscriptionSpec, fields: LinkInfo) {
		for (const { type, key } of Object.values(fields)) {
			// remove the subscriber to the field
			rootRecord.removeSubscriber(key, spec)

			// if the field points to a link, we need to subscribe to any fields of that
			// linked record
			if (!this.isScalarLink(type)) {
				// if the link points to a record then we just have to remove it to the one
				const linkedRecord = rootRecord.linkedRecord(key)
				let children = linkedRecord ? [linkedRecord] : null
				if (!children) {
					children = rootRecord.linkedList(key)
				}

				// if we still dont have anything to attach it to then there's no one to subscribe to
				if (!children) {
					continue
				}

				// remove the subscriber to every child
				for (const child of children) {
					this.removeSubscribers(child, spec, spec.selection.fields[type])
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

			// if the field shows up in the type info, we know its a link
			// otherwise we can treat it like a field
			// only write the link if its an object, not a list
			if (value instanceof Object && !Array.isArray(value)) {
				// figure out the id of the linked record
				const linkedID = this.id(linkedType.type, value)

				// record the updated value
				record.writeRecordLink(linkedType.key, linkedID)

				// update the linked fields too
				this._write(linkedType.type, typeLinks, linkedID, value, variables, specs)
			}

			// the value could be a list
			else if (!this.isScalarLink(linkedType.type) && Array.isArray(value)) {
				// build up the list of linked ids
				const linkedIDs = []

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

				// update the cached value
				record.writeListLink(linkedType.key, linkedIDs)
			}

			// the value is neither an object or a list so its a scalar
			else {
				// if the value is different
				if (linkedType.key !== 'id' && value !== record.getField(linkedType.key)) {
					// update the cached value
					record.writeField(linkedType.key, value)

					// add every subscriber to the list of specs to change
					specs.push(...record.getSubscribers(linkedType.key))
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

	removeSubscriber(fieldName: string, target: SubscriptionSpec) {
		this.subscribers[fieldName] = this.getSubscribers(fieldName).filter(
			({ set }) => set !== target.set
		)
	}
}

type GraphQLValue =
	| number
	| string
	| boolean
	| null
	| { [key: string]: GraphQLValue }
	| GraphQLValue[]

type LinkInfo = { [fieldName: string]: { key: string; type: string } }

export type TypeLinks = {
	rootType: string
	fields: { [typeName: string]: LinkInfo }
}

type SubscriptionSpec = {
	selection: TypeLinks
	set: (data: any) => void
	parentID?: string
}

export default new Cache()
