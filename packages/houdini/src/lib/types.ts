import graphql from 'graphql'
import * as recast from 'recast'

import { ArtifactKind, BaseCompiledDocument } from '../runtime/lib/types'
import type { Config } from './config'

type Program = recast.types.namedTypes.Program

export type Maybe<T> = T | null | undefined

export type Script = Program

export type TransformDocument = {
	instance: Maybe<Script>
	config: Config
	dependencies: string[]
	filename: string
}

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

export * from '../runtime/lib/types'
export * from '../runtime/lib/config'
