import { ConfigFile, path } from 'houdini'
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
			    "hash": "32aa2f538b4b885a895cb9fd057e2de52359d2bbbbc32d949fd24b35bf34ea81",

			    "raw": \`query TestQuery {
			  version
			}
			\`,

			    "rootType": "Query",

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
			            "isManualLoad": true,
			            "set_blocking": true
			        }
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=32aa2f538b4b885a895cb9fd057e2de52359d2bbbbc32d949fd24b35bf34ea81";
		`)
	})

	test('no blocking directive', async function () {
		const docs = [`query TestQuery @no_blocking { version }`]

		// execute the generator
		const { docs: results } = await pipeline_test(docs)

		// load the contents of the file
		expect(results[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "TestQuery",
			    "kind": "HoudiniQuery",
			    "hash": "083440a97adcc555fdd09e027c641c50c4835fef7edee6cf3c00afa326dd4a1b",

			    "raw": \`query TestQuery {
			  version
			}
			\`,

			    "rootType": "Query",

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
			            "isManualLoad": true,
			            "set_no_blocking": true
			        }
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=083440a97adcc555fdd09e027c641c50c4835fef7edee6cf3c00afa326dd4a1b";
		`)
	})
})
