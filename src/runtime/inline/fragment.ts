import { Readable } from 'svelte/store'

import * as log from '../lib/log'
import { wrapPaginationStore, PaginatedDocumentHandlers, PageInfo } from '../lib/pagination'
import { ArtifactKind, Fragment, GraphQLTagResult } from '../lib/types'

let hasWarned = false

// function overloads meant to only return a nullable value
// if the reference type was nullable
export function fragment<_Fragment extends Fragment<any>>(
	ref: _Fragment,
	fragment: GraphQLTagResult
): Readable<NonNullable<_Fragment['shape']>> & {
	data: Readable<_Fragment>
}
export function fragment<_Fragment extends Fragment<any>>(
	ref: _Fragment | null,
	fragment: GraphQLTagResult
): Readable<NonNullable<_Fragment['shape']> | null> & {
	data: Readable<_Fragment | null>
}
export function fragment<_Fragment extends Fragment<any>>(
	ref: _Fragment | null,
	store: GraphQLTagResult
): Readable<NonNullable<_Fragment['shape']>> & {
	data: Readable<_Fragment | null>
} {
	// @ts-ignore
	const oldAPI = 'kind' in (ref || {}) && Object.keys(ArtifactKind).includes(ref.kind)
	if (!hasWarned && oldAPI) {
		hasWarned = true

		log.info(`${log.red(
			'⚠️ argument order for fragment() has changed. The graphql tag now goes second:'
		)}
		
export let prop

$: data = fragment(prop, graphql\`...\`)
`)
	}

	// make sure we got a query document
	if (store.kind !== 'HoudiniFragment' || false) {
		throw new Error('getFragment can only take fragment documents')
	}

	// load the fragment store for the value
	const fragmentStore = store.get(ref)

	// make sure the store always stays up to date with the fragment value
	fragmentStore.proxy.listen((val: _Fragment) => {
		// update the fragment value to match the new value
		fragmentStore.update(val)
	})

	return {
		...fragmentStore,
		data: { subscribe: fragmentStore.subscribe },
	}
}

export function paginatedFragment<_Fragment extends Fragment<any>>(
	initialValue: _Fragment | null,
	document: GraphQLTagResult
): { data: Readable<_Fragment['shape'] | null> } & Omit<
	PaginatedDocumentHandlers<_Fragment['shape'], {}>,
	'refetch'
>
export function paginatedFragment<_Fragment extends Fragment<any>>(
	initialValue: _Fragment,
	document: GraphQLTagResult
): { data: Readable<_Fragment['shape']> } & Omit<
	Omit<
		PaginatedDocumentHandlers<_Fragment['shape'], {}>,
		'pageInfo' & { pageInfo: Readable<PageInfo> }
	>,
	'refetch'
>

export function paginatedFragment<_Fragment extends Fragment<any>>(
	initialValue: _Fragment | null,
	store: GraphQLTagResult
): { data: Readable<_Fragment['shape']> } & Omit<
	PaginatedDocumentHandlers<_Fragment['shape'], {}>,
	'pageInfos' | 'refetch' | 'onUnsubscribe'
> & { pageInfo: Readable<PageInfo> } {
	// make sure we got a query document
	if (store.kind !== 'HoudiniFragment') {
		throw new Error('paginatedFragment() must be passed a fragment document')
	}
	// if we don't have a pagination fragment there is a problem
	if (!store.paginated) {
		throw new Error('paginatedFragment must be passed a fragment with @paginate')
	}

	// TODO: fix type checking paginated
	// @ts-ignore: the query store will only include the methods when it needs to
	// and the userland type checking happens as part of the query type generation
	return wrapPaginationStore(fragment(store, initialValue))
}
