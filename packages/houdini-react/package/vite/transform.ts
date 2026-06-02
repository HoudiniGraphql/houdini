import * as graphql from 'graphql'
import {
	ArtifactKind,
	artifact_import,
	ensure_imports,
	find_graphql,
	parseJS,
	path,
	printJS,
} from 'houdini'
import type { TransformPage } from 'houdini'
import { componentField_unit_path, houdini_root } from 'houdini/router/conventions'
import * as recast from 'recast'
import type { SourceMapInput } from 'rollup'

const AST = recast.types.builders

export type ComponentFieldRow = { type: string; field: string; fragment: string }

export async function transform_file(
	page: TransformPage,
	cfRows: ComponentFieldRow[]
): Promise<{ code: string; map?: SourceMapInput }> {
	const isJSX = page.filepath.endsWith('.tsx') || page.filepath.endsWith('.jsx')
	if (!isJSX && !page.filepath.endsWith('.ts') && !page.filepath.endsWith('.js')) {
		return { code: page.content, map: page.map }
	}

	const script = parseJS(page.content, isJSX ? { plugins: ['jsx'] } : {})

	const cfMap: Record<string, Record<string, string>> = {}
	for (const row of cfRows) {
		if (row.type && row.field && row.fragment) {
			cfMap[row.type] ??= {}
			cfMap[row.type][row.field] = row.fragment
		}
	}

	await find_graphql(page.config, script, {
		skipGraphqlType: true,
		tag({ node, artifact, parsedDocument }) {
			const { id: artifactRef } = artifact_import({ page, script, artifact })

			const properties = [AST.objectProperty(AST.stringLiteral('artifact'), artifactRef)]

			if (is_paginated(parsedDocument)) {
				if (artifact.kind !== ArtifactKind.Query) {
					// fragment/subscription pagination: the refetch artifact is a separate query
					const refetchName = artifact.name + '_Pagination_Query'
					const { id: refetchRef } = artifact_import({
						page,
						script,
						artifact: { name: refetchName },
					})
					properties.push(
						AST.objectProperty(AST.stringLiteral('refetchArtifact'), refetchRef)
					)
				} else {
					// query pagination uses itself as the refetch artifact
					properties.push(
						AST.objectProperty(AST.stringLiteral('refetchArtifact'), artifactRef)
					)
				}
			}

			// add side-effect imports for any component fields referenced in this document
			if (Object.keys(cfMap).length > 0) {
				const typeInfo = new graphql.TypeInfo(page.config.schema)
				graphql.visit(
					parsedDocument,
					graphql.visitWithTypeInfo(typeInfo, {
						Field(fieldNode) {
							const parentType = typeInfo.getParentType()
							const typeName = parentType?.name
							if (!typeName) return
							const fragmentName = cfMap[typeName]?.[fieldNode.name.value]
							if (!fragmentName) return

							const entryPointPath = componentField_unit_path(
								page.config,
								fragmentName
							)
							ensure_imports({
								script,
								sourceModule:
									'$houdini/' +
									path.relative(houdini_root(page.config), entryPointPath),
							})
						},
					})
				)
			}

			node.replaceWith(AST.objectExpression(properties))
		},
	})

	return printJS(script)
}

function is_paginated(doc: graphql.DocumentNode): boolean {
	let paginated = false
	graphql.visit(doc, {
		Directive(node) {
			if (node.name.value === 'paginate') {
				paginated = true
			}
		},
	})
	return paginated
}
