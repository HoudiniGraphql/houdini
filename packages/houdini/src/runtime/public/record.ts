import { rootID } from '../cache/cache'
import type { TypeInfo } from '../cache/schema'
import { keyFieldsForType } from '../lib/config'
import type { FragmentArtifact, GraphQLObject, SubscriptionSelection } from '../lib/types'
import type { Cache } from './cache'
import type { CacheTypeDef, FragmentList, ValidTypes } from './types'

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

	read<_Fragment extends { artifact: FragmentArtifact }>(
		fragment: _Fragment
	): ListKeyValue<FragmentList<Def, Type>, _Fragment> {
		// @ts-ignore
		return this.#cache._internal_unstable.read({
			selection: fragment.artifact.selection,
			parent: this.#id,
		}).data
	}

	write<_Fragment extends { artifact: FragmentArtifact }>(args: {
		fragment: _Fragment
		data: ListKeyValue<FragmentList<Def, Type>, _Fragment>
	}) {
		// we have the data and the fragment, just pass them both to the cache
		this.#cache._internal_unstable.write({
			data: args.data as unknown as GraphQLObject,
			selection: args.fragment.artifact.selection,
			parent: this.#id,
		})
	}

	delete() {
		this.#cache._internal_unstable.delete(this.#id)
	}
}

type ListKeyValue<List, _Target> = List extends [infer Head, ...infer Rest]
	? Head extends [infer _Key, infer _Value]
		? _Key extends _Target
			? _Value
			: ListKeyValue<Rest, _Target>
		: 'Encountered unknown fragment'
	: 'Encountered unknown fragment'
