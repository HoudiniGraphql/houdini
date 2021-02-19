import * as graphql from 'graphql'
import { PatchAtom } from './generators/mutations'

// the compiled version of an operation
type BaseCompiledDocument = {
	name: string
	raw: string
	hash: string
}

export const CompiledFragmentKind = 'HoudiniFragment'
export const CompiledMutationKind = 'HoudiniMutation'
export const CompiledQueryKind = 'HoudiniQuery'

export type ConnectionWhen = {
	[key: string]:
		| {
				kind: 'String'
				value: string
		  }
		| {
				kind: 'Boolean'
				value: boolean
		  }
		| {
				kind: 'Int'
				value: string
		  }
		| {
				kind: 'Float'
				value: string
		  }
}

// the information that the compiler leaves behind after processing an operation
export type QueryArtifact = BaseCompiledDocument & {
	kind: 'HoudiniQuery'
}

export type MutationArtifact = BaseCompiledDocument & {
	kind: 'HoudiniMutation'
}

// the information that the compiler leaves behind after processing a fragment
export type FragmentArtifact = BaseCompiledDocument & {
	kind: 'HoudiniFragment'
}

// a description of an interaction between a mutation and a query
export type Patch = {
	operations?: {
		[op in PatchAtom['operation']]?: {
			parentID: {
				kind: 'String' | 'Variable' | 'Root'
				value: string
			}
			position: 'start' | 'end'
			path: string[]
			when?: ConnectionWhen
			connectionName?: string
		}[]
	}
	fields?: { [fieldName: string]: Array<string[]> }
	edges?: { [path: string]: Patch }
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
