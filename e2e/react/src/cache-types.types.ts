// Compile-time type assertions for the imperative cache: the generated CacheTypeDef
// (in $houdini/runtime/generated) and the cache.get / cache.list / markStale surface.
// Verified by `tsc --noEmit` — not a Playwright test.

import { cache } from '$houdini'
import type { GuardRow$artifact, GuardRow$data } from '$houdini/artifacts/GuardRow'
import type { HelloWorld$artifact, HelloWorld$result } from '$houdini/artifacts/HelloWorld'
import type {
	RefetchableUserInfo$artifact,
	RefetchableUserInfo$data,
} from '$houdini/artifacts/RefetchableUserInfo'
import type {
	RouteParamsUserInfo$artifact,
	RouteParamsUserInfo$result,
} from '$houdini/artifacts/RouteParamsUserInfo'
import type { MyEnum$options } from '$houdini/graphql/enums'
import type { CacheTypeDef } from '$houdini/runtime/generated'
import type { Record as CacheRecord } from '$houdini/runtime/public/record'
import type { GraphQLObject, QueryArtifact } from 'houdini/runtime'

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

// ── cache.read / cache.write are typed per document, matched by artifact ─────

declare const helloWorld: { artifact: HelloWorld$artifact }
declare const userInfoQuery: { artifact: RouteParamsUserInfo$artifact }

// read resolves the document's own result type, not a union of every query
const helloData = cache.read({ query: helloWorld }).data
const _helloData: Equals<typeof helloData, HelloWorld$result | null> = true

const userData = cache.read({ query: userInfoQuery, variables: { id: '1' } }).data
const _userData: Equals<typeof userData, RouteParamsUserInfo$result | null> = true

// write validates data and variables against the matched document
cache.write({ query: userInfoQuery, data: { user: { name: 'x' } }, variables: { id: '1' } })

cache.write({
	query: userInfoQuery,
	// @ts-expect-error -- name is a String
	data: { user: { name: 2 } },
	variables: { id: '1' },
})

cache.write({
	query: userInfoQuery,
	data: { user: { name: 'x' } },
	// @ts-expect-error -- id is an ID
	variables: { id: false },
})

// a document the runtime doesn't know about fails closed with the error
// sentinel instead of silently matching another document
declare const unknownQuery: { artifact: QueryArtifact }
const unknownData = cache.read({ query: unknownQuery }).data
const _unknownData: Equals<
	typeof unknownData,
	| 'Encountered unknown query.Please make sure your runtime is up to date (ie, `vite dev` or `vite build`).'
	| null
> = true

// ── record.read / record.write match fragments the same way ──────────────────

declare const guardRow: { artifact: GuardRow$artifact }
declare const refetchableUserInfo: { artifact: RefetchableUserInfo$artifact }

const guardData = user.read({ fragment: guardRow }).data
const _guardData: Equals<typeof guardData, GuardRow$data | null> = true

user.write({ fragment: guardRow, data: { id: '1', name: 'x' } })

user.write({
	fragment: guardRow,
	// @ts-expect-error -- GuardRow selects id and name
	data: { id: '1' },
})

// fragment variables resolve per fragment too
const refetchableData = user.read({ fragment: refetchableUserInfo, variables: { size: 2 } }).data
const _refetchableData: Equals<typeof refetchableData, RefetchableUserInfo$data | null> = true

user.read({
	fragment: refetchableUserInfo,
	// @ts-expect-error -- size is an Int
	variables: { size: 'big' },
})
