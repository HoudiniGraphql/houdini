// externals
import { Config, isListType, isObjectType, getRootType, selectionTypeInfo } from 'houdini-common'
import * as graphql from 'graphql'
import mkdirp from 'mkdirp'
import * as recast from 'recast'
import fs from 'fs/promises'
import { namedTypes } from 'ast-types/gen/namedTypes'
// locals
import { Patch } from '../../types'
import { PatchAtom, MutationMap } from '.'

const typeBuilders = recast.types.builders

// patchesForSelectionSet generates the list of patches that the provided MutationMap creates
// for the given selection set
export function patchesForSelectionSet(
	config: Config,
	mutationTargets: MutationMap,
	name: string,
	rootType: graphql.GraphQLObjectType<any, any>,
	{ selections }: graphql.SelectionSetNode,
	path: string[] = [],
	// recursive reference
	patches: PatchAtom[] = []
): PatchAtom[] {
	// only consider fields in this selection if we have the id present
	const useFields = selections.find(
		(selection) => selection.kind === graphql.Kind.FIELD && selection.name.value === 'id'
	)

	// every selection in the selection set might contribute an patch
	for (const selection of selections) {
		// ignore fragments for now
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
					mutators = mutationTargets[rootType.name].fields[attributeName]
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
						operation: 'update',
						mutationName,
						mutationPath: mutators[mutationName],
						queryName: name,
						queryPath: pathSoFar,
					})
				}
				// we're done processing the leaf node
				continue
			}

			// we are looking at a field that is not a leaf, there is some kind of selection set here
			if (!(selection.selectionSet && (isListType(type) || isObjectType(type)))) {
				continue
			}

			// if the field is marked as a connection
			const connectionDirective = selection.directives?.find(
				(directive) => directive.name.value === config.connectionDirective
			)
			if (connectionDirective) {
				// grab the name value
				const nameArg = connectionDirective.arguments?.find(
					(argument) => argument.value.kind === 'StringValue' && argument.value.value
				)
				if (!nameArg || nameArg.value.kind !== 'StringValue') {
					throw new Error('could not find name argument')
				}
				const nameVal = nameArg.value.value

				// grab any mutations that modify this field
				let mutations =
					mutationTargets[rootType.name].operations[
						config.connectionFragmentName(nameVal)
					] || {}

				// every mutation that adds to the connection needs an entry
				for (const mutationName of Object.keys(mutations)) {
					const { kind, path } = mutations[mutationName]

					// we have an patch
					patches.push({
						operation: kind,
						mutationName,
						mutationPath: path,
						queryName: name,
						queryPath: pathSoFar,
					})
				}
			}

			// walk down the query for more chagnes
			patchesForSelectionSet(
				config,
				mutationTargets,
				name,
				getRootType(type) as graphql.GraphQLObjectType<any, any>,
				selection.selectionSet,
				pathSoFar,
				patches
			)
		}
	}

	// we're done
	return patches
}

export async function generatePatches(config: Config, patchAtoms: PatchAtom[]) {
	// create the directory
	await mkdirp(config.patchDirectory)

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

	// take every set of patches between a query and mutation, merge them together, and generate
	// the single artifact describing the total interaction
	await Promise.all(
		Object.entries(patches).map(async ([patchName, mutations]) => {
			// we need an object that contains every field we want to copy over in this patch
			// grouped together to easily traverse
			const updateMap: Patch = {
				edges: {},
				fields: {},
				operations: {
					add: [],
				},
			}

			// make sure very mutation in the patch ends up in the tree
			for (const { mutationPath, queryPath, operation } of mutations) {
				// the mutation path defines where in the update tree this entry belongs
				let node = updateMap
				for (let i = 0; i < mutationPath.length; i++) {
					// the path entry we are considering
					const pathEntry = mutationPath[i]

					// if we are not at the mutations target field yet
					if (i !== mutationPath.length - 1) {
						// we're about to step down, so make sure there is an entry in the target
						// for what will be our parent
						if (!node.edges[pathEntry]) {
							node.edges[pathEntry] = {
								fields: {},
								edges: {},
								operations: {
									add: [],
								},
							}
						}

						// keep walking
						node = node.edges[pathEntry]

						// keep going
						continue
					}

					// if we are supposed to be updating a field
					if (operation == 'update') {
						// if this is the first time we are treating this entry as a source
						if (!node.fields[pathEntry]) {
							node.fields[pathEntry] = []
						}

						// add the entry to the node's list of fields to update
						node.fields[pathEntry].push(queryPath)

						// we're done with this atom
						continue
					}

					// we could need to copy the response into a tagged connection
					if (operation === 'add') {
						// add it to the list of operations one level down since it describes
						// the path entry itself

						// if this is the first time we've seen this child
						if (!node.edges[pathEntry]) {
							node.edges[pathEntry] = {
								fields: {},
								edges: {},
								operations: {
									add: [],
								},
							}
						}

						const ops = node.edges[pathEntry].operations
						if (!ops[operation]) {
							ops[operation] = []
						}

						// @ts-ignore
						ops[operation].push(queryPath)
					}
				}
			}

			const patch = typeBuilders.objectExpression([])

			// we need to build up the patch as an object that the runtime can import
			buildPatch(updateMap, patch)

			// build up the file contents
			const program = typeBuilders.program([
				// export the function as a named export
				typeBuilders.exportDefaultDeclaration(patch),
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
	targetObject.properties.push(
		// the fields property has a field for every scalar entry in the patch
		typeBuilders.objectProperty(
			typeBuilders.stringLiteral('fields'),
			typeBuilders.objectExpression(
				Object.keys(patch.fields).map((fieldName) =>
					typeBuilders.objectProperty(
						typeBuilders.stringLiteral(fieldName),
						typeBuilders.arrayExpression(
							patch.fields[fieldName].map((paths) =>
								typeBuilders.arrayExpression(
									paths.map((entry) => typeBuilders.stringLiteral(entry))
								)
							)
						)
					)
				)
			)
		),
		// add the edges entry
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
		),
		// add any operations that we found
		typeBuilders.objectProperty(
			typeBuilders.stringLiteral('operations'),
			typeBuilders.objectExpression(
				(Object.keys(patch.operations) as Array<
					keyof typeof patch.operations
				>).map((patchOperation) =>
					typeBuilders.objectProperty(
						typeBuilders.stringLiteral(patchOperation),
						typeBuilders.arrayExpression(
							(patch.operations[patchOperation] || []).map((paths) =>
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
}
