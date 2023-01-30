import { test, expect } from 'vitest'

import { runPipeline } from '../../../codegen'
import { mockCollectedDoc, testConfig } from '../../../test'

test("doesn't include directives defined in plugins", async function () {
	const config = testConfig()

	config.plugins = [
		{
			name: 'pluginWithClientPlugin',
			filepath: '',
			schema: (config) => `
                directive @Foo on QUERY
            `,
		},
	]

	// generate a document with the custom directive
	const doc = mockCollectedDoc(`
        query MyQuery @Foo {
            users(stringValue: "asdf") {
                id
            }
        }
    `)

	await runPipeline(config, [doc])

	// look at the artifact for the generated pagination query
	await expect(doc).toMatchInlineSnapshot(`
		export default {
		    "name": "MyQuery",
		    "kind": "HoudiniQuery",
		    "hash": "3697047838d5c7ac301e11a8ea95a3d85897dd2c7d8d5f3c0a28799780094c0f",

		    "raw": \`query MyQuery {
		  users(stringValue: "asdf") {
		    id
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User",
		                "keyRaw": "users(stringValue: \\"asdf\\")",

		                "selection": {
		                    "fields": {
		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id"
		                        }
		                    }
		                }
		            }
		        }
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=3697047838d5c7ac301e11a8ea95a3d85897dd2c7d8d5f3c0a28799780094c0f";
	`)
})

test('plugins can customize the hash', async function () {
	const config = testConfig()

	config.plugins = [
		{
			name: 'pluginWithClientPlugin',
			filepath: '',
			hash: ({ document: { name } }) => name,
		},
	]

	// generate a document with the custom directive
	const doc = mockCollectedDoc(`
        query MyQuery {
            users(stringValue: "asdf") {
                id
            }
        }
    `)

	await runPipeline(config, [doc])

	await expect(doc).toMatchInlineSnapshot(`
		export default {
		    "name": "MyQuery",
		    "kind": "HoudiniQuery",
		    "hash": "MyQuery",

		    "raw": \`query MyQuery {
		  users(stringValue: "asdf") {
		    id
		  }
		}
		\`,

		    "rootType": "Query",

		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User",
		                "keyRaw": "users(stringValue: \\"asdf\\")",

		                "selection": {
		                    "fields": {
		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id"
		                        }
		                    }
		                }
		            }
		        }
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=MyQuery";
	`)
})
