import type { Cache as _Cache } from '../cache/cache'
import { rootID } from '../cache/cache'
import type { SchemaManager, TypeInfo } from '../cache/schema'
import { ListCollection } from './list'
import { Record } from './record'
import type { CacheTypeDef, IDFields, TypeNames, ValidLists } from './types'

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

	// if the user tries to assign a field type that we haven't seen before
	// then we need to provide a way for them to give us that information
	setFieldType(...args: Parameters<SchemaManager['setFieldType']>) {
		this.validateInstabilityWarning()
		this._internal_unstable._internal_unstable.schema.setFieldType(...args)
	}

	// return the root record
	get root(): Record<Def, '__ROOT__'> {
		this.validateInstabilityWarning()
		return new Record({
			cache: this,
			type: 'Query',
			id: rootID,
			idFields: {},
		})
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
		return new ListCollection<Def, Name>({
			cache: this,
			name,
			parentID,
			allLists,
		})
	}

	/**
	 * Mark all fields known at this point on this type as stale
	 * @param type
	 */
	markStale<T extends TypeNames<Def>>(type: T): void {
		this._internal_unstable._internal_unstable.staleManager.markTypeStale(type)
	}
}

export function _typeInfo<Def extends CacheTypeDef>(
	cache: Cache<Def>,
	type: string,
	field: string
): TypeInfo {
	if (field === '__typename') {
		return {
			type: 'String',
			nullable: false,
			link: false,
		}
	}

	const info = cache._internal_unstable._internal_unstable.schema.fieldType(type, field)

	if (!info) {
		throw new Error(
			`Unknown field: ${field} for type ${type}. Please provide type information using setFieldType().`
		)
	}

	return info
}
