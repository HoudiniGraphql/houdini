// externals
import * as graphql from 'graphql'
import * as recast from 'recast'
import { asyncWalk } from 'estree-walker'
import { TaggedTemplateExpression, Identifier } from 'estree'
import { CompiledDocument } from 'houdini-compiler'
import { OperationDefinitionNode } from 'graphql/language'
import { Script } from 'svelte/types/compiler/interfaces'
import path from 'path'
// locals
import { selector } from '../utils'
import { TransformDocument } from '../types'
const typeBuilders = recast.types.builders

// returns the expression that should replace the graphql
export default async function fragmentProcesesor(doc: TransformDocument): Promise<void> {
	// we need to find any graphql documents in the instance script containing fragments
	// and replace them with an object expression that has the keys that the runtime expects

	// if there is no instance script, we dont about care this file
	if (!doc.instance) {
		return
	}

	// look for any graphql documents in the file's script that contain fragments and no queries
	// note: any documents that we do want to keep will be added to the list of dependencies that
	// we watch for changes
}

// const parsedFragment = doc.definitions[0] as graphql.FragmentDefinitionNode
// // the primary requirement for a fragment is the selector, a function that returns the requested
// // data from the object. we're going to build this up as a function
// // figure out the root type
// const rootType = doc.config.schema.getType(
// 	parsedFragment.typeCondition.name.value
// ) as graphql.GraphQLObjectType
// if (!rootType) {
// 	throw new Error(
// 		'Could not find type definition for fragment root' +
// 			parsedFragment.typeCondition.name.value
// 	)
// }

// add the selector to the inlined object
// const replacement = typeBuilders.objectExpression([
// 	typeBuilders.objectProperty(
// 		typeBuilders.stringLiteral('name'),
// 		typeBuilders.stringLiteral(document.name)
// 	),
// 	typeBuilders.objectProperty(
// 		typeBuilders.stringLiteral('kind'),
// 		typeBuilders.stringLiteral(document.kind)
// 	),
// 	typeBuilders.objectProperty(
// 		typeBuilders.stringLiteral('selector'),
// 		selector({
// 			config,
// 			artifact: document,
// 			rootIdentifier: 'obj',
// 			rootType,
// 			selectionSet: parsedFragment.selectionSet,
// 		})
// 	),
// ])
