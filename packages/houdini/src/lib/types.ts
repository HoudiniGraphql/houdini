import type * as recast from 'recast'
import type { SourceMapInput } from 'rollup'

import type { Config } from './config.js'

// the correct component tree for a given url
export type ProjectManifest = {
	/** All of the pages in the project */
	pages: Record<string, PageManifest>
	/** All of the layouts in the project */
	layouts: Record<string, PageManifest>
	/** All of the page queries in the project */
	page_queries: Record<string, QueryManifest>
	/** All of the layout queries in the project */
	layout_queries: Record<string, QueryManifest>
	/** All of the artifacts in the project */
	artifacts: string[]
	/** Whether or not there is a local schema defined */
	local_schema: boolean
	/** Whether or not there is a custom instance of yoga defined */
	local_yoga: boolean
	/** Information about componentFields defined in the project */
	component_fields: Record<string, { filepath: string }>
}

export type PageManifest = {
	id: string
	/** the name of every query that the page depends on */
	queries: string[]
	/** the list of queries that this page could potentially ask for */
	query_options: string[]
	/** the full url pattern of the page */
	url: string
	/** the ids of layouts that wrap this page */
	layouts: string[]
	/** The filepath of the unit */
	path: string
	/**
	 * The name and type of every route paramter that this page can use.
	 * null indicates the type is unknown (not constrained by a query)
	 **/
	params: Record<string, { type: string; wrappers: string[] } | null>
}

export type QueryManifest = {
	/** the name of the query */
	name: string
	/** the url tied with the query */
	url: string
	/** wether the query uses the loading directive (ie, wants a fallback) */
	loading: boolean
	/** The filepath of the unit */
	path: string
	/** The name and GraphQL type for the variables that this query cares about */
	variables: Record<string, { wrappers: string[]; type: string }>
}
export const PaginateMode = {
	Infinite: 'Infinite',
	SinglePage: 'SinglePage',
} as const

type ValuesOf<T> = T[keyof T]

export type PaginateModes = ValuesOf<typeof PaginateMode>

export const CachePolicy = {
	CacheOrNetwork: 'CacheOrNetwork',
	CacheOnly: 'CacheOnly',
	NetworkOnly: 'NetworkOnly',
	CacheAndNetwork: 'CacheAndNetwork',
	NoCache: 'NoCache',
} as const

export type CachePolicies = ValuesOf<typeof CachePolicy>

export type Maybe<T> = T | null | undefined

export type Script = Program

type Program = recast.types.namedTypes.Program

export interface TransformPage {
	config: Config
	content: string
	map?: SourceMapInput
	filepath: string
	watch_file: (path: string) => void
}

export const ArtifactKind = {
	Query: 'HoudiniQuery',
	Subscription: 'HoudiniSubscription',
	Mutation: 'HoudiniMutation',
	Fragment: 'HoudiniFragment',
} as const

export type ArtifactKinds = ValuesOf<typeof ArtifactKind>

export const CompiledFragmentKind = ArtifactKind.Fragment
export const CompiledMutationKind = ArtifactKind.Mutation
export const CompiledQueryKind = ArtifactKind.Query
export const CompiledSubscriptionKind = ArtifactKind.Subscription

export type CompiledDocumentKind = ArtifactKinds
