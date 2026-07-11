// Compile-time type assertions for the imperative cache: the generated CacheTypeDef
// (in $houdini/runtime/generated) and the cache.get / cache.list / markStale surface.
// Verified by `tsc --noEmit` — not a Playwright test.

import { cache } from '$houdini'
import type { MyEnum$options } from '$houdini/graphql/enums'
import type { CacheTypeDef } from '$houdini/runtime/generated'
import type { Record as CacheRecord } from '$houdini/runtime/public/record'
import type { GraphQLObject } from 'houdini/runtime'

export {}

// strict type equality: only resolves to true when A and B are identical
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
	? true
	: false

type UserFields = CacheTypeDef['types']['User']['fields']

// ── field types come from the schema + scalar config ─────────────────────────

// plain scalars keep their wire type
const _name: Equals<UserFields['name']['type'], string> = true
// custom scalars resolve to their configured TypeScript type (DateTime → Date)
const _birthDate: Equals<UserFields['birthDate']['type'], Date | null> = true
// enums resolve to the generated $options union
const _enum: Equals<UserFields['enumValue']['type'], MyEnum$options | null> = true
// relations resolve to Record proxies of the target type
const _friends: Equals<UserFields['friendsList']['type'], CacheRecord<CacheTypeDef, 'User'>[]> =
	true

// field arguments keep their schema types; nullable args are optional
const _avatarArgs: Equals<UserFields['avatarURL']['args'], { size?: number | null | undefined }> =
	true
// required args stay required
const _testFieldArgs: Equals<UserFields['testField']['args'], { someParam: boolean }> = true
// fields without arguments are marked never
const _noArgs: Equals<UserFields['name']['args'], never> = true

// ── the project scalar union is registered with the runtime (issue #1728) ────

// the generated def carries the exact project union
const _scalars: Equals<CacheTypeDef['scalars'], number | boolean | string | Date | File> = true

// configured scalar outputs satisfy the GraphQLObject constraint every store
// enforces. File is not in the runtime's fallback union, so this only compiles
// because the generated runtime augments CacheTypeDef['scalars']
const _augmentedScalars: { when: Date; upload: File } extends GraphQLObject ? true : false = true

// a type no scalar maps to is still rejected — the union stays project-accurate
const _unconfiguredScalar: { url: URL } extends GraphQLObject ? true : false = false

// ── cache.get: only schema types, identified by their key fields ─────────────

const user = cache.get('User', { id: '1' })
const _record: CacheRecord<CacheTypeDef, 'User'> = user

// @ts-expect-error -- NotAType is not a type in the schema
cache.get('NotAType', { id: '1' })

// @ts-expect-error -- User records are identified by id
cache.get('User', {})

// ── markStale validates fields and their arguments ────────────────────────────

user.markStale('name')
user.markStale('testField', { when: { someParam: true } })

// @ts-expect-error -- notAField is not a field of User
user.markStale('notAField')

user.markStale('testField', {
	// @ts-expect-error -- someParam is a Boolean
	when: { someParam: 'yes' },
})

// cache-level markStale is validated the same way
cache.markStale('User', { field: 'birthDate' })
// @ts-expect-error -- notAField is not a field of User
cache.markStale('User', { field: 'notAField' })

// ── lists: names and filters come from @list directives ──────────────────────

const users = cache.list('PluralUsers')
// filters keep their schema types, including custom scalars (bornAfter: DateTime)
users.when({ must: { limit: 2, bornAfter: new Date() } })
users.append(user)

// @ts-expect-error -- Not_A_List was never declared with @list
cache.list('Not_A_List')

users.when({
	must: {
		// @ts-expect-error -- the limit filter is an Int
		limit: 'two',
	},
})

users.when({
	must: {
		// @ts-expect-error -- publishDate is not a filter on PluralUsers
		publishDate: new Date(),
	},
})

// @ts-expect-error -- append takes Record proxies, not raw ids
users.append('User:1')
