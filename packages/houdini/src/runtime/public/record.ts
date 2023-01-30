import { rootID } from '../cache/cache'
import { marshalInputs } from '../lib'
import { keyFieldsForType } from '../lib/config'
import type { FragmentArtifact, GraphQLObject } from '../lib/types'
import type { Cache } from './cache'
import type {
	ArgType,
	CacheTypeDef,
	FragmentList,
	FragmentValue,
	FragmentVariables,
	TypeFieldNames,
	ValidTypes,
} from './types'

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

	read<_Fragment extends { artifact: FragmentArtifact }>({
		fragment,
		variables,
	}: {
		fragment: _Fragment
		variables?: FragmentVariables<FragmentList<Def, Type>, _Fragment>
	}): { data: FragmentValue<FragmentList<Def, Type>, _Fragment> | null; partial: boolean } {
		// @ts-expect-error
		return this.#cache._internal_unstable.read({
			selection: fragment.artifact.selection,
			parent: this.#id,
			variables:
				marshalInputs({
					config: this.#cache.config,
					artifact: fragment.artifact,
					input: variables,
				}) ?? undefined,
		})
	}

	write<_Fragment extends { artifact: FragmentArtifact }, _Variable>(args: {
		fragment: _Fragment
		data: FragmentValue<FragmentList<Def, Type>, _Fragment>
		// TODO: figure out a way to make this required  when _Variables has a value
		//       and optional when _Variables is never
		variables?: FragmentVariables<FragmentList<Def, Type>, _Fragment>
		forceStale?: boolean
	}) {
		// we have the data and the fragment, just pass them both to the cache
		this.#cache._internal_unstable.write({
			data: args.data as unknown as GraphQLObject,
			selection: args.fragment.artifact.selection,
			parent: this.#id,
			variables:
				marshalInputs({
					config: this.#cache.config,
					artifact: args.fragment.artifact,
					input: args.variables,
				}) ?? undefined,
			forceStale: args.forceStale,
		})
	}

	delete() {
		this.#cache._internal_unstable.delete(this.#id)
	}

	/**
	 * Mark some elements of the record stale in the cache.
	 * @param field
	 * @param when
	 */
	markStale<Field extends TypeFieldNames<Def, Type>>({
		field,
		when,
	}: {
		field?: Field
		when?: ArgType<Def, Type, Field>
	} = {}): void {
		// If we don't have a field, mark the whole record as stale
		if (!field) {
			this.#cache._internal_unstable._internal_unstable.markRecordStale(this.#id)
		}
		// we are marking a specific field
		else {
			const key = computeKey({ field, args: when })
			this.#cache._internal_unstable._internal_unstable.setFieldTimeToStale(this.#id, key)
		}
	}
}

const computeKey = ({ field, args }: { field: string; args?: { [key: string]: any } }) => {
	const keys = Object.keys(args ?? {})
	keys.sort()

	return args && keys.length > 0
		? `${field}(${keys
				.map((key) => `${key}: ${stringifyObjectWithNoQuotesOnKeys(args[key])}`)
				.join(', ')})`
		: field
}

const stringifyObjectWithNoQuotesOnKeys = (obj_from_json: {}): string => {
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
