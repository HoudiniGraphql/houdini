import type { ConfigFile } from 'houdini'
import { path } from 'houdini'
import { testConfig } from 'houdini/test'
import { describe, expect, test } from 'vitest'

import { pluginHooks } from '../plugin'
import { pipeline_test } from '../test'

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

describe('blocking', () => {
	test('blocking directive', async function () {
		const docs = [`query TestQuery @blocking { version }`]

		// execute the generator
		const { docs: results } = await pipeline_test(docs)

		// load the contents of the file
		expect(results[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "TestQuery",
			    "kind": "HoudiniQuery",
			    "hash": "24015ccbaa62e80c1a1364e01cf181591c9fbb03da6a9b32da97fb23f820ff78",

			    "raw": \`query TestQuery {
			  version
			}\`,

			    "rootType": "Query",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "version": {
			                "type": "Int",
			                "keyRaw": "version",
			                "visible": true
			            }
			        }
			    },

			    "pluginData": {
			        "test": {
			            "set_blocking": true
			        }
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=32aa2f538b4b885a895cb9fd057e2de52359d2bbbbc32d949fd24b35bf34ea81";
		`)
	})

	test('blocking_disable directive', async function () {
		const docs = [`query TestQuery @blocking_disable { version }`]

		// execute the generator
		const { docs: results } = await pipeline_test(docs)

		// load the contents of the file
		expect(results[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "TestQuery",
			    "kind": "HoudiniQuery",
			    "hash": "24015ccbaa62e80c1a1364e01cf181591c9fbb03da6a9b32da97fb23f820ff78",

			    "raw": \`query TestQuery {
			  version
			}\`,

			    "rootType": "Query",
			    "stripVariables": [],

			    "selection": {
			        "fields": {
			            "version": {
			                "type": "Int",
			                "keyRaw": "version",
			                "visible": true
			            }
			        }
			    },

			    "pluginData": {
			        "test": {
			            "set_blocking": false
			        }
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=f43358172e30b6289cdf3fdfaaa1b20932ad7905f472fd6f6cb5337991ccf6df";
		`)
	})
})
