import { Readable } from 'svelte/store'

import * as log from '../lib/log'
import { ArtifactKind, Fragment, GraphQLTagResult } from '../lib/types'
import { FragmentStore } from '../stores'
import type { FragmentStorePaginated } from '../stores/pagination/fragment'

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
	store: GraphQLTagResult,
	ref: _Fragment | null
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
	if (store.kind !== 'HoudiniFragment') {
		throw new Error(`fragment can only take fragment documents. Found: ${store.kind}`)
	}

	// load the fragment store for the value
	const fragmentStore = (store as FragmentStore<any>).get(ref)

	return {
		...fragmentStore,
		data: { subscribe: fragmentStore.subscribe },
	}
}

export function paginatedFragment<_Fragment extends Fragment<any>>(
	initialValue: _Fragment | null,
	document: GraphQLTagResult
): FragmentStorePaginated<_Fragment['shape'], {}>

export function paginatedFragment<_Fragment extends Fragment<any>>(
	initialValue: _Fragment,
	document: GraphQLTagResult
): FragmentStorePaginated<_Fragment['shape'], {}>

export function paginatedFragment<_Fragment extends Fragment<any>>(
	initialValue: _Fragment | null,
	store: GraphQLTagResult
): FragmentStorePaginated<_Fragment['shape'], {}> {
	// make sure we got a query document
	if (store.kind !== 'HoudiniFragment') {
		throw new Error('paginatedFragment() must be passed a fragment document')
	}
	// if we don't have a pagination fragment there is a problem
	if (!('paginated' in store)) {
		throw new Error('paginatedFragment() must be passed a fragment with @paginate')
	}

	// TODO: fix type checking paginated
	// @ts-ignore: the query store will only include the methods when it needs to
	// and the userland type checking happens as part of the query type generation
	return fragment(store, initialValue)
}
