import { keyFieldsForType, SubscriptionSelection } from '../lib'
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
		return new RecordProxy({
			cache: this,
			type: 'Query',
			id: rootID,
			idFields: {},
		})
	}

	// return the record proxy for the given type/id combo
	get(type: string, data: any) {
		this.validateInstabilityWarning()

		// verify that

		// compute the id for the record
		let recordID = this._internal_unstable._internal_unstable.id(type, data)
		if (!recordID) {
			throw new Error('todo')
		}

		// return the proxy
		return new RecordProxy({ cache: this, type, id: recordID, idFields: data })
	}

	get config() {
		return this._internal_unstable._internal_unstable.config
	}
}

export class RecordProxy {
	private id: string
	private type: string
	private cache: CacheProxy
	private idFields: {}

	constructor({
		cache,
		type,
		id,
		idFields,
	}: {
		cache: CacheProxy
		type: string
		idFields: {}
		id: string
	}) {
		this.cache = cache
		this.id = id
		this.type = type
		this.idFields = idFields

		// make sure that we have all of the necessary fields for the id
		if (id !== rootID) {
			for (const key of keyFieldsForType(this.cache.config, type)) {
				if (!(key in idFields)) {
					throw new Error('Missing key in idFields: ' + key)
				}
			}
		}
	}

	set({ field, args, value }: { field: string; args?: any; value: any }): any {
		this.cache.validateInstabilityWarning()

		// compute the key for the field/args combo
		const key = this._computeKey({ field, args })
		// look up the type information for the field
		const typeInfo: Partial<Required<SubscriptionSelection>['fields'][string]> & TypeInfo =
			this._typeInfo(field)

		// if we are writing a scalar we need to look for a special marshal function
		if (!typeInfo.link) {
			// if the type has a special marshal function we need to call it
			const fnMarshal = this.cache.config.scalars?.[typeInfo.type]?.marshal
			if (fnMarshal) {
				value = fnMarshal(value)
			}
		}
		// we are writing a link so we need to add some information to the selection
		// as well as use the id fields for the value
		else if (value instanceof RecordProxy) {
			// look up the necessary fields to compute the key
			const keys = keyFieldsForType(this.cache.config, typeInfo.type)

			// add the
			typeInfo.selection = {
				fields: keys.reduce<{ [field: string]: { type: string; keyRaw: string } }>(
					(acc, key) => {
						// look up the type information for the key
						const keyInfo = this._typeInfo(key, typeInfo.type)

						return {
							...acc,
							[key]: {
								type: keyInfo.type,
								keyRaw: key,
							},
						}
					},
					{}
				),
			}

			// use the id fields as the value
			value = value.idFields
		} else {
			throw new Error('Value must be a RecordProxy if the field is a link to another record')
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

	get({ field, args }: { field: string; args?: any }): any {
		this.cache.validateInstabilityWarning()

		// compute the key for the field/args combo
		const key = this._computeKey({ field, args })
		// look up the type information for the field
		const typeInfo: Partial<Required<SubscriptionSelection>['fields'][string]> & TypeInfo =
			this._typeInfo(field)

		// if the field is a link we need to look up all of the fields necessary to compute the id
		if (typeInfo.link) {
			// look up the necessary fields to compute the key
			const keys = keyFieldsForType(this.cache.config, typeInfo.type)

			// add the keys to the selection
			typeInfo.selection = {
				fields: keys.reduce<{ [field: string]: { type: string; keyRaw: string } }>(
					(acc, key) => {
						// look up the type information for the key
						const keyInfo = this._typeInfo(key, typeInfo.type)

						return {
							...acc,
							[key]: {
								type: keyInfo.type,
								keyRaw: key,
							},
						}
					},
					{}
				),
			}
		}

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

		// if they asked for a scalar, just return the value
		if (!typeInfo.link) {
			return result.data?.[field]
		}

		// they asked for a link so we need to return a proxy to that record
		const idFields = result.data?.[field] || {}
		const linkedID = this.cache._internal_unstable._internal_unstable.id(
			typeInfo.type,
			idFields
		)
		if (!linkedID) {
			throw new Error('todo')
		}

		// return the proxy
		return new RecordProxy({
			cache: this.cache,
			type: typeInfo.type,
			id: linkedID,
			idFields,
		})
	}

	private _typeInfo(field: string, type: string = this.type): TypeInfo {
		const info = this.cache._internal_unstable._internal_unstable.schema.fieldType(type, field)

		if (!info) {
			throw new Error(
				`Unknown field: ${field}. Please provide type information using setFieldType().`
			)
		}

		return info
	}

	private _computeKey({ field, args }: { field: string; args?: {} }) {
		// TODO: the actual key logic uses graphql.print to properly serialize complex values
		return args && Object.values(args).length > 0
			? `${field}(${Object.entries(args)
					.map((entries) => entries.join(': '))
					.join(', ')})`
			: field
	}
}
