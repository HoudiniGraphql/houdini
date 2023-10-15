import * as t from '@babel/types'
import * as graphql from 'graphql'

import { path, fs, parseJS, type Config } from '..'
import type { ProjectManifest, PageManifest, QueryManifest } from '../../runtime/lib/types'
import {
	read_layoutQuery,
	read_layoutView,
	read_pageView,
	read_pageQuery,
	page_id,
} from './conventions'

export type { ProjectManifest, PageManifest, QueryManifest }

/**
 * Walk down the routes directory and build a normalized description of the project's
 * filesystem.
 */
export async function load_manifest(args: {
	config: Config
	includeArtifacts?: boolean
}): Promise<ProjectManifest> {
	// we'll start at the route directory and start building it up
	const manifest = await walk_routes({
		config: args.config,
		url: '/',
		filepath: args.config.routesDir,
		project: {
			component_fields: {},
			pages: {},
			layouts: {},
			page_queries: {},
			layout_queries: {},
			artifacts: [],
			local_schema: false,
			local_yoga: false,
		},
		queries: [],
		layouts: [],
	})

	// we might need to include the list of aritfacts in the project
	if (args.includeArtifacts) {
		try {
			// look at the artifact directory for every artifact
			for (const artifactPath of await fs.readdir(args.config.artifactDirectory)) {
				// only consider the js files
				if (!artifactPath.endsWith('.js') || artifactPath === 'index.js') {
					continue
				}

				// push the artifact path without the extension
				manifest.artifacts.push(artifactPath.substring(0, artifactPath.length - 3))
			}
		} catch {}
	}

	// the schema could be any number of things:
	// a directory (+schema/index.js)
	// a javascript file
	// a file that transpiles into javascript
	// in order to address this, we're going to just look inside of the api directory for
	// something named schema (regardless of directory or file)
	try {
		await fs.stat(args.config.localApiDir)
		// look at the contents of the directory
		for (const child of await fs.readdir(args.config.localApiDir, { withFileTypes: true })) {
			const name = child.isDirectory() ? child.name : path.parse(child.name).name

			if (name === '+schema') {
				manifest.local_schema = true
			} else if (name === '+yoga') {
				manifest.local_yoga = true
			}
		}
	} catch {
		// the so move on
	}

	return manifest
}

async function walk_routes(args: {
	filepath: string
	config: Config
	url: string
	project: ProjectManifest
	queries: string[]
	layouts: string[]
}): Promise<ProjectManifest> {
	const directory_contents = await fs.readdir(args.filepath, {
		withFileTypes: true,
	})

	// before we can go down, we need to look at the files in the directory
	// to see what queries were added to the context. this means we have to
	// first collect the layout query and view, and then check for a page query
	// to validate the page view
	let newLayouts = args.layouts
	let newLayoutQueries = args.queries

	// track the manifests we create along the way
	let layout: PageManifest | null = null
	let layoutQuery: QueryManifest | null = null
	let pageQuery: QueryManifest | null = null

	// read file contents
	const [
		[layoutQueryPath, layoutQueryContents],
		[layoutViewPath, layoutViewContents],
		[pageQueryPath, pageQueryContents],
		[pageViewPath, pageViewContents],
	] = await Promise.all([
		read_layoutQuery(args.filepath),
		read_layoutView(args.filepath),
		read_pageQuery(args.filepath),
		read_pageView(args.filepath),
	])

	// TODO: allow plugins to transform this content before we analyze it for information

	// we have a layout query, so we need to add it to the context
	if (layoutQueryContents) {
		layoutQuery = await add_query({
			path: layoutQueryPath!,
			config: args.config,
			url: args.url,
			project: args.project,
			type: 'layout',
			contents: layoutQueryContents,
		})
		newLayoutQueries = [...args.queries, layoutQuery.name]
	}

	// we have a layout query, so we need to add it to the context
	if (layoutViewContents) {
		layout = await add_view({
			url: args.url,
			path: layoutViewPath!,
			project: args.project,
			type: 'layout',
			contents: layoutViewContents,
			layouts: args.layouts,
			queries: newLayoutQueries,
			config: args.config,
		})
		newLayouts = [...args.layouts, page_id(layout.url)]
	}

	// if we have a page query, add it
	if (pageQueryContents) {
		pageQuery = await add_query({
			path: pageQueryPath!,
			config: args.config,
			url: args.url,
			project: args.project,
			type: 'page',
			contents: pageQueryContents,
		})
	}

	// if we have a page query, add it
	if (pageViewContents) {
		await add_view({
			path: pageViewPath!,
			url: args.url.substring(0, args.url.length - 1) || '/',
			project: args.project,
			type: 'page',
			contents: pageViewContents,
			layouts: newLayouts,
			queries: pageQuery ? [...newLayoutQueries, pageQuery.name] : newLayoutQueries,
			config: args.config,
		})
	}

	// now we can walk down the directories
	await Promise.all(
		directory_contents.map((dir) => {
			if (!dir.isDirectory()) {
				return
			}

			return walk_routes({
				...args,
				filepath: path.join(args.filepath, dir.name),
				url: `${args.url}${dir.name}/`,
				queries: newLayoutQueries,
				layouts: newLayouts,
			})
		})
	)

	return args.project
}

