import type { Fragment, FragmentArtifact } from '$houdini/runtime/lib/types'
import type { Readable } from 'svelte/store'

import type { FragmentStore } from './stores'
import type { FragmentStorePaginated } from './stores/pagination/fragment'

// function overloads meant to only return a nullable value
// if the reference type was nullable
export function fragment<_Fragment extends Fragment<any>>(
	ref: _Fragment,
	fragment: FragmentStore<_Fragment['shape'], {}>
): Readable<Exclude<_Fragment['shape'], undefined>> & {
	data: Readable<_Fragment>
	artifact: FragmentArtifact
}
export function fragment<_Fragment extends Fragment<any>>(
	ref: _Fragment | null,
	fragment: FragmentStore<_Fragment['shape'], {}>
): Readable<Exclude<_Fragment['shape'], undefined> | null> & {
	data: Readable<_Fragment | null>
	artifact: FragmentArtifact
}
export function fragment<_Fragment extends Fragment<any>>(
	ref: _Fragment | null,
	store: FragmentStore<_Fragment['shape'], {}>
) {
	// make sure we got a query document
	if (store.kind !== 'HoudiniFragment') {
		throw new Error(`fragment can only take fragment documents. Found: ${store.kind}`)
	}

	// load the fragment store for the value
	const fragmentStore = store.get(ref)

	return {
		...fragmentStore,
		artifact: store.artifact,
		data: { subscribe: fragmentStore.subscribe },
	}
}

export function paginatedFragment<_Fragment extends Fragment<any>>(
	initialValue: _Fragment | null,
	document: FragmentStore<_Fragment['shape'], {}>
): FragmentStorePaginated<_Fragment['shape'], {}>

export function paginatedFragment<_Fragment extends Fragment<any>>(
	initialValue: _Fragment,
	document: FragmentStore<_Fragment['shape'], {}>
): FragmentStorePaginated<_Fragment['shape'], {}>

export function paginatedFragment<_Fragment extends Fragment<any>>(
	initialValue: _Fragment | null,
	store: FragmentStore<_Fragment['shape'], {}>
): FragmentStorePaginated<_Fragment['shape'], {}> {
	// make sure we got a query document
	if (store.kind !== 'HoudiniFragment') {
		throw new Error('paginatedFragment() must be passed a fragment document: ' + store.kind)
	}
	// if we don't have a pagination fragment there is a problem
	if (!('paginated' in store)) {
		throw new Error('paginatedFragment() must be passed a fragment with @paginate')
	}

	// TODO: fix type checking paginated
	// @ts-ignore: the query store will only include the methods when it needs to
	// and the userland type checking happens as part of the query type generation
	return fragment(initialValue, store)
}
