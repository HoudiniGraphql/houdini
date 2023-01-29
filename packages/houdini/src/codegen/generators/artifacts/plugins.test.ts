import { test, expect, describe } from 'vitest'

import { runPipeline } from '../../../codegen'
import type { CollectedGraphQLDocument } from '../../../lib'
import { fs } from '../../../lib'
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
		    "hash": "93f2f73a7b5bc8ec643024414471b0b955d2916b1edd8f3d94109020078bf106",

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

		"HoudiniHash=2363a3a2201c6573e57a737a2ca4c003cba823c261353488819b6f93a90f3ff5";
	`)
})
