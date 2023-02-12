import type { StatementKind, TSTypeKind } from 'ast-types/lib/gen/kinds'
import type { Document } from 'houdini'
import { parseJS, path, fs, ArtifactKind, ensureImports } from 'houdini'
import * as recast from 'recast'

import type { PluginGenerateInput } from '..'
import { stores_directory_name, store_name } from '../../kit'

const AST = recast.types.builders

export default async function fragmentTypedefs(input: PluginGenerateInput) {
	// before we update the typedefs lets find all of the fragments so we can overload the correct function
	let fragments: Record<string, Record<string, Document>> = {}

	for (const doc of input.documents) {
		if (doc.kind === ArtifactKind.Fragment) {
			// if the fragment is paginated, add it to the paginated one
			if (doc.refetch?.paginated) {
				fragments = {
					...fragments,
					['paginatedFragment']: {
						...fragments['paginatedFragment'],
						[doc.originalString]: doc,
					},
				}
			}

			// always add the fragment
			fragments = {
				...fragments,
				['fragment']: {
					...fragments['fragment'],
					[doc.originalString]: doc,
				},
			}
		}
	}

	// find the path for the fragment typedefs
	const target_path = path.join(
		input.config.pluginRuntimeDirectory('houdini-svelte'),
		'fragments.d.ts'
	)

	const contents = await parseJS((await fs.readFile(target_path)) || '')!
	if (!contents) {
		return
	}

	function insert_exports(which: string, statements: StatementKind[]) {
		for (const [i, expression] of [...(contents!.script.body ?? [])].entries()) {
			if (
				expression.type !== 'ExportNamedDeclaration' ||
				expression.declaration?.type !== 'TSDeclareFunction' ||
				expression.declaration.id?.name !== which
			) {
				continue
			}

			// it should return the right thing
			contents!.script.body.splice(i, 0, ...statements)

			// we're done
			break
		}
	}

	for (const [which, docs] of Object.entries(fragments)) {
		// insert a definition for every fragment
		insert_exports(
			which,
			Object.entries(docs).flatMap(([queryString, doc]) => {
				if (!doc.generateStore) {
					return []
				}

				// make sure we are importing the store
				const store = store_name({ config: input.config, name: doc.name })
				const import_path = path.join('..', stores_directory_name(), doc.name)
				// build up the documentInput with the query string as a hard coded value
				const fragment_map = AST.tsTypeLiteral([
					AST.tsPropertySignature(
						AST.identifier('$fragments'),
						AST.tsTypeAnnotation(
							AST.tsTypeLiteral([
								AST.tsPropertySignature(
									AST.identifier(doc.name),
									AST.tsTypeAnnotation(
										AST.tsLiteralType(AST.booleanLiteral(true))
									)
								),
							])
						)
					),
				])
				// build up the 2 input options
				const initial_value_input = AST.identifier('initialValue')
				initial_value_input.typeAnnotation = AST.tsTypeAnnotation(fragment_map)
				const initial_value_or_null_input = AST.identifier('initialValue')
				initial_value_or_null_input.typeAnnotation = AST.tsTypeAnnotation(
					AST.tsUnionType([fragment_map, AST.tsNullKeyword()])
				)

				// regardless of the input value, we need to pass the document store
				const document_input = AST.identifier('document')
				document_input.typeAnnotation = AST.tsTypeAnnotation(
					AST.tsTypeReference(AST.identifier(store))
				)

				// if we are generated the paginated definition we need to
				// return the correct value
				let store_type = 'FragmentStoreInstance'
				if (doc.refetch?.paginated) {
					if (doc.refetch.method === 'cursor') {
						store_type = 'CursorFragmentStoreInstance'
					} else {
						store_type = 'OffsetFragmentStoreInstance'
					}
				}

				ensureImports({
					config: input.config,
					body: contents!.script.body!,
					sourceModule: './types',
					import: [store_type],
					importKind: 'type',
				})

				// make sure the store is imported
				ensureImports({
					config: input.config,
					body: contents!.script.body!,
					sourceModule: import_path,
					import: [store],
				})
				const shapeID = `${doc.name}$data`
				const inputID = `${doc.name}$input`
				ensureImports({
					config: input.config,
					body: contents!.script.body!,
					sourceModule: '../../artifacts/' + doc.name,
					import: [inputID, shapeID],
				})

				const typeParams: TSTypeKind[] = [
					AST.tsUnionType([
						AST.tsTypeReference(AST.identifier(shapeID)),
						AST.tsNullKeyword(),
					]),
				]
				if (doc.refetch?.paginated) {
					typeParams.push(AST.tsTypeReference(AST.identifier(inputID)))
				}

				// the return value for no null input
				const return_value = AST.tsTypeReference(
					AST.identifier(store_type),
					AST.tsTypeParameterInstantiation([AST.tsTypeReference(AST.identifier(shapeID))])
				)

				// the return value if there is a null input
				const null_return_value = AST.tsTypeReference(
					AST.identifier(store_type),
					AST.tsTypeParameterInstantiation(typeParams)
				)

				// if the user passes the string, return the correct store
				return [
					AST.exportNamedDeclaration(
						AST.tsDeclareFunction(
							AST.identifier(which),
							[initial_value_input, document_input],
							AST.tsTypeAnnotation(return_value)
						)
					),
					AST.exportNamedDeclaration(
						AST.tsDeclareFunction(
							AST.identifier(which),
							[initial_value_or_null_input, document_input],
							AST.tsTypeAnnotation(null_return_value)
						)
					),
				]
			})
		)
	}

	// write the updated file
	await fs.writeFile(target_path, recast.prettyPrint(contents.script).code)
}
