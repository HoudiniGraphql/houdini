import { keyFieldsForType, SubscriptionSelection } from '../lib'
import { Cache, rootID } from './cache'
import { SchemaManager, TypeInfo } from './schema'

type CacheTypeDef = {
	[typeName: string]: {
		idFields: {
			[fieldName: string]: any
		}
		fields: {
			[fieldName: string]: {
				args: any
				type: any
			}
		}
	}
}

// if the result of the field type is a {target: string} then the value of the field
// is a RecordProxy<Def, string>. Otherwise, just use the type in in the field map
type FieldType<
	Def extends CacheTypeDef,
	Type extends keyof Def,
	Field extends keyof Def[Type]['fields']
> = Def[Type]['fields'][Field]['type'] extends { target: infer Target }
	? RecordProxy<Def, Target extends string ? Target : never>
	: Def[Type]['fields'][Field]['type']

type ArgType<
	Def extends CacheTypeDef,
	Type extends keyof Def,
	Field extends keyof Def[Type]['fields']
> = Def[Type]['fields'][Field]['args']

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
	get<T extends keyof Def>(type: T, data: Def[T]['idFields']): RecordProxy<Def, T> {
		this.validateInstabilityWarning()

		// verify that

		// compute the id for the record
		let recordID = this._internal_unstable._internal_unstable.id(type as string, data)
		if (!recordID) {
			throw new Error('todo')
		}

		// return the proxy
		return new RecordProxy({
			cache: this,
			type: type as string,
			id: recordID,
			idFields: data,
		})
	}

	get config() {
		return this._internal_unstable._internal_unstable.config
	}
}

export class RecordProxy<Def extends CacheTypeDef, Type extends keyof Def> {
	private id: string
	private type: string
	private cache: CacheProxy<Def>
	private idFields: {}

	constructor({
		cache,
		type,
		id,
		idFields,
	}: {
		cache: CacheProxy<Def>
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

	set<Field extends keyof Def[Type]['fields']>({
		field,
		args,
		value,
	}: {
		field: Field extends string ? Field : never
		args?: ArgType<Def, Type, Field>
		value: FieldType<Def, Type, Field>
	}): void {
		this.cache.validateInstabilityWarning()

		// compute the key for the field/args combo
		const key = this._computeKey({ field, args })
		// look up the type information for the field
		const typeInfo: TypeInfoWithSelection = this._typeInfo(field)

		// the value we will set
		let newValue: any

		// if we are writing a scalar we need to look for a special marshal function
		if (!typeInfo.link) {
			// if the type has a special marshal function we need to call it
			const fnMarshal = this.cache.config.scalars?.[typeInfo.type]?.marshal
			if (fnMarshal) {
				newValue = fnMarshal(value)
			} else {
				newValue = value
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
			newValue = value.idFields
		} else {
			throw new Error('Value must be a RecordProxy if the field is a link to another record')
		}

		// reset the garbage collection status
		this.cache._internal_unstable._internal_unstable.lifetimes.resetLifetime(this.id, key)

		// write the value to the cache by constructing the correct selection
		this.cache._internal_unstable.write({
			parent: this.id,
			selection: {
				fields: {
					[field]: {
						keyRaw: key,
						...typeInfo,
					},
				},
			},
			data: {
				[field]: newValue,
			},
		})
	}

	get<Field extends keyof Def[Type]['fields']>({
		field,
		args,
	}: {
		field: Field extends string ? Field : never
		args?: ArgType<Def, Type, Field>
	}): FieldType<Def, Type, Field> {
		this.cache.validateInstabilityWarning()

		// compute the key for the field/args combo
		const key = this._computeKey({ field, args })
		// look up the type information for the field
		const typeInfo: TypeInfoWithSelection = this._typeInfo(field)

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
				fields: {
					[field]: {
						keyRaw: key,
						...typeInfo,
					},
				},
			},
		})

		// if they asked for a scalar, just return the value
		if (!typeInfo.link) {
			return result.data?.[field] as FieldType<Def, Type, Field>
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
		}) as FieldType<Def, Type, Field>
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

type TypeInfoWithSelection = Partial<Required<SubscriptionSelection>['fields'][string]> & TypeInfo
