import { rootID } from '../cache/cache'
import type { TypeInfo } from '../cache/schema'
import { keyFieldsForType } from '../lib/config'
import type { SubscriptionSelection } from '../lib/types'
import type { Cache } from './cache'
import { _typeInfo } from './cache'
import type { ArgType, CacheTypeDef, FieldType, TypeFieldNames, ValidTypes } from './types'

export class Record<Def extends CacheTypeDef, Type extends ValidTypes<Def>> {
	#id: string
	#cache: Cache<Def>

	type: string
	idFields: {}

	constructor({
		cache,
		type,
		id,
		idFields,
	}: {
		cache: Cache<Def>
		type: string
		idFields: {}
		id: string
	}) {
		this.#cache = cache
		this.#id = id
		this.type = type
		this.idFields = idFields

		// make sure that we have all of the necessary fields for the id
		if (id !== rootID) {
			for (const key of keyFieldsForType(this.#cache.config, type)) {
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
		this.#cache.validateInstabilityWarning()

		// compute the key for the field/args combo
		const key = computeKey({ field, args })
		// look up the type information for the field
		const typeInfo: TypeInfoWithSelection = _typeInfo(this.#cache, this.type, field)

		// the value we will set
		let newValue: any

		// if the type is a link, we need to use a selection that includes the id fields
		if (typeInfo.link) {
			// look up the necessary fields to compute the key
			const keys = keyFieldsForType(this.#cache.config, typeInfo.type)

			// add the
			typeInfo.selection = {
				fields: keys.reduce<{ [field: string]: { type: string; keyRaw: string } }>(
					(acc, key) => {
						// look up the type information for the key
						const keyInfo = _typeInfo(this.#cache, typeInfo.type, key)

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
			const fnMarshal = this.#cache.config.scalars?.[typeInfo.type]?.marshal
			if (fnMarshal) {
				newValue = fnMarshal(value)
			} else {
				newValue = value
			}
		}
		// we are writing a link so we need to add some information to the selection
		// as well as use the id fields for the value
		else if ((value as unknown) instanceof Record) {
			// use the id fields as the value
			newValue = {
				...value.idFields,
				__typename: value.type,
			}
		}
		// it could also be a list of proxies
		else if (Array.isArray(value)) {
			// we want to allow nested lists of records and scalars
			newValue = marshalNestedList(value)
		}

		// they didn't pass a proxy or list of proxies when we expected one
		else if (value !== null) {
			throw new Error('Value must be a RecordProxy if the field is a link to another record')
		}

		// reset the garbage collection status
		this.#cache._internal_unstable._internal_unstable.lifetimes.resetLifetime(
			this.type,
			this.#id,
			key
		)

		// write the value to the cache by constructing the correct selection
		this.#cache._internal_unstable.write({
			parent: this.#id,
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
		this.#cache.validateInstabilityWarning()

		// compute the key for the field/args combo
		const key = computeKey({ field, args })
		// look up the type information for the field
		const typeInfo: TypeInfoWithSelection = _typeInfo(this.#cache, this.type, field)

		// if the field is a link we need to look up all of the fields necessary to compute the id
		if (typeInfo.link) {
			// look up the necessary fields to compute the key
			const keys = keyFieldsForType(this.#cache.config, typeInfo.type)

			// add the keys to the selection
			typeInfo.selection = {
				fields: keys.reduce<{ [field: string]: { type: string; keyRaw: string } }>(
					(acc, key) => {
						// look up the type information for the key
						const keyInfo = _typeInfo(this.#cache, typeInfo.type, key)

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
		const result = this.#cache._internal_unstable.read({
			parent: this.#id,
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
		let finalResult = unmarshalNestedList(
			this.#cache,
			!Array.isArray(data) ? [data] : data
		).map((val) => {
			if (typeInfo.nullable && (val === null || Object.keys(val).length === 0)) {
				return null
			}
			return val
		})

		return (Array.isArray(data) ? finalResult : finalResult[0]) as FieldType<Def, Type, Field>
	}

	delete() {
		this.#cache._internal_unstable.delete(this.#id)
	}
}

export function computeKey({ field, args }: { field: string; args?: { [key: string]: any } }) {
	const keys = Object.keys(args ?? {})
	keys.sort()

	return args && keys.length > 0
		? `${field}(${keys
				.map((key) => `${key}: ${stringifyObjectWithNoQuotesOnKeys(args[key])}`)
				.join(', ')})`
		: field
}

export const stringifyObjectWithNoQuotesOnKeys = (obj_from_json: {}): string => {
	// In case of an array we'll stringify all objects.
	if (Array.isArray(obj_from_json)) {
		return `[${obj_from_json
			.map((obj) => `${stringifyObjectWithNoQuotesOnKeys(obj)}`)
			.join(', ')}]`
	}
	// not an object, stringify using native function
	if (
		typeof obj_from_json !== 'object' ||
		obj_from_json instanceof Date ||
		obj_from_json === null
	) {
		return JSON.stringify(obj_from_json).replace(/"([^"]+)":/g, '$1: ')
	}
	// Implements recursive object serialization according to JSON spec
	// but without quotes around the keys.
	return `{${Object.keys(obj_from_json)
		// @ts-ignore
		.map((key) => `${key}: ${stringifyObjectWithNoQuotesOnKeys(obj_from_json[key])}`)
		.join(', ')}}`
}

type TypeInfoWithSelection = Partial<Required<SubscriptionSelection>['fields'][string]> & TypeInfo

export function marshalNestedList(list: any[]): any[] {
	const newValue = []

	for (const inner of list) {
		// if the inner entry is a list, marshal it
		if (Array.isArray(inner)) {
			newValue.push(marshalNestedList(inner))
		} else if (inner instanceof Record) {
			newValue.push({ ...inner.idFields, __typename: inner.type })
		} else {
			newValue.push(inner)
		}
	}

	return newValue
}

function unmarshalNestedList<Def extends CacheTypeDef>(cache: Cache<Def>, list: any[]): any[] {
	const newValue = []

	for (const inner of list) {
		// if the inner entry is a list, marshal it
		if (Array.isArray(inner)) {
			newValue.push(unmarshalNestedList<Def>(cache, inner))
		} else if (inner === null) {
			newValue.push(null)
		} else if (inner.__typename) {
			const type = inner.__typename
			// compute the id for the record
			let recordID = cache._internal_unstable._internal_unstable.id(type, inner)
			if (!recordID) {
				throw new Error('todo')
			}

			// look up the __typename
			const typename = cache._internal_unstable.read({
				selection: {
					fields: {
						__typename: {
							keyRaw: '__typename',
							type: 'String',
						},
					},
				},
				parent: recordID,
			}).data?.__typename

			newValue.push(
				new Record({
					cache,
					type: type || (typename as string),
					idFields: inner,
					id: recordID,
				})
			)
		} else {
			newValue.push(inner)
		}
	}

	return newValue
}
