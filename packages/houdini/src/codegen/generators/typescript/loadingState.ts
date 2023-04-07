import type { TSTypeKind } from 'ast-types/lib/gen/kinds'
import * as recast from 'recast'

import { Config, DocumentArtifact } from '../../../lib'

const AST = recast.types.builders

// so the general approach to adding the loading state is to add the base type to a union
// with the type that describes the loading state. this makes it easy for the user to build
// loading UIs by just looking at a single value. If any value is LoadingValue then typescript
// will be able to infer the rest of the loading fields

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
