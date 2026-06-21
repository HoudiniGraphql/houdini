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

import { strip_named_export } from './strip-headers.js'

const AST = recast.types.builders

export type ComponentFieldRow = { type: string; field: string; fragment: string }

export async function transform_file(
	page: TransformPage,
	cfRows: ComponentFieldRow[],
	opts: { stripHeaders?: boolean } = {}
): Promise<{ code: string; map?: SourceMapInput }> {
	const isJSX = page.filepath.endsWith('.tsx') || page.filepath.endsWith('.jsx')
	if (!isJSX && !page.filepath.endsWith('.ts') && !page.filepath.endsWith('.js')) {
		return { code: page.content, map: page.map }
	}

	const script = parseJS(page.content, isJSX ? { plugins: ['jsx'] } : {})

	// The headers() export of a +page/+layout only ever runs on the server. When
	// building for the client we strip it so server-only logic (secrets, env
	// vars) it might read never ends up in the browser bundle. Rollup keeps it
	// otherwise: route views become preserved-signature chunks, so an unused
	// export isn't tree-shaken away on its own.
	if (opts.stripHeaders) {
		strip_named_export(script, 'headers')
	}

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

			// both @paginate and @refetchable fragments embed the document in a
			// separate query that useFragmentHandle uses to refetch.
			if (is_paginated(parsedDocument) || is_refetchable(parsedDocument)) {
				if (artifact.kind !== ArtifactKind.Query) {
					// fragment/subscription pagination (and @refetchable): the refetch
					// artifact is a separate query. @paginate embeds a _Pagination_Query;
					// @refetchable embeds a _Refetch_Query.
					const refetchName =
						artifact.name +
						(is_paginated(parsedDocument) ? '_Pagination_Query' : '_Refetch_Query')
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

function is_refetchable(doc: graphql.DocumentNode): boolean {
	let refetchable = false
	graphql.visit(doc, {
		Directive(node) {
			if (node.name.value === 'refetchable') {
				refetchable = true
			}
		},
	})
	return refetchable
}
