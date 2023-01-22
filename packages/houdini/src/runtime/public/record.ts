import { rootID } from '../cache/cache'
import { keyFieldsForType } from '../lib/config'
import type { FragmentArtifact, GraphQLObject } from '../lib/types'
import type { Cache } from './cache'
import type { CacheTypeDef, FragmentList, FragmentValue, ValidTypes } from './types'

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
	): FragmentValue<FragmentList<Def, Type>, _Fragment> {
		// @ts-ignore
		return this.#cache._internal_unstable.read({
			selection: fragment.artifact.selection,
			parent: this.#id,
		}).data
	}

	write<_Fragment extends { artifact: FragmentArtifact }>(args: {
		fragment: _Fragment
		data: FragmentValue<FragmentList<Def, Type>, _Fragment>
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
