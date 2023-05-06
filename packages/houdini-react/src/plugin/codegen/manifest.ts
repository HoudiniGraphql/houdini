import * as t from '@babel/types'
import * as graphql from 'graphql'
import { path, fs, parseJS } from 'houdini'
import type { Config } from 'houdini'

import {
	read_layoutQuery,
	read_layoutView,
	read_pageView,
	read_pageQuery,
	normalize_path,
} from '../conventions'

/**
 * Walk down the routes directory and build a normalized description of the project's
 * filesystem.
 */
export async function load_manifest(args: { config: Config }) {
	// we'll start at the route directory and start building it up
	return await walk_routes({
		config: args.config,
		url: '/',
		filepath: args.config.routesDir,
		project: {
			pages: {},
			layouts: {},
			page_queries: {},
			layout_queries: {},
		},
		queries: [],
		layouts: [],
	})
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
		newLayouts = [...args.layouts, normalize_path(layout.url)]
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

	const id = normalize_path(args.url)

	target[id] = {
		id,
		queries,
		url: args.url,
		layouts: args.layouts,
		path: path.relative(args.config.routesDir, args.path),
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
	target[normalize_path(args.url)] = {
		path: path.relative(args.config.routesDir, args.path),
		name: query.name.value,
		url: args.url,
		loading,
	}

	return target[normalize_path(args.url)]
}

export async function extractQueries(source: string): Promise<string[]> {
	const ast = await parseJS(source, { plugins: ['jsx'] })

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
		throw new Error('No default export found.')
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

// The manifest is a tree of routes that the router will use to render
// the correct component tree for a given url
export type ProjectManifest = {
	/** All of the pages in the project */
	pages: Record<string, PageManifest>
	/** All of the layouts in the project */
	layouts: Record<string, PageManifest>
	/** All of the page queries in the project */
	page_queries: Record<string, QueryManifest>
	/** All of the layout queries in the project */
	layout_queries: Record<string, QueryManifest>
}

export type PageManifest = {
	id: string
	/** the name of every query that the page depends on */
	queries: string[]
	/** the full url pattern of the page */
	url: string
	/** the ids of layouts that wrap this page */
	layouts: string[]
	/** The filepath of the unit */
	path: string
}

export type QueryManifest = {
	/** the name of the query */
	name: string
	/** the url tied with the query */
	url: string
	/** wether the query uses the loading directive (ie, wants a fallback) */
	loading: boolean
	/** The filepath of the unit */
	path: string
}
