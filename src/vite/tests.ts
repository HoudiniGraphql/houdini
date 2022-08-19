import * as graphql from 'graphql'
import path from 'path'

import {
	HoudiniRouteScript,
	mkdirp,
	ParsedFile,
	parseJS,
	parseSvelte,
	Script,
	testConfig,
	writeFile,
} from '../common'
import { ConfigFile } from '../runtime'
import runTransforms from './transforms'

const schema = `
	type User {
		id: ID!
	}

	type Query {
		viewer: User
	}

	type Mutation {
		addUser: User
	}
`

export async function route_test({
	component = '',
	script = '',
	query = '',
	config: extra,
	script_info,
}: {
	component?: string
	script?: string
	query?: string
	config?: Partial<ConfigFile>
	script_info?: { houdini_load?: string[]; exports: string[] }
}): Promise<{ component: Script | null; script: Script | null }> {
	// build up the document we'll pass to the processor
	const config = testConfig({ schema, ...extra })

	// scripts live in src/routes/+page.svelte
	const filepath = path.join(process.cwd(), 'src/routes', '+page.svelte')

	await mkdirp(path.dirname(filepath))

	// write the content
	await Promise.all([
		writeFile(filepath, component),
		writeFile(config.routeDataPath(filepath), script),
		writeFile(config.pageQueryPath(filepath), query),
	])

	const mock_page_info = !script_info
		? {
				exports: [],
		  }
		: {
				...script_info,
				houdini_load: !script_info.houdini_load
					? undefined
					: script_info.houdini_load.map(
							(query) =>
								graphql.parse(query)
									.definitions[0] as graphql.OperationDefinitionNode
					  ),
		  }

	// we want to run the transformer on both the component and script paths
	const [componentResult, scriptResult] = await Promise.all([
		runTransforms(
			config,
			{
				config,
				filepath,
				watch_file: () => {},
				mock_page_info,
			},
			component
		),
		runTransforms(
			config,
			{
				config,
				filepath: config.routeDataPath(filepath),
				watch_file: () => {},
				mock_page_info,
			},
			script
		),
	])

	// return both
	return {
		component: (await parseSvelte(componentResult.code))?.script ?? null,
		script: (await parseJS(scriptResult.code))?.script ?? null,
	}
}

export async function component_test(
	content: string,
	extra?: Partial<ConfigFile>
): Promise<Script | null> {
	// build up the document we'll pass to the processor
	const config = testConfig({ schema, ...extra })

	// routes live in src/routes/+page.svelte
	const filepath = path.join(process.cwd(), 'src/lib', 'component.svelte')

	// write the content
	await mkdirp(path.dirname(filepath))
	await writeFile(filepath, `<script>${content}</script>`)

	// we want to run the transformer on both the component and script paths
	const result = await runTransforms(
		config,
		{
			config,
			filepath,
			watch_file: () => {},
		},
		`<script>${content}</script>`
	)

	// return both
	return (await parseSvelte(result.code))?.script ?? null
}
