import type { ListCollection as _Collection } from '../cache/lists'
import type { GraphQLObject, SubscriptionSelection } from '../lib/types'
import type { Cache } from './cache'
import { Record } from './record'
import type { CacheTypeDef, ListType, ValidLists, ListFilters } from './types'

export class ListCollection<Def extends CacheTypeDef, ListName extends ValidLists<Def>> {
	#parentID: string | undefined
	#allLists: boolean | undefined
	#when: ListFilters<Def, ListName> | undefined
	#cache: Cache<Def>
	#name: ValidLists<Def>

	constructor({
		parentID,
		allLists,
		when,
		cache,
		name,
	}: {
		name: ValidLists<Def>
		parentID?: string
		allLists?: boolean
		when?: ListFilters<Def, ListName>
		cache: Cache<Def>
	}) {
		this.#parentID = parentID
		this.#allLists = allLists
		this.#when = when
		this.#cache = cache
		this.#name = name
	}

	append(...records: ListType<Def, ListName>[]) {
		if (!this.#collection) {
			return
		}

		const { selection, data } = this.#listOperationPayload(records)
		for (const entry of data) {
			if (entry) {
				this.#collection.append(selection, entry)
			}
		}
	}

	prepend(...records: ListType<Def, ListName>[]) {
		if (!this.#collection) {
			return
		}

		const { selection, data } = this.#listOperationPayload(records)
		for (const entry of data) {
			if (entry) {
				this.#collection.prepend(selection, entry)
			}
		}
	}

	toggle(where: 'first' | 'last', ...records: ListType<Def, ListName>[]) {
		if (!this.#collection) {
			return
		}

		const { selection, data } = this.#listOperationPayload(records)
		for (const entry of data) {
			if (entry) {
				this.#collection.toggleElement(selection, entry, {}, where)
			}
		}
	}

	when(filter: ListFilters<Def, ListName>): ListCollection<Def, ListName> {
		if (!this.#collection) {
			return this
		}

		return new ListCollection({
			parentID: this.#parentID,
			allLists: this.#allLists,
			when: filter,
			cache: this.#cache,
			name: this.#name,
		})
	}

	remove(...records: ListType<Def, ListName>[]) {
		if (!this.#collection) {
			return
		}

		for (const record of records) {
			if (record) {
				this.#collection.remove(record.idFields)
			}
		}
	}

	*[Symbol.iterator]() {
		for (const entry of this.#collection ?? []) {
			yield entry
		}
	}

	get #collection(): _Collection | null {
		try {
			const list = this.#cache._internal_unstable.list(
				this.#name,
				this.#parentID,
				this.#allLists
			)
			if (this.#when) {
				return list.when(this.#when)
			}
			return list
		} catch {
			return null
		}
	}

	#listOperationPayload(records: ListType<Def, ListName>[]): {
		selection: SubscriptionSelection
		data: GraphQLObject[]
	} {
		// we need to build up the selection that describes the key
		// for every type in the list
		let selection: SubscriptionSelection = this.#collection!.selection
		// if the list is a connection, we can't use this selection immediately
		// we need to look for edges.node
		const connectionSelection = selection.fields?.['edges']?.selection?.fields?.node.selection
		if (connectionSelection) {
			selection = connectionSelection
		}

		// and the actual data for the record
		const data: GraphQLObject[] = []

		// loop over every record we are adding to build up the necessary structure
		for (const record of records) {
			if (!(record instanceof Record)) {
				throw new Error('You must provide a Record to a list operation')
			}

			// add the necessary information
			data.push({ __typename: record.type, ...record.idFields })
		}

		return {
			selection,
			data,
		}
	}
}
