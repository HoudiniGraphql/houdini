// externals
import { Config, isListType, isObjectType, getRootType, selectionTypeInfo } from 'houdini-common'
import * as graphql from 'graphql'
import mkdirp from 'mkdirp'
import * as recast from 'recast'
import fs from 'fs/promises'
import { namedTypes } from 'ast-types/gen/namedTypes'
// locals
import { CollectedGraphQLDocument, Patch } from '../types'
import { moduleExport } from '../utils'

const typeBuilders = recast.types.builders

// We consider every query and every mutation that could affect it. This can only possibly
// happen if we get the {id} of the type in the payload. Therefore we're going to look at
// every mutation and collect the types in the payload with {id} in their selection set.
// Then look at every query and fragment to see if it asks for the type. If so, then
// we need to generate something the runtime can use.

// keep track of which mutation affects which fields of which type
// we need to map types to fields to the mutations that update it
type MutationMap = {
	[typeName: string]: {
		[fieldName: string]: {
			[mutationName: string]: string[]
		}
	}
}

// another intermediate type used when building up the mutation description
type PatchAtom = {
	mutationName: string
	mutationPath: string[]
	queryName: string
	queryPath: string[]
}

export default async function mutationGenerator(config: Config, docs: CollectedGraphQLDocument[]) {
	// make sure the mutation directory exists
	await mkdirp(config.patchDirectory)

	// build up a map of mutations to the types they modify
	const mutationTargets: MutationMap = {}

	// look at every document for one containing a mutation
	for (const { name, document } of docs) {
		// look for a mutation definition in the document
		const definition = document.definitions.find(
			(definition) =>
				definition.kind === graphql.Kind.OPERATION_DEFINITION &&
				definition.operation === 'mutation'
		) as graphql.OperationDefinitionNode

		// if there isn't one, we dont care about this document
		if (!definition) {
			continue
		}

		// the first level of selections are the mutations triggered by the document
		// we can push it through the recursion like normal. we'll only run into problems
		// if one of the mutations is named or aliased 'id'
		if (
			definition.selectionSet.selections.find(
				(selection) =>
					selection.kind === graphql.Kind.FIELD &&
					(selection.alias?.value || selection.name.value) === 'id'
			)
		) {
			throw new Error('Encountered mutation named id.')
		}

		const mutationType = config.schema.getMutationType()
		if (!mutationType) {
			throw new Error('Schema does not have a mutation type defined.')
		}

		// collect all of the fields referenced by the mutation
		// and fragments within the mutation since those are the fields that we
		// will update in response to the mutation
		fillMutationMap(config, mutationTargets, name, mutationType, definition.selectionSet, [])
	}

	// now that we know which fields the mutation can update we can walk through every document
	// and look for queries or fragments that intersect with the fields changed by the mutations
	const patches: PatchAtom[] = []

	// we will run into the same document many times so we have to make sure we are only processing a document once
	const _docsVisited: { [name: string]: boolean } = {}

	// every document with a query might have an patch with a mutation, the compiler identifier
	// doesn't matter because multiple documents could include the same fragment.
	for (const definition of docs.flatMap(({ document }) => document.definitions)) {
		// we only care about fragments or query definitions
		if (
			definition.kind !== graphql.Kind.FRAGMENT_DEFINITION &&
			(definition.kind !== graphql.Kind.OPERATION_DEFINITION ||
				definition.operation !== 'query')
		) {
			continue
		}
		// if there's no name (shouldn't make it this far but lets keep typescript happy)
		if (!definition.name) {
			throw new Error('Encountered document with no name')
		}

		// if we have seen this document already, ignore it
		if (_docsVisited[definition.name.value]) {
			continue
		}

		// find the root type
		const rootType =
			definition.kind === graphql.Kind.OPERATION_DEFINITION
				? config.schema.getQueryType()
				: (config.schema.getType(
						definition.typeCondition.name.value
				  ) as graphql.GraphQLObjectType<any, any>)

		// make sure we found something
		if (!rootType) {
			throw new Error('could not find root type for document: ' + definition.name.value)
		}

		// compute and add the patches
		addPatchs(
			config,
			patches,
			mutationTargets,
			definition.name.value,
			rootType,
			definition.selectionSet
		)

		// we're done with this document
		_docsVisited[definition.name.value] = true
	}

	// we now have a list of every possible patch
	await generateFiles(config, patches)
}

