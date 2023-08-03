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
		    "hash": "63b95bca0542c187f64fef9cb34e6b242608469f6a7baffd959791c8cda019f8",

		    "raw": \`query AllUsers {
		  ...QueryFragment_10b3uv
		}

		fragment QueryFragment_10b3uv on Query {
		  users(stringValue: "Hello") {
		    id
		  }
		  __typename
		}
		\`,

		    "rootType": "Query",

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
		    "hash": "ab2d1ea10cd570b2b0601c94918f5f6790f90da88447d312ebc4138cc99b8e7c",

		    "raw": \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  users {
		    id
		  }
		  __typename
		}
		\`,

		    "rootType": "Query",

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
		    "hash": "e1f9f94024736db98349817f3675dc3b2a7c73871ca98761721f4b9849926471",

		    "raw": \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  users(stringValue: "Hello") {
		    id
		  }
		  __typename
		}
		\`,

		    "rootType": "Query",

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
		    "hash": "b47b265965f007004f2afa343be60b957aad287780ff0bfce23285a78b5c0e63",

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
		}
		\`,

		    "rootType": "Query",

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
		            }
		        }
		    },

		    "pluginData": {},

		    "input": {
		        "fields": {
		            "name": "String"
		        },

		        "types": {}
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
				fragment QueryFragment on Query
                @arguments(name: {type: "String", default: "Hello"}) {
                    ...InnerFragment @with(name: $name)
				}
			`
		),
		mockCollectedDoc(
			`
				fragment InnerFragment on Query
                @arguments(name: {type: "String", default: "Goodbye"}, age: {type: "Int", default: 2}) {
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
		    "hash": "09adc383071454f2de0a177990907e7616f1c69516611a283dd4bb5231ace3d0",

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
		}
		\`,

		    "rootType": "Query",

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
		    "hash": "802f77faf17be02863ece90662db7e157c6911bbc9c7b49f191d0de332048543",

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
		}
		\`,

		    "rootType": "Query",

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
		    "hash": "bce1104854002aaa0befe5045ad6b3780783d6488d2c91a132449918c5c61228",

		    "raw": \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  users(boolValue: true, stringValue: "Hello") {
		    id
		  }
		  __typename
		}
		\`,

		    "rootType": "Query",

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
		    "hash": "32c6a8a189da923b8c68c54909f2aa28063a7752a0bb2b3601834899de4dd3a7",

		    "raw": \`query AllUsers {
		  ...QueryFragment_4AWlIw
		}

		fragment QueryFragment_4AWlIw on Query {
		  nodes(ids: ["1"]) {
		    id
		    __typename
		  }
		  __typename
		}
		\`,

		    "rootType": "Query",

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
		    "hash": "695bc5e3268ac222dca193dd7daee95d4d0b773268624c45e521a69bbda62185",

		    "raw": \`fragment QueryFragment on Query {
		  users(boolValue: $cool, stringValue: $name) {
		    id
		  }
		  __typename
		}
		\`,

		    "rootType": "Query",

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

		        "types": {}
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
		    "hash": "2ec5f34429b6e7e9240f8d051c53f10d627f195d9ba5a2400d2d01c783fb9c23",

		    "raw": \`fragment QueryFragment on Query {
		  usersByOffset(filter: {name: $name}) {
		    id
		  }
		  __typename
		}
		\`,

		    "rootType": "Query",

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

		        "types": {}
		    }
		};

		"HoudiniHash=f21383b76145c5c42b10436ccde99cb9f0a7156d4209149b2d94a01c8445e88c";
	`)

	expect(docs[1]).toMatchInlineSnapshot(`
		export default {
		    "name": "TestQuery",
		    "kind": "HoudiniQuery",
		    "hash": "3732c2ad47dee53626f380d850a8f8ef511e892287b94b901e05de4ca549ff40",

		    "raw": \`query TestQuery {
		  ...QueryFragment_32RKor
		}

		fragment QueryFragment_32RKor on Query {
		  usersByOffset(filter: {name: "Foo"}) {
		    id
		  }
		  __typename
		}
		\`,

		    "rootType": "Query",

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
		    "hash": "a686b6492a07c32752ba286df91f4e84058324c0d64e96c6b5e6f399c9719f32",

		    "raw": \`query TestQuery1 {
		  ...QueryFragment_32RKor
		}

		fragment QueryFragment_32RKor on Query {
		  usersByOffset(filter: {name: "Foo"}) {
		    id
		  }
		  __typename
		}
		\`,

		    "rootType": "Query",

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
		    "hash": "487e32683c414ded5a9941e98fba099deaae6e497899bb8bf24d3b8c3de1aa8a",

		    "raw": \`query TestQuery2 {
		  ...QueryFragment_2wUXVX
		}

		fragment QueryFragment_2wUXVX on Query {
		  usersByOffset(filter: {name: "Bar"}) {
		    id
		  }
		  __typename
		}
		\`,

		    "rootType": "Query",

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
