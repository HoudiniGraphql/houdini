import type { ConfigFile, Script } from 'houdini'
import { fs, parseJS, path } from 'houdini'
import { testConfig } from 'houdini/test'

import { plugin_config } from '../config.js'
import { parseSvelte } from '../parse.js'
import type { Framework } from '../types.js'
import runTransforms from './index.js'
import { route_data_path } from './paths.js'

const schema = `
	type User {
		id: ID!
	}

	type Query {
		viewer: User
		field(input: Int!): Int
	}

	type Mutation {
		addUser: User
	}
`

export async function route_test({
	component = '',
	script = '',
	layout = '',
	layout_script = '',
	framework = 'kit',
	route_path = '',
}: {
	component?: string
	script?: string
	page_query?: string
	layout_query?: string
	layout?: string
	layout_script?: string
	framework?: Framework
	route_path?: string
}): Promise<{
	component: Script | null
	script: Script | null
	layout: Script | null
	layout_script: Script | null
}> {
	// build up the document we'll pass to the processor
	const config = testConfig({ schema })

	// scripts live in src/routes/+page.svelte
	const page_path = path.join(process.cwd(), 'src/routes', route_path, '+page.svelte')
	const layout_path = path.join(process.cwd(), 'src/routes', route_path, '+layout.svelte')
	const layout_script_path = route_data_path(config, layout_path)

	await fs.mkdirp(path.dirname(page_path))

	// write the content
	await Promise.all([
		fs.writeFile(page_path, component),
		fs.writeFile(route_data_path(config, page_path), script),
		fs.writeFile(layout_path, layout),
		fs.writeFile(layout_script_path, layout_script),
	])

	// we want to run the transformer on both the component and script paths
	const [component_result, script_result, layout_result, layout_script_result] =
		await Promise.all([
			runTransforms(framework, {
				content: component,
				config,
				filepath: page_path,
				watch_file: () => {},
			}),
			runTransforms(framework, {
				config,
				filepath: route_data_path(config, page_path),
				watch_file: () => {},
				content: script,
			}),
			runTransforms(framework, {
				config,
				filepath: layout_path,
				watch_file: () => {},
				content: layout,
			}),
			runTransforms(framework, {
				config,
				filepath: layout_script_path,
				watch_file: () => {},
				content: layout_script,
			}),
		])

	// return both
	return {
		component:
			(await parseSvelte(component_result.code, plugin_config(config).forceRunesMode))
				?.script ?? null,
		script: await parseJS(script_result.code),
		layout:
			(await parseSvelte(layout_result.code, plugin_config(config).forceRunesMode))?.script ??
			null,
		layout_script: await parseJS(layout_script_result.code),
	}
}

export async function component_test(
	content: string,
	extra?: Partial<ConfigFile>
): Promise<Script | null> {
	// build up the document we'll pass to the processor
	const config = await testConfig({ schema, ...extra })

	// routes live in src/routes/+page.svelte
	const filepath = path.join(process.cwd(), 'src/lib', 'component.svelte')

	// write the content
	await fs.mkdirp(path.dirname(filepath))
	await fs.writeFile(filepath, `<script>${content}</script>`)

	// we want to run the transformer on both the component and script paths
	const result = await runTransforms('kit', {
		config,
		filepath,
		watch_file: () => {},
		content: `<script>${content}</script>`,
	})

	// return both
	return (await parseSvelte(result.code, plugin_config(config).forceRunesMode))?.script ?? null
}

export async function test_transform_svelte(filepath: string, content: string) {
	// build up the document we'll pass to the processor
	const config = testConfig({ schema })

	// write the content
	filepath = path.join(config.root_dir, filepath)
	await fs.mkdirp(path.dirname(filepath))
	await fs.writeFile(filepath, content)

	// we want to run the transformer on both the component and script paths
	const result = await runTransforms('kit', {
		config,
		filepath,
		watch_file: () => {},
		content,
	})

	// return both
	return (await parseSvelte(result.code, plugin_config(config).forceRunesMode))?.script ?? null
}

export async function test_transform_js(filepath: string, content: string) {
	// build up the document we'll pass to the processor
	const config = testConfig({ schema })

	// write the content
	filepath = path.join(config.root_dir, filepath)
	await fs.mkdirp(path.dirname(filepath))
	await fs.writeFile(filepath, content)

	// we want to run the transformer on both the component and script paths
	const result = await runTransforms('kit', {
		config,
		filepath,
		watch_file: () => {},
		content,
	})

	// return both
	return parseJS(result.code) ?? null
}
