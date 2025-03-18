import type { Document, Config, ConfigFile, Script } from 'houdini'
import { fs, parseJS, path } from 'houdini'
import { runPipeline } from 'houdini/codegen'
import { mockCollectedDoc, testConfig } from 'houdini/test'

import { pluginHooks } from '../plugin'
import { plugin_config } from '../plugin/config'
import { parseSvelte } from '../plugin/extract'
import type { Framework } from '../plugin/kit'
import { layout_query_path, page_query_path, route_data_path } from '../plugin/kit'
import runTransforms from '../plugin/transforms'

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

export async function test_config(extraConfig: Partial<ConfigFile> = {}) {
	const config = testConfig(extraConfig)
	const svelte_plugin = await pluginHooks()
	config.plugins.push({
		...svelte_plugin,
		includeRuntime: './test',
		filepath: path.join(process.cwd(), 'index.js'),
		name: 'test',
	})
	return config
}

export async function pipeline_test(
	documents: string[],
	extra_config?: Partial<ConfigFile>
): Promise<{
	pluginRoot: string
	docs: Document[]
	config: Config
}> {
	const config = await test_config(extra_config)

	// the first thing to do is to create the list of collected documents
	const docs: Document[] = documents.map((doc) => mockCollectedDoc(doc))

	// apply the transforms
	await runPipeline(config, docs)

	return {
		pluginRoot: config.pluginDirectory('houdini-svelte'),
		docs,
		config,
	}
}

export async function route_test({
	component = '',
	script = '',
	page_query = '',
	layout_query = '',
	layout = '',
	layout_script = '',
	config: extra,
	framework = 'kit',
	route_path = '',
}: {
	component?: string
	script?: string
	page_query?: string
	layout_query?: string
	layout?: string
	layout_script?: string
	config?: Partial<ConfigFile>
	framework?: Framework
	route_path?: string
}): Promise<{
	component: Script | null
	script: Script | null
	layout: Script | null
	layout_script: Script | null
}> {
	// build up the document we'll pass to the processor
	const config = await test_config({ schema, ...extra })

	// scripts live in src/routes/+page.svelte
	const page_path = path.join(process.cwd(), 'src/routes', route_path, '+page.svelte')
	const layout_path = path.join(process.cwd(), 'src/routes', route_path, '+layout.svelte')
	const layout_script_path = route_data_path(config, layout_path)

	await fs.mkdirp(path.dirname(page_path))

	// write the content
	await Promise.all([
		fs.writeFile(page_path, component),
		fs.writeFile(route_data_path(config, page_path), script),
		fs.writeFile(page_query_path(config, page_path), page_query),
		fs.writeFile(layout_query_path(config, page_path), layout_query),
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
	const config = await test_config({ schema, ...extra })

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
	const config = await test_config({ schema })

	// write the content
	filepath = path.join(config.projectRoot, filepath)
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
	const config = await test_config({ schema })

	// write the content
	filepath = path.join(config.projectRoot, filepath)
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
	return (await parseJS(result.code)) ?? null
}
