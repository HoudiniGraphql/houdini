// externals
import { Config, isListType, isObjectType, getRootType, selectionTypeInfo } from 'houdini-common'
import * as graphql from 'graphql'
import mkdirp from 'mkdirp'
import * as recast from 'recast'
import fs from 'fs/promises'
import { namedTypes } from 'ast-types/gen/namedTypes'
// locals
import { Patch, ConnectionWhen, ConnectionWhenGeneric } from '../../types'
import { PatchAtom, MutationMap } from '.'
import { HoudiniErrorTodo } from '../../error'

const AST = recast.types.builders

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
			if (connectionDirective && selection.kind === 'Field') {
				// grab the name value
				const nameArg = connectionDirective.arguments?.find(
					(argument) => argument.value.kind === 'StringValue' && argument.value.value
				)
				if (!nameArg || nameArg.value.kind !== 'StringValue') {
					throw new Error('could not find name argument')
				}
				const nameVal = nameArg.value.value

				// the field with the decorator defines the type that connections mutate so
				// we need to grab its type and look that up in the schema
				const fieldType = getRootType(
					rootType.getFields()[selection.name.value].type
				) as graphql.GraphQLObjectType<any, any>

				// grab any mutations that modify this field
				let operations = mutationTargets[fieldType.name]?.operations || {}

				// every key in the operation object points to a connection fragment
				// and can contribute an operation to the list of patches
				const newPatches = Object.entries(operations).flatMap<PatchAtom>(
					([fragmentName, mutations]) => {
						// if we are looking at an operation that's relevant for this connection
						if (
							!config.isFragmentForConnection(nameVal, fragmentName) &&
							!fragmentName.startsWith('__houdini__delete')
						) {
							return []
						}

						// `key` points to an argument in the field marked connection, look there for type info
						const { args } = rootType.getFields()[attributeName]

						return Object.entries(mutations).map(
							([
								mutationName,
								{ kind, path, parentID, position, when, connectionName },
							]) => {
								// `when` currently has no type information. let's fix that now
								const typedWhen = Object.entries(when).reduce((acc, [key, val]) => {
									// grab the field we're filtering on
									const arg = args.find(({name}) => name === key)
									if (!arg || !(arg.type instanceof graphql.GraphQLScalarType)) {
										return acc
									}

									let value: ConnectionWhenGeneric[string]
									if (arg.type.name === 'Boolean') {
										value = {
											kind: "Boolean",
											value: val === 'true'
										}
									} else if (arg.type.name === 'String') {
										value = {
											kind: "String",
											value: val
										}
									} else if (arg.type.name === 'Int') {
										value = {
											kind: "Int",
											value: val
										}
									} else if (arg.type.name === 'Float') {
										value = {
											kind: 'Float',
											value: val
										}
									} else {
										throw new Error("Could not identify arg type: " + arg.name)
									}

									return{
										...acc,
										[key]: value
									}}, {})

								return {
								operation: kind,
								mutationName,
								mutationPath: path,
								queryName: name,
								queryPath: pathSoFar,
								parentID,
								position,
								when: typedWhen,
								connectionName,
							}
						}
						)
					}
				)

				// add the patches
				patches.push(...newPatches)
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
			const updateMap: Patch = {}

			// make sure very mutation in the patch ends up in the tree
			for (const {
				mutationPath,
				queryPath,
				operation,
				parentID,
				position,
				when,
				connectionName,
			} of mutations) {
				// the mutation path defines where in the update tree this entry belongs
				let node = updateMap
				for (let i = 0; i < mutationPath.length; i++) {
					// the path entry we are considering
					const pathEntry = mutationPath[i]

					// if we are not at the mutations target field yet
					if (i !== mutationPath.length - 1) {
						if (!node.edges) {
							node.edges = {}
						}

						// we're about to step down, so make sure there is an entry in the target
						// for what will be our parent
						if (!node.edges[pathEntry]) {
							node.edges[pathEntry] = {}
						}

						// keep walking
						node = node.edges[pathEntry]

						// keep going
						continue
					}

					// if we are supposed to be updating a field
					if (operation == 'update') {
						if (!node.fields) {
							node.fields = {}
						}

						// if this is the first time we are treating this entry as a source
						if (!node.fields[pathEntry]) {
							node.fields[pathEntry] = []
						}

						// add the entry to the node's list of fields to update
						node.fields[pathEntry].push(queryPath)

						// we're done with this atom
						continue
					}

					// make sure we have an entry in the operation
					if (!node.edges) {
						node.edges = {}
					}
					if (!node.edges[pathEntry]) {
						node.edges[pathEntry] = {}
					}
					if (!node.edges[pathEntry].operations) {
						node.edges[pathEntry].operations = {}
					}
					if (!node.edges[pathEntry].operations![operation]) {
						node.edges[pathEntry].operations![operation] = []
					}

					// add it to the list of operations one level down since it describes
					// the path entry itself

					// make sure we have a parent id
					if (!parentID) {
						throw new HoudiniErrorTodo('Could not find parentID')
					}

					const operationWhen = Object.entries(when || {}).reduce<ConnectionWhen>((acc, [key, val]) => {
						let value	
						if (val.kind === 'Boolean') {
							value = val.value
						} else if (val.kind === 'Float') {
							value = parseFloat(val.value)
						} else if (val.kind === 'Int') {
							value = parseInt(val.value, 10)
						} else {
							value = val.value
						}

						return {
							...acc,
							[key]: value
						}
					}, {})

					// @ts-ignore just made sure this didn't happen
					node.edges[pathEntry].operations![operation].push(
						// a comment to isolate the ignore
						{
							path: queryPath,
							parentID: {
								kind: parentID.kind,
								value: parentID.value,
							},
							position: position || 'start',
							when: operationWhen,
							connectionName,
						}
					)
				}
			}

			const patch = AST.objectExpression([])

			// we need to build up the patch as an object that the runtime can import
			buildPatch(updateMap, patch)

			// build up the file contents
			const program = AST.program([
				// export the function as a named export
				AST.exportDefaultDeclaration(patch),
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
	// if there are fields updated in this patch
	if (patch.fields && Object.keys(patch.fields).length > 0) {
		targetObject.properties.push(
			// the fields property has a field for every scalar entry in the patch
			AST.objectProperty(
				AST.stringLiteral('fields'),
				AST.objectExpression(
					Object.keys(patch.fields).map((fieldName) => {
						if (!patch.fields) {
							throw new Error('must please typescript gods')
						}

						return AST.objectProperty(
							AST.stringLiteral(fieldName),
							AST.arrayExpression(
								patch.fields[fieldName].map((paths) =>
									AST.arrayExpression(
										paths.map((entry) => AST.stringLiteral(entry))
									)
								)
							)
						)
					})
				)
			)
		)
	}

	// edges
	if (patch.edges && Object.keys(patch.edges).length > 0) {
		targetObject.properties.push(
			// add the edges entry
			AST.objectProperty(
				AST.stringLiteral('edges'),
				AST.objectExpression(
					Object.keys(patch.edges).map((fieldName) => {
						// build up an object expression we will assign in the link object
						const link = AST.objectExpression([])

						if (!patch.edges) {
							throw new Error('must please typescript gods')
						}

						// add the necessary properties to the nested object
						buildPatch(patch.edges[fieldName], link)

						return AST.objectProperty(AST.stringLiteral(fieldName), link)
					})
				)
			)
		)
	}

	// operations
	if (patch.operations && Object.keys(patch.operations).length > 0) {
		targetObject.properties.push(
			// add any operations that we found
			AST.objectProperty(
				AST.stringLiteral('operations'),
				AST.objectExpression(
					(Object.keys(patch.operations) as Array<PatchAtom['operation']>).map(
						(patchOperation) => {
							if (!patch.operations) {
								throw new Error('must please typescript gods')
							}

							return AST.objectProperty(
								AST.stringLiteral(patchOperation),
								AST.arrayExpression(
									(
										patch.operations[patchOperation] || []
									).map(({ parentID, path, position, when, connectionName }) =>
										AST.objectExpression(
											[
												AST.objectProperty(
													AST.stringLiteral('position'),
													AST.stringLiteral(position)
												),
												AST.objectProperty(
													AST.stringLiteral('parentID'),
													AST.objectExpression([
														AST.objectProperty(
															AST.stringLiteral('kind'),
															AST.stringLiteral(parentID.kind)
														),
														AST.objectProperty(
															AST.stringLiteral('value'),
															AST.stringLiteral(parentID.value)
														),
													])
												),
												AST.objectProperty(
													AST.stringLiteral('path'),
													AST.arrayExpression(
														path.map((entry) =>
															AST.stringLiteral(entry)
														)
													)
												),
											]
												.concat(
													!connectionName
														? []
														: AST.objectProperty(
																AST.stringLiteral('connectionName'),
																AST.stringLiteral(connectionName)
														  )
												)
												.concat(
													!when || Object.keys(when).length === 0
														? []
														: AST.objectProperty(
																AST.stringLiteral('when'),
																AST.objectExpression(
																	Object.entries(
																		when
																	).map(([key, val]) =>{
																		// figure out the value
																		let value
																		if (typeof val === 'string') {
																			value = AST.stringLiteral(val)
																		} else if (typeof val === 'boolean') {
																			value = AST.booleanLiteral(val)
																		} else {
																			value = AST.literal(val)
																		}

																		return AST.objectProperty(
																			AST.stringLiteral(key),
																			value
																		)
																	})
																)
														  )
												)
										)
									)
								)
							)
						}
					)
				)
			)
		)
	}
}
