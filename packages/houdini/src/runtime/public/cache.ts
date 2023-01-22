import type { Cache as _Cache } from '../cache/cache'
import { rootID } from '../cache/cache'
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
}
