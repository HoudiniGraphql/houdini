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
		    "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",

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

		"HoudiniHash=93f2f73a7b5bc8ec643024414471b0b955d2916b1edd8f3d94109020078bf106";
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
