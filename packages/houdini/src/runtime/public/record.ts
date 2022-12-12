import { rootID } from '../cache/cache'
import { TypeInfo } from '../cache/schema'
import { keyFieldsForType, SubscriptionSelection } from '../lib'
import type { CacheProxy } from './cache'
import type { ArgType, CacheTypeDef, FieldType, TypeFieldNames, ValidTypes } from './types'

export class RecordProxy<Def extends CacheTypeDef, Type extends ValidTypes<Def>> {
	private id: string
	type: string
	private cache: CacheProxy<Def>
	idFields: {}

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

	set<Field extends TypeFieldNames<Def, Type>>({
		field,
		args,
		value,
	}: {
		field: Field
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

		// if the type is a link, we need to use a selection that includes the id fields
		if (typeInfo.link) {
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

					{
						__typename: {
							type: 'String',
							keyRaw: '__typename',
						},
					}
				),
			}
		}

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
			// use the id fields as the value
			newValue = {
				...value.idFields,
				__typename: value.type,
			}
		}
		// it could also be a list of proxies
		else if (Array.isArray(value)) {
			newValue = []
			for (const inner of value as any[]) {
				if (!(inner instanceof RecordProxy)) {
					throw new Error(
						'Value must be a list RecordProxies if the field is a link to another record'
					)
				}

				newValue.push({ ...inner.idFields, __typename: inner.type })
			}
		}

		// they didn't pass a proxy or list of proxies when we expected one
		else {
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

	get<Field extends TypeFieldNames<Def, Type>>({
		field,
		args,
	}: {
		field: Field
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
					{
						__typename: {
							type: 'String',
							keyRaw: '__typename',
						},
					}
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
			return (result.data?.[field] ?? (typeInfo.nullable ? null : undefined)) as FieldType<
				Def,
				Type,
				Field
			>
		}

		const data = result.data?.[field] || {}

		// we need to handle lists and non lists so treat everything as a list for now
		// and then we'll unpack after
		let finalResult = (!Array.isArray(data) ? [data] : data).map((ids) => {
			// they asked for a link so we need to return a proxy to that record
			const linkedID = this.cache._internal_unstable._internal_unstable.id(
				typeInfo.type,
				ids || {}
			)
			if (!linkedID) {
				throw new Error('todo')
			}

			// look up the __typename
			const typename = this.cache._internal_unstable.read({
				selection: {
					fields: {
						__typename: {
							keyRaw: '__typename',
							type: 'String',
						},
					},
				},
				parent: linkedID,
			}).data?.__typename

			// return the proxy
			return new RecordProxy<Def, Field>({
				cache: this.cache,
				type: (typename as string) ?? typeInfo.type,
				id: linkedID,
				idFields: ids || {},
			})
		})

		return (Array.isArray(data) ? finalResult : finalResult[0]) as FieldType<Def, Type, Field>
	}

	private _typeInfo(field: string, type: string = this.type): TypeInfo {
		if (field === '__typename') {
			return {
				type: 'String',
				nullable: false,
				link: false,
			}
		}

		const info = this.cache._internal_unstable._internal_unstable.schema.fieldType(type, field)

		if (!info) {
			throw new Error(
				`Unknown field: ${field} for type ${type}. Please provide type information using setFieldType().`
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
