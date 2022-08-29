import type * as graphql from 'graphql'

import { Config } from '../common'
import { BaseCompiledDocument, ArtifactKind } from '../runtime/lib/types'

export type { ConfigFile } from '../runtime/lib'
export * from '../runtime/lib/types'

// the result of collecting documents from source code
export type CollectedGraphQLDocument = {
	kind: ArtifactKind
	filename: string
	name: string
	document: graphql.DocumentNode
	originalDocument: graphql.DocumentNode
	generateArtifact: boolean
	generateStore: boolean
	originalString: string
	refetch?: BaseCompiledDocument['refetch']
}

export type TypeCheckTransformer = (
	config: Config,
	docs: CollectedGraphQLDocument[]
) => Promise<void>

export type PaginateTranformer = (
	config: Config,
	documents: CollectedGraphQLDocument[]
) => Promise<void>

export type ListTranformer = (
	config: Config,
	documents: CollectedGraphQLDocument[]
) => Promise<void>

export type CustomTransformers = {
	typeCheck?: TypeCheckTransformer
	paginate?: PaginateTranformer
	list?: ListTranformer
}
