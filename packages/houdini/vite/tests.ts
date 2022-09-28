import * as graphql from 'graphql'
import path from 'path'

import { ConfigFile } from '../../houdini-svelte/runtime'
import runTransforms from '../../houdini-svelte/vite/transforms'
import { mkdirp, parseJS, parseSvelte, Script, testConfig, writeFile } from '../common'

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
	layout = '',
	layout_script = '',
	config: extra,
}: {
	component?: string
	script?: string
	query?: string
	layout?: string
	layout_script?: string
	config?: Partial<ConfigFile>
}): Promise<{
	component: Script | null
	script: Script | null
	layout: Script | null
	layout_script: Script | null
}> {
	// build up the document we'll pass to the processor
	const config = testConfig({ schema, ...extra })

	// scripts live in src/routes/+page.svelte
	const filepath = path.join(process.cwd(), 'src/routes', '+page.svelte')
	const layout_path = path.join(process.cwd(), 'src/routes', '+layout.svelte')
	const layout_script_path = config.routeDataPath(layout_path)

	await mkdirp(path.dirname(filepath))

	// write the content
	await Promise.all([
		writeFile(filepath, component),
		writeFile(config.routeDataPath(filepath), script),
		writeFile(config.pageQueryPath(filepath), query),
		writeFile(layout_path, layout),
		writeFile(layout_script_path, layout_script),
	])

	// we want to run the transformer on both the component and script paths
	const [component_result, script_result, layout_result, layout_script_result] =
		await Promise.all([
			runTransforms(
				config,
				{
					config,
					filepath,
					watch_file: () => {},
				},
				component
			),
			runTransforms(
				config,
				{
					config,
					filepath: config.routeDataPath(filepath),
					watch_file: () => {},
				},
				script
			),
			runTransforms(
				config,
				{
					config,
					filepath: layout_path,
					watch_file: () => {},
				},
				layout
			),
			runTransforms(
				config,
				{
					config,
					filepath: layout_script_path,
					watch_file: () => {},
				},
				layout_script
			),
		])

	// return both
	return {
		component: (await parseSvelte(component_result.code))?.script ?? null,
		script: (await parseJS(script_result.code))?.script ?? null,
		layout: (await parseSvelte(layout_result.code))?.script ?? null,
		layout_script: (await parseJS(layout_script_result.code))?.script ?? null,
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

export async function test_transform_svelte(filepath: string, content: string) {
	// build up the document we'll pass to the processor
	const config = testConfig({ schema })

	// write the content
	filepath = path.join(config.projectRoot, filepath)
	await mkdirp(path.dirname(filepath))
	await writeFile(filepath, content)

	// we want to run the transformer on both the component and script paths
	const result = await runTransforms(
		config,
		{
			config,
			filepath,
			watch_file: () => {},
		},
		content
	)

	// return both
	return (await parseSvelte(result.code))?.script ?? null
}

export async function test_transform_js(filepath: string, content: string) {
	// build up the document we'll pass to the processor
	const config = testConfig({ schema })

	// write the content
	filepath = path.join(config.projectRoot, filepath)
	await mkdirp(path.dirname(filepath))
	await writeFile(filepath, content)

	// we want to run the transformer on both the component and script paths
	const result = await runTransforms(
		config,
		{
			config,
			filepath,
			watch_file: () => {},
		},
		content
	)

	// return both
	return (await parseJS(result.code))?.script ?? null
}
