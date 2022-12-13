import { ListCollection as _Collection } from '../cache/lists'
import { keyFieldsForType } from '../lib'
import { GraphQLObject, SubscriptionSelection } from '../lib/types'
import { Cache, _typeInfo } from './cache'
import { Record } from './record'
import { CacheTypeDef, ListType, ValidLists, ListWhen } from './types'

export class ListCollection<Def extends CacheTypeDef, ListName extends ValidLists<Def>> {
	#collection: _Collection
	#cache: Cache<Def>

	constructor({ collection, cache }: { collection: _Collection; cache: Cache<Def> }) {
		this.#collection = collection
		this.#cache = cache
	}

	append(...records: ListType<Def, ListName>[]) {
		const { selection, data } = this.#listOperationPayload(records)
		for (const entry of data) {
			if (entry) {
				this.#collection.append(selection, entry)
			}
		}
	}

	prepend(...records: ListType<Def, ListName>[]) {
		const { selection, data } = this.#listOperationPayload(records)
		for (const entry of data) {
			if (entry) {
				this.#collection.prepend(selection, entry)
			}
		}
	}

	toggle(where: 'first' | 'last', ...records: ListType<Def, ListName>[]) {
		const { selection, data } = this.#listOperationPayload(records)
		for (const entry of data) {
			if (entry) {
				this.#collection.toggleElement(selection, entry, {}, where)
			}
		}
	}

	when(filter: ListWhen<Def, ListName>): ListCollection<Def, ListName> {
		return new ListCollection({
			collection: this.#collection.when(filter),
			cache: this.#cache,
		})
	}

	remove(...records: ListType<Def, ListName>[]) {
		for (const record of records) {
			if (record) {
				this.#collection.remove(record.idFields)
			}
		}
	}

	*[Symbol.iterator]() {
		for (const entry of this.#collection) {
			yield entry
		}
	}

	#listOperationPayload(records: ListType<Def, ListName>[]): {
		selection: SubscriptionSelection
		data: GraphQLObject[]
	} {
		// we need to build up the selection that describes the key
		// for every type in the list
		const selection: SubscriptionSelection = {
			abstractFields: {
				fields: {},
				typeMap: {},
			},
		}

		// and the actual data for the record
		const data: GraphQLObject[] = []

		// loop over every record we are adding to build up the necessary structure
		for (const record of records) {
			if (!(record instanceof Record)) {
				throw new Error('You must provide a Record to a list operation')
			}

			// look up the necessary fields to compute the key
			const keys = keyFieldsForType(this.#cache.config, record.type)

			// save the selection as an abstract one to support multiple types getting
			// added in bulk
			selection.abstractFields!.fields![record.type] = keys.reduce<{
				[field: string]: { type: string; keyRaw: string }
			}>(
				(acc, key) => {
					// look up the type information for the key
					const keyInfo = _typeInfo(this.#cache, record.type, key)

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
			)

			// add the necessary information
			data.push({ __typename: record.type, ...record.idFields })
		}

		return {
			selection,
			data,
		}
	}
}
