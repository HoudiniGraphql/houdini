import { logYellow } from '@kitql/helper'
import type { ExpressionKind } from 'ast-types/lib/gen/kinds'
import * as graphql from 'graphql'
import type { Config } from 'houdini'
import { fs, parseJS, path } from 'houdini'
import type * as recast from 'recast'
import { transformWithEsbuild } from 'vite'

import type { HoudiniRouteScript } from './kit'
import { stores_directory_name, store_suffix } from './kit'
import { houdini_load_fn } from './naming'

type Program = recast.types.namedTypes.Program
type VariableDeclaration = recast.types.namedTypes.VariableDeclaration

export async function extract_load_function(
	config: Config,
	filepath: string,
	mockArtifacts?: Record<string, { raw: string }>
): Promise<HoudiniRouteScript> {
	const nil: HoudiniRouteScript = {
		houdini_load: [],
		exports: [],
	}

	// read the source contents
	const contents = await fs.readFile(filepath)
	if (!contents) {
		return nil
	}

	// parse the contents
	let transformed = contents
	if (filepath.endsWith('.ts')) {
		transformed = (await transformWithEsbuild(contents, filepath)).code
	}
	if (transformed === null) {
		return nil
	}
	const parsed = await parseJS(transformed)
	if (!parsed) {
		return nil
	}

	// analyze the script for its exports and loaded function
	const { exports, load } = await processScript(config, filepath, parsed, mockArtifacts)

	return {
		exports,
		// we need to parse the strings we got as graphql documents
		houdini_load: load.map(
			(query) => graphql.parse(query).definitions[0] as graphql.OperationDefinitionNode
		),
	}
}

async function processScript(
	config: Config,
	filepath: string,
	program: Program,
	mockArtifacts?: Record<string, { raw: string }>
): Promise<{ load: string[]; exports: string[] }> {
	const exports: string[] = []

	// we need a mapping to global imports and their query
	const globalImports: Record<string, string> = {}

	// hold onto the houdini_load reference when we find it
	let houdiniLoad: null | ExpressionKind = null

	// process the file
	for (const statement of program.body) {
		// import analysis
		if (statement.type === 'ImportDeclaration') {
			const source = statement.source.value?.toString()

			// skip over any imports not from $houdini
			if (!source || !source.startsWith('$houdini')) {
				continue
			}

			for (const specifier of statement.specifiers ?? []) {
				// the name of the query the import points to (if applicable)
				let name = (specifier.local?.name as string) || ''
				let query = ''

				// if we are importing a store factory
				if (name.endsWith(store_suffix(config))) {
					query = name.substring(0, name.length - store_suffix(config).length)
				}

				// if we are import directly from a store path
				else if (
					source.startsWith('$houdini/' + stores_directory_name()) &&
					specifier.type === 'ImportDefaultSpecifier'
				) {
					// the local version points to the store
					query = source.substring(`$houdini/${stores_directory_name()}`.length - 1)
				}

				// look up the query content if we found a match
				if (query) {
					// compute the artifact path
					const artifact =
						mockArtifacts?.[query] ||
						(
							await import(
								path.importPath(path.join(config.artifactDirectory, query + '.js'))
							)
						).default

					// save the query
					globalImports[name] = artifact.raw
				}
			}
			continue
		}

		// process local exports
		else if (statement.type === 'ExportNamedDeclaration') {
			// add the export to the list
			if (
				statement.declaration?.type === 'VariableDeclaration' &&
				statement.declaration.declarations.length === 1 &&
				statement.declaration.declarations[0].type === 'VariableDeclarator' &&
				statement.declaration.declarations[0].id.type === 'Identifier'
			) {
				exports.push(statement.declaration.declarations[0].id.name)
				if (
					statement.declaration.declarations[0].id.name === houdini_load_fn &&
					statement.declaration.declarations[0].init
				) {
					houdiniLoad = statement.declaration.declarations[0].init
				}
			} else if (
				statement.declaration?.type === 'FunctionDeclaration' &&
				statement.declaration.id?.type === 'Identifier'
			) {
				exports.push(statement.declaration.id.name)
			}

			// if the exported value is a relevant statement
			if (statement.declaration?.type === 'VariableDeclaration') {
				const reference = identifyQueryReference(globalImports, statement.declaration)
				if (reference) {
					globalImports[reference.local] = reference.query
				}
			}

			continue
		}

		// local variables
		if (statement?.type === 'VariableDeclaration') {
			const reference = identifyQueryReference(globalImports, statement)

			if (reference) {
				globalImports[reference.local] = reference.query
			}
		}
	}

	// if we found a load function while we were processing things, we should have all the information
	// we need in order to recreate the final list
	const load: string[] = []
	if (houdiniLoad) {
		const elements =
			houdiniLoad.type === 'ArrayExpression' ? houdiniLoad.elements : [houdiniLoad]
		for (const element of elements) {
			if (!element) {
				continue
			}

			if (element.type === 'Identifier') {
				const result = globalImports[element.name]
				load.push(result)
				if (!result) {
					throw new Error(
						`Could not find ${logYellow(element.name)} ` +
							`for computing ${logYellow(houdini_load_fn)}. ` +
							`(if it was a global store, you need to instantiate the store manually.)` +
							`\nfilepath: ${filepath}`
					)
				}
			} else if (element.type === 'TaggedTemplateExpression') {
				if (element.tag.type !== 'Identifier' || element.tag.name !== 'graphql') {
					throw new Error(
						`only graphql template tags can be passed to ${houdini_load_fn}`
					)
				}
				load.push(element.quasi.quasis[0].value.raw)
			} else if (element.type === 'CallExpression') {
				// if the function is not called graphql, ignore it
				if (
					element.callee.type !== 'Identifier' ||
					element.callee.name !== 'graphql' ||
					element.arguments.length !== 1
				) {
					throw new Error(`only graphql function can be passed to ${houdini_load_fn}`)
				}
				let documentString: string
				const argument = element.arguments[0]

				// if we have a template or string literal, use its value
				if (argument.type === 'TemplateLiteral') {
					documentString = argument.quasis[0].value.raw
				} else if (argument.type === 'StringLiteral') {
					documentString = argument.value
				} else {
					throw new Error('only strings can be passed to the graphql function')
				}

				load.push(documentString)
			} else if (element.type === 'NewExpression') {
				const suffix = store_suffix(config)
				if (
					element &&
					element.callee.type === 'Identifier' &&
					element.callee.name.endsWith(suffix)
				) {
					// get the name of the query
					load.push(globalImports[element.callee.name])
				} else {
					throw new Error(`only query store classes can be passed to ${houdini_load_fn}`)
				}
			}
		}
	}

	return { load, exports }
}

