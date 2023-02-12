import type { Document, Config, ConfigFile } from 'houdini'
import { runPipeline } from 'houdini/codegen'
import { mockCollectedDoc, testConfig } from 'houdini/test'

import { pluginHooks as _plugin_houdini_svelte } from '../../../houdini-svelte/src/plugin'
import { pluginHooks as _plugin_houdini_svelte_global_store } from '../plugin'

export async function test_config(extraConfig: Partial<ConfigFile> = {}) {
	const config = testConfig(extraConfig)

	const plugin_houdini_svelte = await _plugin_houdini_svelte()
	const plugin_houdini_svelte_global_store = await _plugin_houdini_svelte_global_store()
	config.plugins.push(
		{
			...plugin_houdini_svelte,
			filepath: '',
			name: 'houdini-svelte',
		},
		{
			...plugin_houdini_svelte_global_store,
			name: 'houdini-plugin-svelte-global-stores',
			filepath: '',
		}
	)
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
		pluginRoot: config.pluginDirectory('houdini-plugin-svelte-global-stores'),
		docs,
		config,
	}
}
