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
			    "hash": "bf9b4819b5a3f31b73640acb3da7f0b5abc29e07a1292a2fe307415b619716e3",

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

			"HoudiniHash=bf9b4819b5a3f31b73640acb3da7f0b5abc29e07a1292a2fe307415b619716e3";
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
			    "hash": "8e483259f3d69f416c01b6106c0440fa0f916abb4cadb75273f8226a1ff0a5e2",

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
			            "set_blocking": true
			        }
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=8e483259f3d69f416c01b6106c0440fa0f916abb4cadb75273f8226a1ff0a5e2";
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
			    "hash": "8e483259f3d69f416c01b6106c0440fa0f916abb4cadb75273f8226a1ff0a5e2",

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
			            "set_blocking": false
			        }
			    },

			    "policy": "CacheOrNetwork",
			    "partial": false
			};

			"HoudiniHash=8e483259f3d69f416c01b6106c0440fa0f916abb4cadb75273f8226a1ff0a5e2";
		`)
	})
})
