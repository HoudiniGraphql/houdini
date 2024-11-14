import type { ProgramKind } from 'ast-types/lib/gen/kinds'
import type * as graphql from 'graphql'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
import { test, expect, describe } from 'vitest'

import { runPipeline } from '../../codegen'
import { fs, path } from '../../lib'
import { testConfig, mockCollectedDoc } from '../../test'
import { parseArgumentTypeString } from './fragmentVariables'

test('pass argument values to generated fragments', async function () {
	const docs = [
		mockCollectedDoc(
			`
				query AllUsers {
                    ...QueryFragment @with(name: "Hello")
				}
			`
		),
		mockCollectedDoc(
			`
				fragment QueryFragment on Query
                @arguments(name: {type: "String!"} ) {
                    users(stringValue: $name) {
                        id
                    }
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	const queryContents = await fs.readFile(path.join(config.artifactPath(docs[0].document)))
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		export default {
		    "name": "AllUsers",
		    "kind": "HoudiniQuery",
		    "hash": "7cf541eeda9db6b5320d94607fab8f61795b66bfb075d9fbbf8c4fa05a5ef93e",

		    "raw": \`query AllUsers {
		  ...QueryFragment_10b3uv
		}

		fragment QueryFragment_10b3uv on Query {
		  users(stringValue: "Hello") {
		    id
		  }
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User",
		                "keyRaw": "users(stringValue: \\"Hello\\")",

		                "selection": {
		                    "fields": {
		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id",
		                            "visible": true
		                        }
		                    }
		                }
		            },

		            "__typename": {
		                "type": "String",
		                "keyRaw": "__typename"
		            }
		        },

		        "fragments": {
		            "QueryFragment": {
		                "arguments": {
		                    "name": {
		                        "kind": "StringValue",
		                        "value": "Hello"
		                    }
		                }
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=fb97ee7e3f483801de403f425fcd2b4ed5c1357ffc3d73394e34c23b278552b1";
	`)
})

test('pass structured values as argument values to generated fragments', async function () {
	const docs = [
		mockCollectedDoc(
			`
				query AllUsers {
                    ...QueryFragment @with(name: { string: "Hello" })
				}
			`
		),
		mockCollectedDoc(
			`
				fragment QueryFragment on Query
                @arguments(name: {type: "MyInput!"} ) {
                    users(stringValue: $name) {
                        id
                    }
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	const queryContents = await fs.readFile(path.join(config.artifactPath(docs[0].document)))
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		export default {
		    "name": "AllUsers",
		    "kind": "HoudiniQuery",
		    "hash": "10d15eb2346c9fc957012df1a7be8a90e62cbbfea0ba24c08ef7473638aac0e2",

		    "raw": \`query AllUsers {
		  ...QueryFragment_2jlKVi
		}

		fragment QueryFragment_2jlKVi on Query {
		  users(stringValue: {string: "Hello"}) {
		    id
		  }
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User",
		                "keyRaw": "users(stringValue: {string: \\"Hello\\"})",

		                "selection": {
		                    "fields": {
		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id",
		                            "visible": true
		                        }
		                    }
		                }
		            },

		            "__typename": {
		                "type": "String",
		                "keyRaw": "__typename"
		            }
		        },

		        "fragments": {
		            "QueryFragment": {
		                "arguments": {
		                    "name": {
		                        "kind": "ObjectValue",

		                        "fields": [{
		                            "name": {
		                                "kind": "Name",
		                                "value": "string"
		                            },

		                            "value": {
		                                "kind": "StringValue",
		                                "value": "Hello"
		                            }
		                        }]
		                    }
		                }
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=fce39569122174783779ab77a7cfdcf3afec152436b110d717c0c6f4f1c6352b";
	`)
})

test("nullable arguments with no values don't show up in the query", async function () {
	const docs = [
		mockCollectedDoc(
			`
				query AllUsers {
                    ...QueryFragment
				}
			`
		),
		mockCollectedDoc(
			`
				fragment QueryFragment on Query
                @arguments(name: {type: "String"} ) {
                    users(stringValue: $name) {
                        id
                    }
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	const queryContents = await fs.readFile(path.join(config.artifactPath(docs[0].document)))
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		export default {
		    "name": "AllUsers",
		    "kind": "HoudiniQuery",
		    "hash": "bc1c99f3fb9d992d22be5a90356d3e588cf474a33a69c357b34aa79c09fec4d4",

		    "raw": \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  users {
		    id
		  }
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User",
		                "keyRaw": "users",

		                "selection": {
		                    "fields": {
		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id",
		                            "visible": true
		                        }
		                    }
		                }
		            },

		            "__typename": {
		                "type": "String",
		                "keyRaw": "__typename"
		            }
		        },

		        "fragments": {
		            "QueryFragment": {
		                "arguments": {}
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=774e85c1a749388df97ed5768006535072408ceea2a7bba3c835553e2d65e5bd";
	`)
})

test("fragment arguments with default values don't rename the fragment", async function () {
	const docs = [
		mockCollectedDoc(
			`
				query AllUsers {
                    ...QueryFragment
				}
			`
		),
		mockCollectedDoc(
			`
				fragment QueryFragment on Query
                @arguments(name: {type: "String", default: "Hello"}) {
                    users(stringValue: $name) {
                        id
                    }
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	const queryContents = await fs.readFile(path.join(config.artifactPath(docs[0].document)))
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		export default {
		    "name": "AllUsers",
		    "kind": "HoudiniQuery",
		    "hash": "de023c3fc47d48276c27811c22262d4bfb87aad00bbf3387077cfdd9c9f47d02",

		    "raw": \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  users(stringValue: "Hello") {
		    id
		  }
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User",
		                "keyRaw": "users(stringValue: \\"Hello\\")",

		                "selection": {
		                    "fields": {
		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id",
		                            "visible": true
		                        }
		                    }
		                }
		            },

		            "__typename": {
		                "type": "String",
		                "keyRaw": "__typename"
		            }
		        },

		        "fragments": {
		            "QueryFragment": {
		                "arguments": {}
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=774e85c1a749388df97ed5768006535072408ceea2a7bba3c835553e2d65e5bd";
	`)
})

test('thread query variables to inner fragments', async function () {
	const docs = [
		mockCollectedDoc(
			`
				query AllUsers($name: String!) {
                    ...QueryFragment @with(name: $name)
				}
			`
		),
		mockCollectedDoc(
			`
				fragment QueryFragment on Query
                @arguments(name: {type: "String", default: "Hello"}) {
                    ...InnerFragment @with(name: $name)
				}
			`
		),
		mockCollectedDoc(
			`
				fragment InnerFragment on Query
                @arguments(name: {type: "String", default: "Hello"}) {
                    users(stringValue: $name) {
                        id
                    }
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	const queryContents = await fs.readFile(path.join(config.artifactPath(docs[0].document)))
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		export default {
		    "name": "AllUsers",
		    "kind": "HoudiniQuery",
		    "hash": "6800a1d87efa61dbd7cb7663ee6b88125f1b0f4384fd92cd6225879c65a830f2",

		    "raw": \`query AllUsers($name: String!) {
		  ...QueryFragment_VDHGm
		}

		fragment QueryFragment_VDHGm on Query {
		  ...InnerFragment_VDHGm
		  __typename
		}

		fragment InnerFragment_VDHGm on Query {
		  users(stringValue: $name) {
		    id
		  }
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User",
		                "keyRaw": "users(stringValue: $name)",

		                "selection": {
		                    "fields": {
		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id",
		                            "visible": true
		                        }
		                    }
		                }
		            },

		            "__typename": {
		                "type": "String",
		                "keyRaw": "__typename"
		            }
		        },

		        "fragments": {
		            "QueryFragment": {
		                "arguments": {
		                    "name": {
		                        "kind": "Variable",

		                        "name": {
		                            "kind": "Name",
		                            "value": "name"
		                        }
		                    }
		                }
		            },

		            "InnerFragment": {
		                "arguments": {
		                    "name": {
		                        "kind": "Variable",

		                        "name": {
		                            "kind": "Name",
		                            "value": "name"
		                        }
		                    }
		                }
		            }
		        }
		    },

		    "pluginData": {},

		    "input": {
		        "fields": {
		            "name": "String"
		        },

		        "types": {},
		        "defaults": {},
		        "runtimeScalars": {}
		    },

		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=7add8faa7fad1d3ba59adacc533e8e1ab6f92b4805a48b14665eb35591e96bb0";
	`)
})

test('inner fragment with intermediate default value', async function () {
	const docs = [
		mockCollectedDoc(
			`
				query AllUsers {
                    ...QueryFragment
				}
			`
		),
		mockCollectedDoc(
			`
				fragment QueryFragment on Query@arguments(name: {type: "String", default: "Hello"}) {
                    ...InnerFragment @with(name: $name)
				}
			`
		),
		mockCollectedDoc(
			`
				fragment InnerFragment on Query @arguments(name: {type: "String", default: "Goodbye"}, age: {type: "Int", default: 2}) {
                    users(stringValue: $name, intValue: $age) {
                        id
                    }
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	const queryContents = await fs.readFile(path.join(config.artifactPath(docs[0].document)))
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		export default {
		    "name": "AllUsers",
		    "kind": "HoudiniQuery",
		    "hash": "cf6625fcf8937941f787a1a9a30876ee2e74c322f16482368f7594e8dc2f6190",

		    "raw": \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  ...InnerFragment_10b3uv
		  __typename
		}

		fragment InnerFragment_10b3uv on Query {
		  users(stringValue: "Hello", intValue: 2) {
		    id
		  }
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User",
		                "keyRaw": "users(intValue: 2, stringValue: \\"Hello\\")",

		                "selection": {
		                    "fields": {
		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id",
		                            "visible": true
		                        }
		                    }
		                }
		            },

		            "__typename": {
		                "type": "String",
		                "keyRaw": "__typename"
		            }
		        },

		        "fragments": {
		            "QueryFragment": {
		                "arguments": {}
		            },

		            "InnerFragment": {
		                "arguments": {
		                    "name": {
		                        "kind": "StringValue",
		                        "value": "Hello"
		                    }
		                }
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=774e85c1a749388df97ed5768006535072408ceea2a7bba3c835553e2d65e5bd";
	`)
})

test("default values don't overwrite unless explicitly passed", async function () {
	const docs = [
		mockCollectedDoc(
			`
				query AllUsers {
                    ...QueryFragment
				}
			`
		),
		mockCollectedDoc(
			`
				fragment QueryFragment on Query
                @arguments(name: {type: "Int", default: 10}) {
                    ...InnerFragment @with(other: $name)
				}
			`
		),
		mockCollectedDoc(
			`
				fragment InnerFragment on Query
                @arguments(name: {type: "String", default: "Goodbye"}, other: { type: "Int"}) {
                    users(stringValue: $name, intValue: $other) {
                        id
                    }
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	const queryContents = await fs.readFile(path.join(config.artifactPath(docs[0].document)))
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		export default {
		    "name": "AllUsers",
		    "kind": "HoudiniQuery",
		    "hash": "fafbd322d700df78d3c413c0b2293c5fe8a188eef37aded3763d9976bb29e783",

		    "raw": \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  ...InnerFragment_2geNXY
		  __typename
		}

		fragment InnerFragment_2geNXY on Query {
		  users(stringValue: "Goodbye", intValue: 10) {
		    id
		  }
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User",
		                "keyRaw": "users(intValue: 10, stringValue: \\"Goodbye\\")",

		                "selection": {
		                    "fields": {
		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id",
		                            "visible": true
		                        }
		                    }
		                }
		            },

		            "__typename": {
		                "type": "String",
		                "keyRaw": "__typename"
		            }
		        },

		        "fragments": {
		            "QueryFragment": {
		                "arguments": {}
		            },

		            "InnerFragment": {
		                "arguments": {
		                    "other": {
		                        "kind": "IntValue",
		                        "value": "10"
		                    }
		                }
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=774e85c1a749388df97ed5768006535072408ceea2a7bba3c835553e2d65e5bd";
	`)
})

test('default arguments', async function () {
	const docs = [
		mockCollectedDoc(
			`
				query AllUsers {
                    ...QueryFragment
				}
			`
		),
		mockCollectedDoc(
			`
				fragment QueryFragment on Query
                @arguments(name: {type: "String", default: "Hello"}, cool: {type: "Boolean", default: true}) {
                    users(boolValue: $cool, stringValue: $name) {
						id
					}
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	const queryContents = await fs.readFile(path.join(config.artifactPath(docs[0].document)))
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		export default {
		    "name": "AllUsers",
		    "kind": "HoudiniQuery",
		    "hash": "4e6701d785dea5d897bb0f2e5732b764a5b9d5966f7bbf6fddc5ae8152163126",

		    "raw": \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  users(boolValue: true, stringValue: "Hello") {
		    id
		  }
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User",
		                "keyRaw": "users(boolValue: true, stringValue: \\"Hello\\")",

		                "selection": {
		                    "fields": {
		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id",
		                            "visible": true
		                        }
		                    }
		                }
		            },

		            "__typename": {
		                "type": "String",
		                "keyRaw": "__typename"
		            }
		        },

		        "fragments": {
		            "QueryFragment": {
		                "arguments": {}
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=774e85c1a749388df97ed5768006535072408ceea2a7bba3c835553e2d65e5bd";
	`)
})

test('list arguments', async function () {
	const docs = [
		mockCollectedDoc(
			`
				query AllUsers {
                    ...QueryFragment @with(ids: ["1"])
				}
			`
		),
		mockCollectedDoc(
			`
				fragment QueryFragment on Query
                @arguments(ids: {type: "[String]"}) {
                    nodes(ids: $ids) {
						id
					}
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	const queryContents = await fs.readFile(path.join(config.artifactPath(docs[0].document)))
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		export default {
		    "name": "AllUsers",
		    "kind": "HoudiniQuery",
		    "hash": "7e1be51764f0796dd6177c706a98fbb29936492e10238307f748343589401a40",

		    "raw": \`query AllUsers {
		  ...QueryFragment_3CgeGL
		}

		fragment QueryFragment_3CgeGL on Query {
		  nodes(ids: ["1"]) {
		    id
		    __typename
		  }
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "nodes": {
		                "type": "Node",
		                "keyRaw": "nodes(ids: [\\"1\\"])",

		                "selection": {
		                    "fields": {
		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id",
		                            "visible": true
		                        },

		                        "__typename": {
		                            "type": "String",
		                            "keyRaw": "__typename"
		                        }
		                    }
		                },

		                "abstract": true
		            },

		            "__typename": {
		                "type": "String",
		                "keyRaw": "__typename"
		            }
		        },

		        "fragments": {
		            "QueryFragment": {
		                "arguments": {
		                    "ids": {
		                        "kind": "ListValue",

		                        "values": [{
		                            "kind": "StringValue",
		                            "value": "1"
		                        }]
		                    }
		                }
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=f67cc1c3f5ad8a2d241316a5a1e163616f79db7d2396d7a76750a34038b48fef";
	`)
})

test('persists fragment variables in artifact', async function () {
	const docs = [
		mockCollectedDoc(
			`
				fragment QueryFragment on Query
                @arguments(name: {type: "String", default: "Hello"}, cool: {type: "Boolean", default: true}) {
                    users(boolValue: $cool, stringValue: $name) {
						id
					}
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	// verify contents
	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "QueryFragment",
		    "kind": "HoudiniFragment",
		    "hash": "b88adde313470424afb61bf45e7b71df8b81ca0e93500ebdcb2c1141aa7cf1fd",

		    "raw": \`fragment QueryFragment on Query {
		  users(boolValue: $cool, stringValue: $name) {
		    id
		  }
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "users": {
		                "type": "User",
		                "keyRaw": "users(boolValue: $cool, stringValue: $name)",

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
		            },

		            "__typename": {
		                "type": "String",
		                "keyRaw": "__typename",
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},

		    "input": {
		        "fields": {
		            "name": "String",
		            "cool": "Boolean"
		        },

		        "types": {},

		        "defaults": {
		            "name": "Hello",
		            "cool": true
		        },

		        "runtimeScalars": {}
		    }
		};

		"HoudiniHash=6c327bb344ded7bcdfa0cb250d5139bb8e18d5618335b4e621a06576cb10a67f";
	`)
})

describe('parse argument type string', function () {
	const table: {
		title: string
		input: string
		expected: graphql.TypeNode
	}[] = [
		{
			title: 'named types',
			input: 'String',
			expected: {
				kind: 'NamedType',
				name: {
					kind: 'Name',
					value: 'String',
				},
			},
		},
		{
			title: 'non-null type',
			input: 'String!',
			expected: {
				kind: 'NonNullType',
				type: {
					kind: 'NamedType',
					name: {
						kind: 'Name',
						value: 'String',
					},
				},
			},
		},
		{
			title: 'list',
			input: '[String]',
			expected: {
				kind: 'ListType',
				type: {
					kind: 'NamedType',
					name: {
						kind: 'Name',
						value: 'String',
					},
				},
			},
		},
		{
			title: 'non-null list',
			input: '[String]!',
			expected: {
				kind: 'NonNullType',
				type: {
					kind: 'ListType',
					type: {
						kind: 'NamedType',
						name: {
							kind: 'Name',
							value: 'String',
						},
					},
				},
			},
		},
		{
			title: 'non-null list of non-null named typesnon-null list of non-null named types',
			input: '[String!]!',
			expected: {
				kind: 'NonNullType',
				type: {
					kind: 'ListType',
					type: {
						kind: 'NonNullType',
						type: {
							kind: 'NamedType',
							name: {
								kind: 'Name',
								value: 'String',
							},
						},
					},
				},
			},
		},
	]

	for (const row of table) {
		test(row.title, function () {
			expect(parseArgumentTypeString(row.input)).toEqual(row.expected)
		})
	}
})

test('variables referenced deeply in objects', async function () {
	const docs = [
		mockCollectedDoc(
			`
				fragment QueryFragment on Query
                @arguments(name: {type: "String!"}) {
                    usersByOffset(filter: {name: $name}) {
						id
					}
				}
			`
		),
		mockCollectedDoc(
			`
				query TestQuery {
					...QueryFragment @with(name: "Foo")
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	expect(docs[0]).toMatchInlineSnapshot(`
		export default {
		    "name": "QueryFragment",
		    "kind": "HoudiniFragment",
		    "hash": "d004e3d9616387b95d9529bcc23f4781b1fa99b70f050f2ea4c17409d85e5996",

		    "raw": \`fragment QueryFragment on Query {
		  usersByOffset(filter: {name: $name}) {
		    id
		  }
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "usersByOffset": {
		                "type": "User",
		                "keyRaw": "usersByOffset(filter: {name: $name})",

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
		            },

		            "__typename": {
		                "type": "String",
		                "keyRaw": "__typename",
		                "visible": true
		            }
		        }
		    },

		    "pluginData": {},

		    "input": {
		        "fields": {
		            "name": "String"
		        },

		        "types": {},
		        "defaults": {},
		        "runtimeScalars": {}
		    }
		};

		"HoudiniHash=f21383b76145c5c42b10436ccde99cb9f0a7156d4209149b2d94a01c8445e88c";
	`)

	expect(docs[1]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestQuery",
		    "kind": "HoudiniQuery",
		    "hash": "e7b6075d4fef703c7375d9e582ecaab4da5bdc26edc7e92d004e174bf5def5f7",

		    "raw": \`query TestQuery {
		  ...QueryFragment_32RKor
		}

		fragment QueryFragment_32RKor on Query {
		  usersByOffset(filter: {name: "Foo"}) {
		    id
		  }
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "usersByOffset": {
		                "type": "User",
		                "keyRaw": "usersByOffset(filter: {name: \\"Foo\\"})",

		                "selection": {
		                    "fields": {
		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id",
		                            "visible": true
		                        }
		                    }
		                }
		            },

		            "__typename": {
		                "type": "String",
		                "keyRaw": "__typename"
		            }
		        },

		        "fragments": {
		            "QueryFragment": {
		                "arguments": {
		                    "name": {
		                        "kind": "StringValue",
		                        "value": "Foo"
		                    }
		                }
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=bfcbae34fee98e0c32493bd3445ab074fdccff7c7b3721245047202887a842e9";
	`)
})

test('can use the same fragment/argument combo multiple times', async function () {
	const docs = [
		mockCollectedDoc(
			`
				fragment QueryFragment on Query
                @arguments(name: {type: "String!"}) {
                    usersByOffset(filter: {name: $name}) {
						id
					}
				}
			`
		),
		mockCollectedDoc(
			`
				query TestQuery1 {
					...QueryFragment @with(name: "Foo")
				}
			`
		),
		mockCollectedDoc(
			`
				query TestQuery2 {
					...QueryFragment @with(name: "Bar")
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	expect(docs[1]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestQuery1",
		    "kind": "HoudiniQuery",
		    "hash": "c34b3297e140c5742038818dd6582acef375a4b069f1b6c8fb6b504d200a616f",

		    "raw": \`query TestQuery1 {
		  ...QueryFragment_32RKor
		}

		fragment QueryFragment_32RKor on Query {
		  usersByOffset(filter: {name: "Foo"}) {
		    id
		  }
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "usersByOffset": {
		                "type": "User",
		                "keyRaw": "usersByOffset(filter: {name: \\"Foo\\"})",

		                "selection": {
		                    "fields": {
		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id",
		                            "visible": true
		                        }
		                    }
		                }
		            },

		            "__typename": {
		                "type": "String",
		                "keyRaw": "__typename"
		            }
		        },

		        "fragments": {
		            "QueryFragment": {
		                "arguments": {
		                    "name": {
		                        "kind": "StringValue",
		                        "value": "Foo"
		                    }
		                }
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=d4956b482f8e85d80c01de2bd906ea4f9e7d5f190280f7a8c5dc88d0ac3ecf36";
	`)
	expect(docs[2]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestQuery2",
		    "kind": "HoudiniQuery",
		    "hash": "c92fc619fcbd1ef2609a20a449af5d8fd99a6d8cddf8cf006195cf26ca9e22d6",

		    "raw": \`query TestQuery2 {
		  ...QueryFragment_2wUXVX
		}

		fragment QueryFragment_2wUXVX on Query {
		  usersByOffset(filter: {name: "Bar"}) {
		    id
		  }
		  __typename
		}\`,

		    "rootType": "Query",
		    "stripVariables": [],

		    "selection": {
		        "fields": {
		            "usersByOffset": {
		                "type": "User",
		                "keyRaw": "usersByOffset(filter: {name: \\"Bar\\"})",

		                "selection": {
		                    "fields": {
		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id",
		                            "visible": true
		                        }
		                    }
		                }
		            },

		            "__typename": {
		                "type": "String",
		                "keyRaw": "__typename"
		            }
		        },

		        "fragments": {
		            "QueryFragment": {
		                "arguments": {
		                    "name": {
		                        "kind": "StringValue",
		                        "value": "Bar"
		                    }
		                }
		            }
		        }
		    },

		    "pluginData": {},
		    "policy": "CacheOrNetwork",
		    "partial": false
		};

		"HoudiniHash=2af53e6fb40c9a4c8773e53112355a003e6bedb3d504a95d8e1369fe963f0322";
	`)
})
