import * as graphql from 'graphql'
export { PatchAtom, Patch, ConnectionWhen, TypeLinks } from './generators/runtime/template/types'
import { TypeLinks } from './generators/runtime/template/cache'

// the compiled version of an operation
type BaseCompiledDocument = {
	name: string
	raw: string
	hash: string
}

export const CompiledFragmentKind = 'HoudiniFragment'
export const CompiledMutationKind = 'HoudiniMutation'
export const CompiledQueryKind = 'HoudiniQuery'

export type CompiledDocumentKind = 'HoudiniFragment' | 'HoudiniMutation' | 'HoudiniQuery'

// the information that the compiler leaves behind after processing an operation
export type QueryArtifact = BaseCompiledDocument & {
	kind: 'HoudiniQuery'
	responseInfo: TypeLinks
}

export type MutationArtifact = BaseCompiledDocument & {
	kind: 'HoudiniMutation'
	responseInfo: TypeLinks
}

// the information that the compiler leaves behind after processing a fragment
export type FragmentArtifact = BaseCompiledDocument & {
	kind: 'HoudiniFragment'
}

// any compiled result
export type DocumentArtifact = FragmentArtifact | QueryArtifact | MutationArtifact

// the result of collecting documents from source code
export type CollectedGraphQLDocument = {
	filename: string
	name: string
	document: graphql.DocumentNode
	originalDocument: graphql.DocumentNode
	printed: string
}
