import { test, expect } from 'vitest'

import { mockCollectedDoc, testConfig } from '../../../../test'
import { runPipeline } from '../../../codegen'

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
		    "hash": "93f2f73a7b5bc8ec643024414471b0b955d2916b1edd8f3d94109020078bf106",

		    "raw": \`query MyQuery {
		  users(stringValue: "asdf") {
		    id
		  }
		}
		\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User",
		                "keyRaw": "users(stringValue: \\"asdf\\")",

		                "selection": {
		                    "fields": {
		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id",
		                            "visible": true
		                        }
		                    }
		                },

		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=2363a3a2201c6573e57a737a2ca4c003cba823c261353488819b6f93a90f3ff5";
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
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User",
		                "keyRaw": "users(stringValue: \\"asdf\\")",

		                "selection": {
		                    "fields": {
		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id",
		                            "visible": true
		                        }
		                    }
		                },

		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=74c2764f8344bf9ffafb5b0b5b13788fc5aa32b076a4fd6f895279de9efbca6e";
	`)
})
