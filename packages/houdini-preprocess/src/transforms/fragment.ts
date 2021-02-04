// externals
import * as graphql from 'graphql'
import * as recast from 'recast'
import { FragmentDocumentKind } from 'houdini-compiler'
// locals
import { selector, taggedDocuments } from '../utils'
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
	const documents = await taggedDocuments(
		doc,
		doc.instance.content,
		(graphqlDoc) =>
			graphqlDoc.definitions.length === 1 &&
			graphqlDoc.definitions[0].kind === FragmentDocumentKind
	)

	// process each tag
	for (const { parsed, artifact, replaceTag } of documents) {
		// we know its a fragment definition
		const parsedFragment = parsed.definitions[0] as graphql.FragmentDefinitionNode

		// the primary requirement for a fragment is the selector, a function that returns the requested
		// data from the object. we're going to build this up as a function
		// figure out the root type
		const rootType = doc.config.schema.getType(
			parsedFragment.typeCondition.name.value
		) as graphql.GraphQLObjectType
		if (!rootType) {
			throw new Error(
				'Could not find type definition for fragment root' +
					parsedFragment.typeCondition.name.value
			)
		}

		// replace the graphql tag with the object
		replaceTag(
			typeBuilders.objectExpression([
				typeBuilders.objectProperty(
					typeBuilders.stringLiteral('name'),
					typeBuilders.stringLiteral(artifact.name)
				),
				typeBuilders.objectProperty(
					typeBuilders.stringLiteral('kind'),
					typeBuilders.stringLiteral(artifact.kind)
				),
				typeBuilders.objectProperty(
					typeBuilders.stringLiteral('selector'),
					selector({
						config: doc.config,
						artifact,
						rootIdentifier: 'obj',
						rootType,
						selectionSet: parsedFragment.selectionSet,
					})
				),
			])
		)
	}
}
