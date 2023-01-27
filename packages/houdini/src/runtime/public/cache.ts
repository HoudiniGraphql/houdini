import type { Cache as _Cache } from '../cache/cache'
import { marshalInputs, type QueryArtifact } from '../lib'
import { ListCollection } from './list'
import { Record } from './record'
import type {
	CacheTypeDef,
	IDFields,
	QueryInput,
	QueryList,
	QueryValue,
	TypeFieldNames,
	TypeNames,
	ValidLists,
} from './types'

export class Cache<Def extends CacheTypeDef> {
	_internal_unstable: _Cache

	constructor(cache: _Cache) {
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

	// return the record proxy for the given type/id combo
	get<T extends TypeNames<Def>>(type: T, data: IDFields<Def, T>): Record<Def, T> {
		this.validateInstabilityWarning()

		// verify that

		// compute the id for the record
		let recordID = this._internal_unstable._internal_unstable.id(type, data)
		if (!recordID) {
			throw new Error('todo')
		}

		// return the proxy
		return new Record({
			cache: this,
			type: type,
			id: recordID,
			idFields: data,
		})
	}

	get config() {
		return this._internal_unstable._internal_unstable.config
	}

	list<Name extends ValidLists<Def>>(
		name: Name,
		{ parentID, allLists }: { parentID?: string; allLists?: boolean } = {}
	): ListCollection<Def, Name> {
		this.validateInstabilityWarning()
		return new ListCollection<Def, Name>({
			cache: this,
			name,
			parentID,
			allLists,
		})
	}

	read<_Query extends { artifact: QueryArtifact }>({
		query,
		variables,
	}: {
		query: _Query
		variables?: QueryInput<QueryList<Def>, _Query>
	}): {
		data: QueryValue<QueryList<Def>, _Query> | null
		partial: boolean
	} {
		this.validateInstabilityWarning()
		// @ts-expect-error
		return this._internal_unstable.read({
			selection: query.artifact.selection,
			variables,
		})
	}

	write<_Query extends { artifact: QueryArtifact }>({
		query,
		variables,
		data,
	}: {
		query: _Query
		data: QueryValue<QueryList<Def>, _Query>
		variables?: QueryInput<QueryList<Def>, _Query>
	}) {
		this.validateInstabilityWarning()
		this._internal_unstable.write({
			selection: query.artifact.selection,
			// @ts-expect-error
			data,
			variables:
				marshalInputs({
					config: this.config,
					artifact: query.artifact,
					input: variables,
				}) ?? {},
		})

		return
	}

	/**
	 * Mark some elements of the cache stale.
	 * @param type
	 * @param field
	 */
	markStale<T extends TypeNames<Def>>(
		type?: T,
		options: { field?: TypeFieldNames<Def, T> } = {}
	): void {
		if (!type) {
			this._internal_unstable._internal_unstable.markAllStale()
		} else if (!options.field) {
			this._internal_unstable._internal_unstable.markTypeStale(type)
		} else {
			this._internal_unstable._internal_unstable.markTypeFieldStale(type, options.field)
		}
	}
}
