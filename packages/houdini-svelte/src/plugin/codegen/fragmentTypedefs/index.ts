import type { StatementKind } from 'ast-types/lib/gen/kinds'
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
						[doc.original_string]: doc,
					},
				}
			}

			// always add the fragment
			fragments = {
				...fragments,
				['fragment']: {
					...fragments['fragment'],
					[doc.original_string]: doc,
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
				if (!doc.generate_store) {
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

				// the return value
				const return_value = AST.tsTypeReference(
					AST.identifier('ReturnType'),
					AST.tsTypeParameterInstantiation([
						AST.tsIndexedAccessType(
							AST.tsTypeReference(AST.identifier(store)),
							AST.tsLiteralType(AST.stringLiteral('get'))
						),
					])
				)

				// make sure the store is imported
				ensureImports({
					config: input.config,
					body: contents!.script.body!,
					sourceModule: import_path,
					import: [store],
				})

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
							AST.tsTypeAnnotation(
								AST.tsUnionType([return_value, AST.tsNullKeyword()])
							)
						)
					),
				]
			})
		)
	}

	// write the updated file
	await fs.writeFile(target_path, recast.prettyPrint(contents.script).code)
}
