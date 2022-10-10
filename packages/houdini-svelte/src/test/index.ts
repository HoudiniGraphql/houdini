import { CollectedGraphQLDocument, Config, ConfigFile, fs, parseJS, Script } from 'houdini'
import { runPipeline } from 'houdini/codegen'
import { mockCollectedDoc, testConfig } from 'houdini/test'
import path from 'path'

import plugin from '../plugin'
import { parseSvelte } from '../plugin/extract'
import { page_query_path, route_data_path } from '../plugin/kit'
import runTransforms from '../plugin/transforms'

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

export async function test_config(extraConfig: Partial<ConfigFile> = {}) {
	const config = testConfig(extraConfig)
	const svelte_plugin = await plugin()
	config.plugins.push({
		...svelte_plugin,
		include_runtime: true,
		name: 'houdini-svelte',
	})
	return config
}

export async function pipeline_test(
	documents: string[],
	extra_config?: Partial<ConfigFile>
): Promise<{
	plugin_root: string
	docs: CollectedGraphQLDocument[]
	config: Config
}> {
	const config = await test_config(extra_config)

	// the first thing to do is to create the list of collected documents
	const docs: CollectedGraphQLDocument[] = documents.map(mockCollectedDoc)

	// apply the transforms
	await runPipeline(config, docs)

	return {
		plugin_root: config.pluginDirectory('houdini-svelte'),
		docs,
		config,
	}
}

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
	const config = await test_config({ schema, ...extra })

	// scripts live in src/routes/+page.svelte
	const filepath = path.join(process.cwd(), 'src/routes', '+page.svelte')
	const layout_path = path.join(process.cwd(), 'src/routes', '+layout.svelte')
	const layout_script_path = route_data_path(config, layout_path)

	await fs.mkdirp(path.dirname(filepath))

	// write the content
	await Promise.all([
		fs.writeFile(filepath, component),
		fs.writeFile(route_data_path(config, filepath), script),
		fs.writeFile(page_query_path(config, filepath), query),
		fs.writeFile(layout_path, layout),
		fs.writeFile(layout_script_path, layout_script),
	])

	// we want to run the transformer on both the component and script paths
	const [component_result, script_result, layout_result, layout_script_result] =
		await Promise.all([
			runTransforms('kit', {
				content: component,
				config,
				filepath,
				watch_file: () => {},
			}),
			runTransforms('kit', {
				config,
				filepath: route_data_path(config, filepath),
				watch_file: () => {},
				content: script,
			}),
			runTransforms('kit', {
				config,
				filepath: layout_path,
				watch_file: () => {},
				content: layout,
			}),
			runTransforms('kit', {
				config,
				filepath: layout_script_path,
				watch_file: () => {},
				content: layout_script,
			}),
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
	return (await parseSvelte(result.code))?.script ?? null
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
	return (await parseSvelte(result.code))?.script ?? null
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
	return (await parseJS(result.code))?.script ?? null
}
