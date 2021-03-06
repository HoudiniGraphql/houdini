// local imports
import { Maybe } from './types'

// this file holds the implementation (and singleton) for the cache that drives
// houdini queries
export class Cache {
	// the map from entity id to record
	_data: Map<string, Record> = new Map()

	// save the response
	write({ rootType, fields }: TypeLinks, data: { [key: string]: GraphQLValue }, variables: {}) {
		// recursively walk down the payload and update the store
		this._write(rootType, fields, '_root_', data, variables)
	}

	// look up the information for a specific record
	get(id: string): Maybe<Record> {
		return this._data.get(id) || null
	}

	// returns the global id of the specified field (used to access the record in the cache)
	id(type: string, data: { id?: string } | null) {
		if (!data) {
			throw new Error('Cannot compute id of null')
		}

		return type + ':' + (data.id || '_root_')
	}

	private _write(
		typeName: string,
		typeLinks: TypeLinks['fields'],
		parentID: string,
		data: { [key: string]: GraphQLValue },
		variables: {}
	) {
		// the record we are storing information about this object
		const record = this._record(parentID)

		// look at ever field in the data
		for (const [field, value] of Object.entries(data)) {
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
				this._write(linkedType.type, typeLinks, linkedID, value, variables)
			}

			// the value could be a list
			else if (!isScalarLink(linkedType.type) && Array.isArray(value)) {
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
					this._write(linkedType.type, typeLinks, linkedID, entry, variables)

					// add the id to the list
					linkedIDs.push(linkedID)
				}

				// update the cached value
				record.writeListLink(linkedType.key, linkedIDs)
			}

			// the value is neither an object or a list so its a scalar
			else {
				record.writeField(linkedType.key, value)
			}
		}
	}

	// updates the record specified by {id}
	private _record(id: string): Record {
		// if we haven't seen the record before add an entry in the store
		if (!this._data.has(id)) {
			this._data.set(id, new Record(this))
		}

		// write the field value
		return this._data.get(id) as Record
	}
}

class Record {
	fields: { [key: string]: GraphQLValue } = {}

	private recordLinks: { [key: string]: string } = {}
	private listLinks: { [key: string]: string[] } = {}
	private cache: Cache

	constructor(cache: Cache) {
		this.cache = cache
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
}

function isScalarLink(type: string) {
	return ['String', 'Boolean', 'Float', 'ID', 'Int'].includes(type)
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

export default new Cache()
