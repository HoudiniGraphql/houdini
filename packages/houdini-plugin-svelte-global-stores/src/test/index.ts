import type { CollectedGraphQLDocument, Config, ConfigFile } from 'houdini'
import { runPipeline } from 'houdini/codegen'
import { mockCollectedDoc, testConfig } from 'houdini/test'

import _plugin_houdini_svelte from '../../../houdini-svelte/src/plugin'
import _plugin_houdini_svelte_global_store from '../plugin'

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
		plugin_root: config.pluginDirectory('houdini-plugin-svelte-global-stores'),
		docs,
		config,
	}
}
