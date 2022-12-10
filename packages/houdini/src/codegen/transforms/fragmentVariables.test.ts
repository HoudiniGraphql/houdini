import type { ProgramKind } from 'ast-types/gen/kinds'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
import { test, expect } from 'vitest'

import { runPipeline } from '../../codegen'
import { fs, path } from '../../lib'
import { testConfig, mockCollectedDoc } from '../../test'

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
		    name: "AllUsers",
		    kind: "HoudiniQuery",
		    hash: "c346b9eaafaa74d18a267a74706e193e8080b9533d994d6e8489d7e5b534ee41",

		    raw: \`query AllUsers {
		  ...QueryFragment_10b3uv
		}

		fragment QueryFragment_10b3uv on Query {
		  users(stringValue: "Hello") {
		    id
		  }
		}
		\`,

		    rootType: "Query",

		    selection: {
		        fields: {
		            users: {
		                type: "User",
		                keyRaw: "users(stringValue: \\"Hello\\")",

		                selection: {
		                    fields: {
		                        id: {
		                            type: "ID",
		                            keyRaw: "id"
		                        }
		                    }
		                }
		            }
		        }
		    },

		    policy: "CacheOrNetwork",
		    partial: false
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
		    name: "AllUsers",
		    kind: "HoudiniQuery",
		    hash: "19b6a6cc9d06ab798cbf4b0a9530e07a3473b78e7d964cc9d6557d8240ed9012",

		    raw: \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  users {
		    id
		  }
		}
		\`,

		    rootType: "Query",

		    selection: {
		        fields: {
		            users: {
		                type: "User",
		                keyRaw: "users",

		                selection: {
		                    fields: {
		                        id: {
		                            type: "ID",
		                            keyRaw: "id"
		                        }
		                    }
		                }
		            }
		        }
		    },

		    policy: "CacheOrNetwork",
		    partial: false
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
		    name: "AllUsers",
		    kind: "HoudiniQuery",
		    hash: "3835ee68277547d738cc8fd5051fe98799b5bd470516146906fa0f134a2b3891",

		    raw: \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  users(stringValue: "Hello") {
		    id
		  }
		}
		\`,

		    rootType: "Query",

		    selection: {
		        fields: {
		            users: {
		                type: "User",
		                keyRaw: "users(stringValue: \\"Hello\\")",

		                selection: {
		                    fields: {
		                        id: {
		                            type: "ID",
		                            keyRaw: "id"
		                        }
		                    }
		                }
		            }
		        }
		    },

		    policy: "CacheOrNetwork",
		    partial: false
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
		    name: "AllUsers",
		    kind: "HoudiniQuery",
		    hash: "8fa4273ab75455c901e7de893f72a28af4c001afbf204ceca2fd7ab30b7ff372",

		    raw: \`query AllUsers($name: String!) {
		  ...QueryFragment_VDHGm
		}

		fragment QueryFragment_VDHGm on Query {
		  ...InnerFragment_VDHGm
		}

		fragment InnerFragment_VDHGm on Query {
		  users(stringValue: $name) {
		    id
		  }
		}
		\`,

		    rootType: "Query",

		    selection: {
		        fields: {
		            users: {
		                type: "User",
		                keyRaw: "users(stringValue: $name)",

		                selection: {
		                    fields: {
		                        id: {
		                            type: "ID",
		                            keyRaw: "id"
		                        }
		                    }
		                }
		            }
		        }
		    },

		    input: {
		        fields: {
		            name: "String"
		        },

		        types: {}
		    },

		    policy: "CacheOrNetwork",
		    partial: false
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
		    name: "AllUsers",
		    kind: "HoudiniQuery",
		    hash: "d5753a3cae56b8133c72527cdccdd0c001effb48104b98806ac62dd9afeeb259",

		    raw: \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  ...InnerFragment_10b3uv
		}

		fragment InnerFragment_10b3uv on Query {
		  users(stringValue: "Hello", intValue: 2) {
		    id
		  }
		}
		\`,

		    rootType: "Query",

		    selection: {
		        fields: {
		            users: {
		                type: "User",
		                keyRaw: "users(stringValue: \\"Hello\\", intValue: 2)",

		                selection: {
		                    fields: {
		                        id: {
		                            type: "ID",
		                            keyRaw: "id"
		                        }
		                    }
		                }
		            }
		        }
		    },

		    policy: "CacheOrNetwork",
		    partial: false
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
		    name: "AllUsers",
		    kind: "HoudiniQuery",
		    hash: "b155b401cdbdfe0f63dd47575fbcfb2aa90678e7530b93476c4efe559405cf4f",

		    raw: \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  ...InnerFragment_2geNXY
		}

		fragment InnerFragment_2geNXY on Query {
		  users(stringValue: "Goodbye", intValue: 10) {
		    id
		  }
		}
		\`,

		    rootType: "Query",

		    selection: {
		        fields: {
		            users: {
		                type: "User",
		                keyRaw: "users(stringValue: \\"Goodbye\\", intValue: 10)",

		                selection: {
		                    fields: {
		                        id: {
		                            type: "ID",
		                            keyRaw: "id"
		                        }
		                    }
		                }
		            }
		        }
		    },

		    policy: "CacheOrNetwork",
		    partial: false
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
		    name: "AllUsers",
		    kind: "HoudiniQuery",
		    hash: "5c4a8d1fe2e117286ecdfbd273bf1beb2f71a0a3fd9ea6bc84fe97c394c1a836",

		    raw: \`query AllUsers {
		  ...QueryFragment
		}

		fragment QueryFragment on Query {
		  users(boolValue: true, stringValue: "Hello") {
		    id
		  }
		}
		\`,

		    rootType: "Query",

		    selection: {
		        fields: {
		            users: {
		                type: "User",
		                keyRaw: "users(boolValue: true, stringValue: \\"Hello\\")",

		                selection: {
		                    fields: {
		                        id: {
		                            type: "ID",
		                            keyRaw: "id"
		                        }
		                    }
		                }
		            }
		        }
		    },

		    policy: "CacheOrNetwork",
		    partial: false
		};

		"HoudiniHash=774e85c1a749388df97ed5768006535072408ceea2a7bba3c835553e2d65e5bd";
	`)
})

test('multiple with directives - no overlap', async function () {
	const docs = [
		mockCollectedDoc(
			`
				query AllUsers {
                    ...QueryFragment @with(name: "Goodbye") @with(cool: false)
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
		    name: "AllUsers",
		    kind: "HoudiniQuery",
		    hash: "7327e6f7f6c8339feebb640b995c3e25efe1b25de29b1f43cb55c2a0566f713f",

		    raw: \`query AllUsers {
		  ...QueryFragment_2prn0K
		}

		fragment QueryFragment_2prn0K on Query {
		  users(boolValue: false, stringValue: "Goodbye") {
		    id
		  }
		}
		\`,

		    rootType: "Query",

		    selection: {
		        fields: {
		            users: {
		                type: "User",
		                keyRaw: "users(boolValue: false, stringValue: \\"Goodbye\\")",

		                selection: {
		                    fields: {
		                        id: {
		                            type: "ID",
		                            keyRaw: "id"
		                        }
		                    }
		                }
		            }
		        }
		    },

		    policy: "CacheOrNetwork",
		    partial: false
		};

		"HoudiniHash=10b3cd7304221a7e9337b66dd1b083c11cafad428fe02bc0b889f2eb5fe524ff";
	`)
})
