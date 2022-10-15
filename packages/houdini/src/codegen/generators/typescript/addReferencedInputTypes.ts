import type { StatementKind, TSPropertySignatureKind } from 'ast-types/gen/kinds'
import * as graphql from 'graphql'
import * as recast from 'recast'

import { Config, ensureImports, HoudiniError } from '../../../lib'
import { unwrapType } from '../../utils'
import { tsTypeReference } from './typeReference'

const AST = recast.types.builders

// add any object types found in the input
export function addReferencedInputTypes(
	config: Config,
	filepath: string,
	body: StatementKind[],
	visitedTypes: Set<string>,
	missingScalars: Set<string>,
	rootType: graphql.TypeNode
) {
	// try to find the name of the type
	const { type } = unwrapType(config, rootType)

	// if we are looking at a scalar
	if (graphql.isScalarType(type)) {
		// we're done
		return
	}

	// if we have already processed this type, don't do anything
	if (visitedTypes.has(type.name)) {
		return
	}

	// if we ran into a union
	if (graphql.isUnionType(type)) {
		// we don't support them yet
		throw new HoudiniError({ filepath, message: 'Input Unions are not supported yet. Sorry!' })
	}

	// track that we are processing the type
	visitedTypes.add(type.name)

	// if we ran into an enum, add its definition to the file
	if (graphql.isEnumType(type)) {
		// we need to add an import for the enum
		ensureImports({
			config,
			// @ts-ignore
			body,
			import: [type.name],
			sourceModule: '$houdini/graphql/enums',
			importKind: 'type',
		})
		return
	}

	// we found an object type so build up the list of fields (and walk down any object fields)
	const members: TSPropertySignatureKind[] = []

	for (const field of Object.values(type.getFields())) {
		// walk down the referenced fields and build stuff back up
		addReferencedInputTypes(config, filepath, body, visitedTypes, missingScalars, field.type)

		// check if the type is optional so we can label the value as optional

		members.push(
			AST.tsPropertySignature(
				AST.identifier(field.name),
				AST.tsTypeAnnotation(tsTypeReference(config, missingScalars, field)),
				graphql.isNullableType(field.type)
			)
		)
	}

	// add the type def to the body
	body.push(AST.tsTypeAliasDeclaration(AST.identifier(type.name), AST.tsTypeLiteral(members)))
}