// a statement is a query reference if its
// - an identifier that matches a global import
// - is a call expression of a global import (new store factory)
// - is a template expression with graphql
function identifyQueryReference(
	imports: Record<string, string>,
	statement: VariableDeclaration
): null | { local: string; query: string } {
	// only support standalone declarations
	if (statement.declarations.length !== 1) {
		return null
	}

	// we only care about local variables
	const declaration = statement.declarations[0]
	if (declaration.type !== 'VariableDeclarator' || declaration.id.type !== 'Identifier') {
		return null
	}

	const local = declaration.id.name
	if (local === houdini_load_fn) {
		return null
	}

	// pull out the value
	const value = declaration.init
	if (!value) {
		return null
	}
	// check the cases
	if (value.type === 'Identifier' && value.name in imports) {
		return { local, query: imports[value.name] }
	}
	if (
		value.type === 'CallExpression' &&
		value.callee.type === 'Identifier' &&
		value.callee.name in imports
	) {
		return { local, query: imports[value.callee.name] }
	}
	if (
		value.type === 'CallExpression' &&
		value.callee.type === 'Identifier' &&
		value.callee.name === 'graphql' &&
		value.arguments.length === 1
	) {
		if (value.arguments[0].type === 'StringLiteral') {
			return { local, query: value.arguments[0].value }
		} else if (value.arguments[0].type === 'TemplateLiteral') {
			return { local, query: value.arguments[0].quasis[0].value.raw }
		}
	}

	if (value.type === 'NewExpression' && value.callee.type == 'Identifier') {
		return { local, query: imports[value.callee.name] }
	}

	if (value.type === 'TaggedTemplateExpression') {
		if (value.tag.type !== 'Identifier' || value.tag.name !== 'graphql') {
			throw new Error(`only graphql template tags can be passed to ${houdini_load_fn}`)
		}
		return { local, query: value.quasi.quasis[0].value.raw }
	}

	// it wasn't valid
	return null
}