function fillMutationMap(
	config: Config,
	mutationTargets: MutationMap,
	name: string,
	rootType: graphql.GraphQLObjectType<any, any>,
	selectionSet: graphql.SelectionSetNode,
	path: string[]
) {
	// only consider fields in this selection if we have the id present
	const useFields = selectionSet.selections.find(
		(selection) => selection.kind === graphql.Kind.FIELD && selection.name.value === 'id'
	)

	// every field in the selection set could contribute to the mutation's targets
	for (const selection of selectionSet.selections) {
		// look up the type of the selection
		const { type, field } = selectionTypeInfo(config.schema, rootType, selection)

		// ignore any fragment spreads
		if (selection.kind === graphql.Kind.FRAGMENT_SPREAD) {
			continue
		}

		// process inline fragments
		if (selection.kind === graphql.Kind.INLINE_FRAGMENT) {
			continue
		}

		// if we are looking at a normal field
		if (selection.kind === graphql.Kind.FIELD) {
			const attributeName = selection.alias?.value || selection.name.value

			// since the id field is used to filter out a mutation, we don't want to register
			// that the mutation will update the id field
			if (attributeName === 'id') {
				continue
			}

			// add the field name to the path
			const pathSoFar = path.concat(attributeName)

			// if the field is a scalar type and there is an id field
			if (graphql.isLeafType(type) && useFields) {
				if (!mutationTargets[rootType.name]) {
					mutationTargets[rootType.name] = {}
				}
				if (!mutationTargets[rootType.name][attributeName]) {
					mutationTargets[rootType.name][attributeName] = {}
				}
				// add the field to the list of things that the mutation can update
				mutationTargets[rootType.name][attributeName][name] = pathSoFar

				// we're done
				continue
			}

			// if the field is points to another type (is an object or list)
			if (selection.selectionSet && (isListType(type) || isObjectType(type))) {
				// walk down the query for more chagnes
				fillMutationMap(
					config,
					mutationTargets,
					name,
					getRootType(type) as graphql.GraphQLObjectType<any, any>,
					selection.selectionSet,
					pathSoFar
				)
			}
		}
	}
}

function addPatchs(
	config: Config,
	patches: PatchAtom[],
	mutationTargets: MutationMap,
	name: string,
	rootType: graphql.GraphQLObjectType<any, any>,
	{ selections }: graphql.SelectionSetNode,
	path: string[] = []
) {
	// only consider fields in this selection if we have the id present
	const useFields = selections.find(
		(selection) => selection.kind === graphql.Kind.FIELD && selection.name.value === 'id'
	)

	// every selection in the selection set might contribute an patch
	for (const selection of selections) {
		// ignore any fragment spreads
		if (selection.kind === graphql.Kind.FRAGMENT_SPREAD) {
			continue
		}

		// inline fragments
		if (selection.kind === graphql.Kind.INLINE_FRAGMENT) {
			continue
		}

		// get the type info for the selection
		const { type } = selectionTypeInfo(config.schema, rootType, selection)

		// if we are looking at a normal field
		if (selection.kind === graphql.Kind.FIELD) {
			const attributeName = selection.alias?.value || selection.name.value
			const pathSoFar = path.concat(attributeName)

			// don't consider id for intersections
			if (attributeName === 'id') {
				continue
			}

			// if the field is a scalar, it could be updated by a mutation (needs an entry in patches)
			if (graphql.isLeafType(type) && useFields) {
				// grab the object mapping mutation names to the path in response that updates this field
				let mutators
				// look up the field in mutation map
				try {
					mutators = mutationTargets[rootType.name][attributeName]
				} catch (e) {
					continue
				}

				// if nothing mutates this field
				if (!mutators) {
					// ignore it
					continue
				}

				for (const mutationName of Object.keys(mutators)) {
					// we have an patch
					patches.push({
						mutationName,
						mutationPath: mutators[mutationName],
						queryName: name,
						queryPath: pathSoFar,
					})
				}
				// we're done processing the leaf node
				continue
			}

			// if the field is points to another type (is an object or list)
			if (selection.selectionSet && (isListType(type) || isObjectType(type))) {
				// walk down the query for more chagnes
				addPatchs(
					config,
					patches,
					mutationTargets,
					name,
					getRootType(type) as graphql.GraphQLObjectType<any, any>,
					selection.selectionSet,
					pathSoFar
				)
			}
		}
	}
}

