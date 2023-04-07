import type { TSTypeKind } from 'ast-types/lib/gen/kinds'
import * as recast from 'recast'

import { Config, DocumentArtifact } from '../../../lib'

const AST = recast.types.builders

export function withLoadingState(args: {
	config: Config
	artifact: DocumentArtifact
	base: TSTypeKind
}): TSTypeKind {
	// if the artifact does not have a loading state then we don't need to do anything
	if (!('enableLoadingState' in args.artifact) || !args.artifact.enableLoadingState) {
		return args.base
	}

	// we have a loading state so our final type is a union of the base type and the loading state
	return AST.tsUnionType([args.base, loadingState(args.config, args.artifact)])
}

function loadingState(config: Config, artifact: DocumentArtifact): TSTypeKind {
	return AST.tsNeverKeyword()
}
