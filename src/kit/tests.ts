import path from 'path'
import * as recast from 'recast'

import { ParsedFile, parseJS, parseSvelte, Script, testConfig, writeFile } from '../common'
import { ConfigFile } from '../runtime'
import runTransforms from './transforms'
import { PageScriptInfo } from './transforms/kit'

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
	script_info?: PageScriptInfo
}): Promise<{ component: Script | null; script: Script | null }> {
	// build up the document we'll pass to the processor
	const config = testConfig({ schema, ...extra })

	// scripts live in src/routes/+page.svelte
	const filepath = path.join(process.cwd(), 'src/routes', '+page.svelte')

	// write the content
	await Promise.all([
		writeFile(filepath, component),
		writeFile(config.routeDataPath(filepath), script),
		writeFile(config.pageQueryPath(filepath), query),
	])

	// we want to run the transformer on both the component and script paths
	const [componentResult, scriptResult] = await Promise.all([
		runTransforms(
			config,
			{
				config,
				filepath,
				addWatchFile: () => {},
				mock_page_info: script_info,
				load: async () => null,
			},
			component
		),
		runTransforms(
			config,
			{
				config,
				filepath: config.routeDataPath(filepath),
				addWatchFile: () => {},
				mock_page_info: script_info,
				load: async () => null,
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
	await writeFile(filepath, `<script>${content}</script>`)

	// we want to run the transformer on both the component and script paths
	const result = await runTransforms(
		config,
		{
			config,
			filepath,
			addWatchFile: () => {},
			load: async () => null,
		},
		`<script>${content}</script>`
	)

	// return both
	return (await parseSvelte(result.code))?.script ?? null
}