async function generateFiles(config: Config, patchAtoms: PatchAtom[]) {
	// there could be more than one patch between a query and mutation
	// so group up all patches pairs
	const patches: { [name: string]: PatchAtom[] } = {}
	for (const patch of patchAtoms) {
		// the patch name
		const name = config.patchName({
			query: patch.queryName,
			mutation: patch.mutationName,
		})

		// if we haven't seen the patch before, put down a list we can call home
		if (!patches[name]) {
			patches[name] = []
		}

		// add the patch to the list
		patches[name].push(patch)
	}

	// every patch needs a file
	await Promise.all(
		Object.keys(patches).map(async (patchName) => {
			// grab the list of things that will change because of this patch
			const mutations = patches[patchName]

			// we need an object that contains every field we want to copy over in this patch
			// grouped together to easily traverse
			const updateMap: Patch = {
				edges: {},
				scalars: {},
			}

			// make sure very mutation in the patch ends up in the tree
			for (const { mutationPath, queryPath } of mutations) {
				// the mutation path defines where in the update tree this entry belongs
				let node = updateMap
				for (let i = 0; i < mutationPath.length; i++) {
					// the path entry we are considering
					const pathEntry = mutationPath[i]

					// if we are at the end of the path
					if (i === mutationPath.length - 1) {
						// if this is the first time we are treating this entry as a source
						if (!node.scalars[pathEntry]) {
							node.scalars[pathEntry] = []
						}

						// add the entry to the node's list of scalars to update
						node.scalars[pathEntry].push(queryPath)

						// we're done with this atom
						continue
					}

					// if this is the first time we've encountered this field in the response
					if (!node.edges[pathEntry]) {
						node.edges[pathEntry] = {
							scalars: {},
							edges: {},
						}
					}

					// keep walking
					node = node.edges[pathEntry]
				}
			}

			const patch = typeBuilders.objectExpression([])

			// we need to build up the patch as an object that the runtime can import
			buildPatch(updateMap, patch)

			// build up the file contents
			const program = typeBuilders.program([
				// export the function as a named export
				moduleExport('default', patch),
			])

			// figure out the path for the patch
			// note: the query and mutation names are the same for every mutation in the patch
			const filePath = config.patchPath({
				query: mutations[0].queryName,
				mutation: mutations[0].mutationName,
			})

			// write the contents of the file to the location
			await fs.writeFile(filePath, recast.print(program).code, 'utf-8')
		})
	)
}

function buildPatch(patch: Patch, targetObject: namedTypes.ObjectExpression) {
	// the scalar object has a field for every scalar entry in the patch
	targetObject.properties.push(
		typeBuilders.objectProperty(
			typeBuilders.stringLiteral('scalars'),
			typeBuilders.objectExpression(
				Object.keys(patch.scalars).map((fieldName) =>
					typeBuilders.objectProperty(
						typeBuilders.stringLiteral(fieldName),
						typeBuilders.arrayExpression(
							patch.scalars[fieldName].map((paths) =>
								typeBuilders.arrayExpression(
									paths.map((entry) => typeBuilders.stringLiteral(entry))
								)
							)
						)
					)
				)
			)
		)
	)

	// add the edges entry
	targetObject.properties.push(
		typeBuilders.objectProperty(
			typeBuilders.stringLiteral('edges'),
			typeBuilders.objectExpression(
				Object.keys(patch.edges).map((fieldName) => {
					// build up an object expression we will assign in the link object
					const link = typeBuilders.objectExpression([])

					// add the necessary properties to the nested object
					buildPatch(patch.edges[fieldName], link)

					return typeBuilders.objectProperty(typeBuilders.stringLiteral(fieldName), link)
				})
			)
		)
	)
}
