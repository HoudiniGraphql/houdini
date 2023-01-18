import type { ConfigFile } from '../lib/config'
import type { Cache } from './cache'
import { rootID } from './cache'

export type TypeInfo = {
	type: string
	nullable: boolean
	link: boolean
}

export class SchemaManager {
	cache: Cache

	// fundamentally the schema manager is responsible for tracking
	// the type information of every field for a given type in the schema
	fieldTypes: Record<string, Record<string, TypeInfo>> = {}

	constructor(cache: Cache) {
		this.cache = cache
	}

	setFieldType({
		parent,
		key,
		type,
		nullable = false,
		link,
	}: {
		parent: string
		key: string
		type: string
		nullable?: boolean
		link?: boolean
	}) {
		// convert the key into the field name
		let parensIndex = key.indexOf('(')
		if (parensIndex !== -1) {
			key = key.substring(0, parensIndex)
		}

		// convert the id into a type
		if (parent === rootID) {
			parent = 'Query'
		} else if (parent.includes(':')) {
			parent = parent.substring(0, parent.indexOf(':'))
		}

		// make sure there is a place to register the field information
		if (!this.fieldTypes[parent]) {
			this.fieldTypes[parent] = {}
		}

		// register the field information
		this.fieldTypes[parent][key] = {
			type,
			nullable,
			link: !!link,
		}
	}

	fieldType(type: string, field: string) {
		return this.fieldTypes[type]?.[field] || null
	}

	get config(): ConfigFile {
		return this.cache._internal_unstable.config
	}
}