async function add_view(args: {
	path: string
	url: string
	project: ProjectManifest
	type: 'page' | 'layout'
	contents: string
	layouts: string[]
	queries: string[]
	config: Config
}) {
	const target = args.type === 'page' ? args.project.pages : args.project.layouts
	const queries = await extractQueries(args.contents)
	// look for any queries that we are asking for that aren't available
	const missing_queries = queries.filter((query) => !args.queries.includes(query))
	if (missing_queries.length > 0) {
		throw {
			message: 'Missing Queries',
			description: JSON.stringify(missing_queries),
		}
	}

	const id = page_id(args.url)

	target[id] = {
		id,
		queries,
		url: args.url,
		layouts: args.layouts,
		path: path.relative(args.config.projectRoot, args.path),
		query_options: args.queries,
	}

	return target[id]
}

async function add_query(args: {
	path: string
	config: Config
	url: string
	project: ProjectManifest
	type: 'page' | 'layout'
	contents: string
}) {
	// we need to parse the query to get the name
	const parsed = graphql.parse(args.contents)
	// look for the query definition
	const query = parsed.definitions.find(
		(def): def is graphql.OperationDefinitionNode =>
			def.kind === 'OperationDefinition' && def.operation === 'query'
	)
	if (!query?.name) {
		throw new Error('No query found')
	}

	let loading = false
	await graphql.visit(parsed, {
		Directive(node) {
			if (node.name.value === args.config.loadingDirective) {
				loading = true
			}
		},
	})

	const target = args.type === 'page' ? args.project.page_queries : args.project.layout_queries
	target[page_id(args.url)] = {
		path: path.relative(args.config.routesDir, args.path),
		name: query.name.value,
		url: args.url,
		loading,
	}

	return target[page_id(args.url)]
}

export async function extractQueries(source: string): Promise<string[]> {
	const ast = parseJS(source, { plugins: ['jsx'] })

	let defaultExportNode: t.Node | null = null
	let defaultExportIdentifier: string | null = null

	// walk through the function body and find the default export
	for (const node of ast.body) {
		if (t.isExportDefaultDeclaration(node)) {
			if (
				t.isFunctionDeclaration(node.declaration) ||
				t.isArrowFunctionExpression(node.declaration) ||
				t.isFunctionExpression(node.declaration)
			) {
				defaultExportNode = node.declaration
				break

				// if the export is an identifier we'll have to go back through
				// and find the declaration
			} else if (t.isIdentifier(node.declaration)) {
				defaultExportIdentifier = node.declaration.name
			}
		}
	}

	// if the default export was an identifier then go back through and find the correct  one
	if (defaultExportIdentifier) {
		for (const node of ast.body) {
			if (t.isVariableDeclaration(node)) {
				for (const declaration of node.declarations) {
					if (
						t.isVariableDeclarator(declaration) &&
						t.isIdentifier(declaration.id) &&
						declaration.id.name === defaultExportIdentifier
					) {
						if (
							t.isArrowFunctionExpression(declaration.init) ||
							t.isFunctionExpression(declaration.init)
						) {
							defaultExportNode = declaration.init
							break
						} else if (
							t.isTSAsExpression(declaration.init) &&
							(t.isArrowFunctionExpression(declaration.init.expression) ||
								t.isFunctionExpression(declaration.init.expression))
						) {
							defaultExportNode = declaration.init.expression
							break
						}
					}
				}
			}
		}
	}
	if (!defaultExportNode) {
		return []
	}

	let props: string[] = []
	const componentFunction = defaultExportNode as
		| t.FunctionDeclaration
		| t.ArrowFunctionExpression
		| t.FunctionExpression
		| undefined

	if (componentFunction && componentFunction.params.length > 0) {
		const firstParam = componentFunction.params[0]

		if (t.isObjectPattern(firstParam)) {
			for (const property of firstParam.properties) {
				if (t.isObjectProperty(property) && t.isIdentifier(property.key)) {
					props.push(property.key.name)
				}
			}
		} else {
			throw new Error('Props should be specified as an object pattern.')
		}
	} else {
		return []
	}

	return props.filter((p) => p !== 'children')
}
