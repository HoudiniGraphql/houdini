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

describe('load', () => {
	test('fragment references in inline fragment', async function () {
		// the documents to test
		const docs = [
			`query FragmentUpdateTestQuery($id: ID!) @load {
				node(id: $id) {
					... on User {
						...UserFragmentTestFragment
					}
				}
			}`,
			`fragment UserFragmentTestFragment on User {
				name
			}`,
		]

		// execute the generator
		const results = await pipeline_test(docs)
		expect(results.docs[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "FragmentUpdateTestQuery",
			    "kind": "HoudiniQuery",
			    "hash": "57e4f75a0ab4e90b69c877a6b842f213362dc5c050227faf7635d8641b4da434",

			    "raw": \`query FragmentUpdateTestQuery($id: ID!) {
			  node(id: $id) {
			    ... on User {
			      ...UserFragmentTestFragment
			      id
			    }
			    id
			    __typename
			  }
			}

			fragment UserFragmentTestFragment on User {
			  name
			  id
			  __typename
			}
			\`,

			    "rootType": "Query",

			    "selection": {
			        "fields": {
			            "node": {
			                "type": "Node",
			                "keyRaw": "node(id: $id)",
			                "nullable": true,

			                "selection": {
			                    "abstractFields": {
			                        "fields": {
			                            "User": {
			                                "name": {
			                                    "type": "String",
			                                    "keyRaw": "name"
			                                },

			                                "id": {
			                                    "type": "ID",
			                                    "keyRaw": "id",
			                                    "visible": true
			                                },

			                                "__typename": {
			                                    "type": "String",
			                                    "keyRaw": "__typename",
			                                    "visible": true
			                                }
			                            }
			                        },

			                        "typeMap": {}
			                    },

			                    "fields": {
			                        "id": {
			                            "type": "ID",
			                            "keyRaw": "id",
			                            "visible": true
			                        },

			                        "__typename": {
			                            "type": "String",
			                            "keyRaw": "__typename",
			                            "visible": true
			                        }
			                    },

			                    "fragments": {
			                        "UserFragmentTestFragment": {
			                            "arguments": {}
			                        }
			                    }
			                },

			                "abstract": true,
			                "visible": true
			            }
			        }
			    },

			    "pluginData": {
			        "test": {}
			    },

			    "input": {
			        "fields": {
			            "id": "ID"
			        },

			        "types": {}
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=57e4f75a0ab4e90b69c877a6b842f213362dc5c050227faf7635d8641b4da434";
		`)
	})
})

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

	test('blocking_disable directive', async function () {
		const docs = [`query TestQuery @blocking_disable { version }`]

		// execute the generator
		const { docs: results } = await pipeline_test(docs)

		// load the contents of the file
		expect(results[0]).toMatchInlineSnapshot(`
			export default {
			    "name": "TestQuery",
			    "kind": "HoudiniQuery",
			    "hash": "f43358172e30b6289cdf3fdfaaa1b20932ad7905f472fd6f6cb5337991ccf6df",

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
