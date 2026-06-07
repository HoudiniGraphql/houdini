import type { Fragment, FragmentArtifact, GraphQLObject } from 'houdini/runtime'
import type { Readable } from 'svelte/store'

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
	ref: Fragment<_Data> | null | undefined,
	store: FragmentStore<_Data, {}>
) {
	// make sure we got a query document
	if (store.kind !== 'HoudiniFragment') {
		throw new Error(`fragment can only take fragment documents. Found: ${store.kind}`)
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
