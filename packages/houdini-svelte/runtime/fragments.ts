import type { Fragment, FragmentArtifact, GraphQLObject } from 'houdini/runtime'
import { derived, readable, type Readable } from 'svelte/store'

import type { FragmentStore } from './stores/index.js'
import type {
	BasePaginatedFragmentStore,
	FragmentStorePaginated,
} from './stores/pagination/fragment.js'

// Accepts both FragmentStore (non-paginated) and paginated variants (FragmentStoreCursor /
// FragmentStoreOffset). The paginated classes extend BasePaginatedFragmentStore, not
// FragmentStore, so they are missing the protected `context` member. Using a union here
// avoids the class-hierarchy compatibility error TypeScript would otherwise emit.
type AnyFragmentStoreFor<_Data extends GraphQLObject> =
	| FragmentStore<_Data, {}>
	| BasePaginatedFragmentStore<_Data, any, any>

// @plural fragment overloads: the reference is a list of fragment references and the
// resulting store holds an array of data (one entry per item in the list).
export function fragment<_Data extends GraphQLObject, _Fragment extends Fragment<_Data>>(
	ref: ReadonlyArray<_Fragment>,
	fragment: FragmentStore<_Data, {}>
): Readable<Array<Exclude<_Data, undefined>>> & {
	data: Readable<ReadonlyArray<_Fragment>>
	artifact: FragmentArtifact
}
export function fragment<_Data extends GraphQLObject, _Fragment extends Fragment<_Data>>(
	ref: ReadonlyArray<_Fragment> | null | undefined,
	fragment: FragmentStore<_Data, {}>
): Readable<Array<Exclude<_Data, undefined>>> & {
	data: Readable<ReadonlyArray<_Fragment>>
	artifact: FragmentArtifact
}

// function overloads meant to only return a nullable value
// if the reference type was nullable.
// _Data is inferred from the store so that the return type is correct even when
// the ref argument is a bare query-result type (e.g. { " $fragments": { Name: {} } })
// that has no `shape` property.
export function fragment<_Data extends GraphQLObject, _Fragment extends Fragment<_Data>>(
	ref: _Fragment,
	fragment: FragmentStore<_Data, {}>
): Readable<Exclude<_Data, undefined>> & {
	data: Readable<_Fragment>
	artifact: FragmentArtifact
}
export function fragment<_Data extends GraphQLObject, _Fragment extends Fragment<_Data>>(
	ref: _Fragment | null | undefined,
	fragment: FragmentStore<_Data, {}>
): Readable<Exclude<_Data, undefined> | null> & {
	data: Readable<_Fragment | null>
	artifact: FragmentArtifact
}
export function fragment<_Data extends GraphQLObject>(
	ref: Fragment<_Data> | ReadonlyArray<Fragment<_Data>> | null | undefined,
	store: FragmentStore<_Data, {}>
) {
	// make sure we got a query document
	if (store.kind !== 'HoudiniFragment') {
		throw new Error(`fragment can only take fragment documents. Found: ${store.kind}`)
	}

	// @plural fragments are spread on a list field, so the reference is an array of
	// fragment references and we return a store holding an array of data. We key off the
	// artifact's plural flag (not Array.isArray) so a null/undefined reference to a plural
	// fragment still takes the plural path.
	if (store.artifact.plural) {
		return pluralFragment(ref as ReadonlyArray<Fragment<_Data>> | null | undefined, store)
	}

	// a non-plural fragment given a list of references is a mistake (the fragment needs
	// @plural to be read as an array)
	if (Array.isArray(ref)) {
		throw new Error(
			`fragment "${store.artifact.name}" was given a list of references but is not marked @plural.`
		)
	}

	// load the fragment store for the value
	// @ts-expect-error: ref is Fragment<_Data> but store.get() expects _Data | { [fragmentKey]: _ReferenceType };
	// Fragment<_Data> structurally satisfies the { [fragmentKey]: _ReferenceType } branch at runtime.
	const fragmentStore = store.get(ref)

	return {
		...fragmentStore,
		artifact: store.artifact,
		data: { subscribe: fragmentStore.subscribe },
	}
}

// pluralFragment wires up one fragment store instance per reference in the list and combines
// them into a single store whose value is the array of data. Each instance stays reactive to
// cache updates on its own record.
function pluralFragment<_Data extends GraphQLObject>(
	refs: ReadonlyArray<Fragment<_Data>> | null | undefined,
	store: FragmentStore<_Data, {}>
) {
	const list = refs ?? []

	// derived() requires at least one input store; short-circuit the empty case
	if (list.length === 0) {
		const empty = readable<_Data[]>([])
		return {
			subscribe: empty.subscribe,
			artifact: store.artifact,
			data: { subscribe: empty.subscribe },
		}
	}

	const instances = list.map((ref) =>
		// @ts-expect-error: see the singular branch above
		store.get(ref)
	)

	const combined = derived(instances, ($values) => $values as _Data[])

	return {
		subscribe: combined.subscribe,
		artifact: store.artifact,
		data: { subscribe: combined.subscribe },
	}
}

export function paginatedFragment<_Data extends GraphQLObject, _Fragment extends Fragment<_Data>>(
	initialValue: _Fragment | null | undefined,
	document: AnyFragmentStoreFor<_Data>
): FragmentStorePaginated<_Data, {}>

export function paginatedFragment<_Data extends GraphQLObject, _Fragment extends Fragment<_Data>>(
	initialValue: _Fragment,
	document: AnyFragmentStoreFor<_Data>
): FragmentStorePaginated<_Data, {}>

export function paginatedFragment<_Data extends GraphQLObject>(
	initialValue: Fragment<_Data> | null | undefined,
	store: AnyFragmentStoreFor<_Data>
): FragmentStorePaginated<_Data, {}> {
	// make sure we got a query document
	if (store.kind !== 'HoudiniFragment') {
		throw new Error(`paginatedFragment() must be passed a fragment document: ${store.kind}`)
	}
	// if we don't have a pagination fragment there is a problem
	if (!('paginated' in store)) {
		throw new Error('paginatedFragment() must be passed a fragment with @paginate')
	}

	// TODO: fix type checking paginated
	// @ts-expect-error: the query store will only include the methods when it needs to
	// and the userland type checking happens as part of the query type generation
	return fragment(initialValue, store)
}
