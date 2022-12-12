import { Cache, rootID } from '../cache/cache'
import { SchemaManager } from '../cache/schema'
import { RecordProxy } from './record'
import type { CacheTypeDef, IDFields, TypeNames } from './types'

export class CacheProxy<Def extends CacheTypeDef> {
	_internal_unstable: Cache

	constructor(cache: Cache) {
		this._internal_unstable = cache
	}

	// if the user is using the imperative API, we want the ability to break the API
	// with any minor version. In order to do this, we require them to accept this contract
	// through their config file
	validateInstabilityWarning() {
		if (!this.config.acceptImperativeInstability) {
			console.warn(`⚠️  The imperative cache API is considered unstable and will change in any minor version release
Please acknowledge this by setting acceptImperativeInstability to true in your config file.`)
		}
	}

	// if the user tries to assign a field type that we haven't seen before
	// then we need to provide a way for them to give us that information
	setFieldType(...args: Parameters<SchemaManager['setFieldType']>) {
		this.validateInstabilityWarning()
		this._internal_unstable._internal_unstable.schema.setFieldType(...args)
	}

	// return the root record
	get root(): RecordProxy<Def, '__ROOT__'> {
		this.validateInstabilityWarning()
		return new RecordProxy({
			cache: this,
			type: 'Query',
			id: rootID,
			idFields: {},
		})
	}

	// return the record proxy for the given type/id combo
	get<T extends TypeNames<Def>>(type: T, data: IDFields<Def, T>): RecordProxy<Def, T> {
		this.validateInstabilityWarning()

		// verify that

		// compute the id for the record
		let recordID = this._internal_unstable._internal_unstable.id(type, data)
		if (!recordID) {
			throw new Error('todo')
		}

		// return the proxy
		return new RecordProxy({
			cache: this,
			type: type,
			id: recordID,
			idFields: data,
		})
	}

	get config() {
		return this._internal_unstable._internal_unstable.config
	}
}
