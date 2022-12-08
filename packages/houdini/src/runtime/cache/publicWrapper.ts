import { Cache, rootID } from './cache'
import { SchemaManager, TypeInfo } from './schema'

export class CacheProxy {
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
	get root(): RecordProxy {
		this.validateInstabilityWarning()
		return new RecordProxy(this, 'Query', rootID)
	}

	// return the record proxy for the given type/id combo
	get(type: string, data: any) {
		this.validateInstabilityWarning()
		return new RecordProxy(
			this,
			type,
			this._internal_unstable._internal_unstable.computeID(type, data)
		)
	}

	get config() {
		return this._internal_unstable._internal_unstable.config
	}
}

export class RecordProxy {
	private id: string
	private type: string
	private cache: CacheProxy

	constructor(cache: CacheProxy, type: string, id: string) {
		this.cache = cache
		this.id = id
		this.type = type
	}

	set({ field, args, value }: { field: string; args?: any; value: any }) {
		this.cache.validateInstabilityWarning()

		// compute the key for the field/args combo
		const key = this._computeKey({ field, args })
		// look up the type information for the field
		const typeInfo = this._typeInfo(field)

		// if the type has a special marshal function we need to call it
		const fnMarshal = this.cache.config.scalars?.[typeInfo.type]?.marshal
		if (fnMarshal) {
			value = fnMarshal(value)
		}

		// write the value to the cache by constructing the correct selection
		this.cache._internal_unstable.write({
			parent: this.id,
			selection: {
				[field]: {
					keyRaw: key,
					...typeInfo,
				},
			},
			data: {
				[field]: value,
			},
		})
	}

	get({ field, args }: { field: string; args?: any }) {
		this.cache.validateInstabilityWarning()

		// look up the type information for the field
		const typeInfo = this._typeInfo(field)
		// compute the key for the field/args combo
		const key = this._computeKey({ field, args })

		// get the value from the cache
		const result = this.cache._internal_unstable.read({
			parent: this.id,
			selection: {
				[field]: {
					keyRaw: key,
					...typeInfo,
				},
			},
		})

		return result.data?.[field]
	}

	private _typeInfo(field: string): TypeInfo {
		const info = this.cache._internal_unstable._internal_unstable.schema.fieldType(
			this.type,
			field
		)

		if (!info) {
			throw new Error(
				`Unknown field: ${field}. Please provide type information using setFieldType().`
			)
		}

		return info
	}

	private _computeKey({ field, args }: { field: string; args?: {} }) {
		return args && Object.values(args).length > 0
			? `${field}(${Object.entries(args)
					.map((entries) => entries.join(': '))
					.join(', ')})`
			: field
	}
}
