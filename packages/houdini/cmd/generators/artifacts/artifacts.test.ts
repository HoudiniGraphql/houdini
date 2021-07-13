// external imports
import path from 'path'
import { testConfig } from 'houdini-common'
import fs from 'fs/promises'
import * as typeScriptParser from 'recast/parsers/typescript'
import { ProgramKind } from 'ast-types/gen/kinds'
import * as recast from 'recast'
// local imports
import '../../../../../jest.setup'
import { runPipeline } from '../../generate'
import { CollectedGraphQLDocument } from '../../types'
import { mockCollectedDoc } from '../../testUtils'

// the config to use in tests
const config = testConfig()

// the documents to test
const docs: CollectedGraphQLDocument[] = [
	mockCollectedDoc(`query TestQuery { version }`),
	mockCollectedDoc(`fragment TestFragment on User { firstName }`),
]

test('generates an artifact for every document', async function () {
	// execute the generator
	await runPipeline(config, docs)

	// look up the files in the artifact directory
	const files = await fs.readdir(config.artifactDirectory)

	// and they have the right names
	expect(files).toEqual(expect.arrayContaining(['TestQuery.js', 'TestFragment.js']))
})

test('adds kind, name, and raw, response, and selection', async function () {
	// execute the generator
	await runPipeline(config, docs)

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(config.artifactPath(docs[0].document)),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "TestQuery",
		    kind: "HoudiniQuery",

		    raw: \`query TestQuery {
		  version
		}
		\`,

		    rootType: "Query",

		    selection: {
		        "version": {
		            "type": "Int",
		            "keyRaw": "version"
		        }
		    }
		};
	`)

	const fragmentContents = await fs.readFile(
		path.join(config.artifactPath(docs[1].document)),
		'utf-8'
	)
	expect(fragmentContents).toBeTruthy()
	// parse the contents
	const parsedFragment: ProgramKind = recast.parse(fragmentContents, {
		parser: typeScriptParser,
	}).program
	// and verify their content
	expect(parsedFragment).toMatchInlineSnapshot(`
		module.exports = {
		    name: "TestFragment",
		    kind: "HoudiniFragment",

		    raw: \`fragment TestFragment on User {
		  firstName
		}
		\`,

		    rootType: "User",

		    selection: {
		        "firstName": {
		            "type": "String",
		            "keyRaw": "firstName"
		        }
		    }
		};
	`)
})

test('selection includes fragments', async function () {
	// the documents to test
	const selectionDocs: CollectedGraphQLDocument[] = [
		mockCollectedDoc(`query TestQuery { user { ...TestFragment } }`),
		mockCollectedDoc(`fragment TestFragment on User { firstName }`),
	]

	// execute the generator
	await runPipeline(config, selectionDocs)

	//
	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(config.artifactPath(selectionDocs[0].document)),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "TestQuery",
		    kind: "HoudiniQuery",

		    raw: \`query TestQuery {
		  user {
		    ...TestFragment
		    id
		  }
		}

		fragment TestFragment on User {
		  firstName
		}
		\`,

		    rootType: "Query",

		    selection: {
		        "user": {
		            "type": "User",
		            "keyRaw": "user",

		            "fields": {
		                "firstName": {
		                    "type": "String",
		                    "keyRaw": "firstName"
		                },

		                "id": {
		                    "type": "ID",
		                    "keyRaw": "id"
		                }
		            }
		        }
		    }
		};
	`)

	const fragmentContents = await fs.readFile(
		path.join(config.artifactPath(docs[1].document)),
		'utf-8'
	)
	expect(fragmentContents).toBeTruthy()
	// parse the contents
	const parsedFragment: ProgramKind = recast.parse(fragmentContents, {
		parser: typeScriptParser,
	}).program
	// and verify their content
	expect(parsedFragment).toMatchInlineSnapshot(`
		module.exports = {
		    name: "TestFragment",
		    kind: "HoudiniFragment",

		    raw: \`fragment TestFragment on User {
		  firstName
		}
		\`,

		    rootType: "User",

		    selection: {
		        "firstName": {
		            "type": "String",
		            "keyRaw": "firstName"
		        }
		    }
		};
	`)
})

test('internal directives are scrubbed', async function () {
	// execute the generator
	await runPipeline(config, [
		mockCollectedDoc(`fragment A on User { firstName }`),
		mockCollectedDoc(`query TestQuery { user { ...A @prepend } }`),
	])

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(config.artifactPath(docs[0].document)),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "TestQuery",
		    kind: "HoudiniQuery",

		    raw: \`query TestQuery {
		  user {
		    ...A
		    id
		  }
		}

		fragment A on User {
		  firstName
		}
		\`,

		    rootType: "Query",

		    selection: {
		        "user": {
		            "type": "User",
		            "keyRaw": "user",

		            "fields": {
		                "firstName": {
		                    "type": "String",
		                    "keyRaw": "firstName"
		                },

		                "id": {
		                    "type": "ID",
		                    "keyRaw": "id"
		                }
		            }
		        }
		    }
		};
	`)
})

test('overlapping query and fragment selection', async function () {
	// execute the generator
	await runPipeline(config, [
		mockCollectedDoc(`fragment A on User { firstName }`),
		mockCollectedDoc(`query TestQuery { user { firstName ...A @prepend } }`),
	])

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(config.artifactPath(docs[0].document)),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "TestQuery",
		    kind: "HoudiniQuery",

		    raw: \`query TestQuery {
		  user {
		    firstName
		    ...A
		    id
		  }
		}

		fragment A on User {
		  firstName
		}
		\`,

		    rootType: "Query",

		    selection: {
		        "user": {
		            "type": "User",
		            "keyRaw": "user",

		            "fields": {
		                "firstName": {
		                    "type": "String",
		                    "keyRaw": "firstName"
		                },

		                "id": {
		                    "type": "ID",
		                    "keyRaw": "id"
		                }
		            }
		        }
		    }
		};
	`)
})

test('overlapping query and fragment nested selection', async function () {
	// execute the generator
	await runPipeline(config, [
		mockCollectedDoc(`fragment A on User { friends { id } }`),
		mockCollectedDoc(`query TestQuery { user { friends { firstName } ...A @prepend } }`),
	])

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(config.artifactPath(docs[0].document)),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "TestQuery",
		    kind: "HoudiniQuery",

		    raw: \`query TestQuery {
		  user {
		    friends {
		      firstName
		      id
		    }
		    ...A
		    id
		  }
		}

		fragment A on User {
		  friends {
		    id
		  }
		}
		\`,

		    rootType: "Query",

		    selection: {
		        "user": {
		            "type": "User",
		            "keyRaw": "user",

		            "fields": {
		                "friends": {
		                    "type": "User",
		                    "keyRaw": "friends",

		                    "fields": {
		                        "firstName": {
		                            "type": "String",
		                            "keyRaw": "firstName"
		                        },

		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id"
		                        }
		                    }
		                },

		                "id": {
		                    "type": "ID",
		                    "keyRaw": "id"
		                }
		            }
		        }
		    }
		};
	`)
})

test('selections with interfaces', async function () {
	const cfg = testConfig({ mode: 'kit' })
	const mutationDocs = [
		mockCollectedDoc(
			`query Friends {
					friends {
                        ... on Cat {
                            id
							owner {
								firstName
							}
                        }
                        ... on Ghost {
                            name
                        }
					}
				}`
		),
	]

	// execute the generator
	await runPipeline(cfg, mutationDocs)

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(cfg.artifactPath(mutationDocs[0].document)),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		export default {
		    name: "Friends",
		    kind: "HoudiniQuery",

		    raw: \`query Friends {
		  friends {
		    ... on Cat {
		      id
		      owner {
		        firstName
		        id
		      }
		    }
		    ... on Ghost {
		      name
		    }
		    __typename
		  }
		}
		\`,

		    rootType: "Query",

		    selection: {
		        "friends": {
		            "type": "Friend",
		            "keyRaw": "friends",

		            "fields": {
		                "id": {
		                    "type": "ID",
		                    "keyRaw": "id"
		                },

		                "owner": {
		                    "type": "User",
		                    "keyRaw": "owner",

		                    "fields": {
		                        "firstName": {
		                            "type": "String",
		                            "keyRaw": "firstName"
		                        },

		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id"
		                        }
		                    }
		                },

		                "name": {
		                    "type": "String",
		                    "keyRaw": "name"
		                },

		                "__typename": {
		                    "type": "String",
		                    "keyRaw": "__typename"
		                }
		            },

		            "abstract": true
		        }
		    }
		};
	`)
})

test('selections with unions', async function () {
	const cfg = testConfig({ mode: 'kit' })
	const mutationDocs = [
		mockCollectedDoc(
			`query Friends {
					entities {
                        ... on Cat {
                            id
							owner {
								firstName
							}
                        }
                        ... on Ghost {
                            name
                        }
					}
				}`
		),
	]

	// execute the generator
	await runPipeline(cfg, mutationDocs)

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(cfg.artifactPath(mutationDocs[0].document)),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		export default {
		    name: "Friends",
		    kind: "HoudiniQuery",

		    raw: \`query Friends {
		  entities {
		    ... on Cat {
		      id
		      owner {
		        firstName
		        id
		      }
		    }
		    ... on Ghost {
		      name
		    }
		    __typename
		  }
		}
		\`,

		    rootType: "Query",

		    selection: {
		        "entities": {
		            "type": "Entity",
		            "keyRaw": "entities",

		            "fields": {
		                "id": {
		                    "type": "ID",
		                    "keyRaw": "id"
		                },

		                "owner": {
		                    "type": "User",
		                    "keyRaw": "owner",

		                    "fields": {
		                        "firstName": {
		                            "type": "String",
		                            "keyRaw": "firstName"
		                        },

		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id"
		                        }
		                    }
		                },

		                "name": {
		                    "type": "String",
		                    "keyRaw": "name"
		                },

		                "__typename": {
		                    "type": "String",
		                    "keyRaw": "__typename"
		                }
		            },

		            "abstract": true
		        }
		    }
		};
	`)
})

describe('mutation artifacts', function () {
	test('empty operation list', async function () {
		const cfg = testConfig({ mode: 'kit' })

		const mutationDocs = [
			mockCollectedDoc(
				`mutation B {
					addFriend {
						friend {
							firstName
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(cfg, mutationDocs)

		// load the contents of the file
		const queryContents = await fs.readFile(
			path.join(cfg.artifactPath(mutationDocs[0].document)),
			'utf-8'
		)
		expect(queryContents).toBeTruthy()
		// parse the contents
		const parsedQuery: ProgramKind = recast.parse(queryContents, {
			parser: typeScriptParser,
		}).program
		// verify contents
		expect(parsedQuery).toMatchInlineSnapshot(`
		export default {
		    name: "B",
		    kind: "HoudiniMutation",

		    raw: \`mutation B {
		  addFriend {
		    friend {
		      firstName
		      id
		    }
		  }
		}
		\`,

		    rootType: "Mutation",

		    selection: {
		        "addFriend": {
		            "type": "AddFriendOutput",
		            "keyRaw": "addFriend",

		            "fields": {
		                "friend": {
		                    "type": "User",
		                    "keyRaw": "friend",

		                    "fields": {
		                        "firstName": {
		                            "type": "String",
		                            "keyRaw": "firstName"
		                        },

		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id"
		                        }
		                    }
		                }
		            }
		        }
		    }
		};
	`)
	})

	test('insert operation', async function () {
		const mutationDocs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, mutationDocs)

		// load the contents of the file
		const queryContents = await fs.readFile(
			path.join(config.artifactPath(mutationDocs[0].document)),
			'utf-8'
		)
		expect(queryContents).toBeTruthy()
		// parse the contents
		const parsedQuery: ProgramKind = recast.parse(queryContents, {
			parser: typeScriptParser,
		}).program
		// verify contents
		expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "A",
		    kind: "HoudiniMutation",

		    raw: \`mutation A {
		  addFriend {
		    friend {
		      ...All_Users_insert
		      id
		    }
		  }
		}

		fragment All_Users_insert on User {
		  firstName
		  id
		}
		\`,

		    rootType: "Mutation",

		    selection: {
		        "addFriend": {
		            "type": "AddFriendOutput",
		            "keyRaw": "addFriend",

		            "fields": {
		                "friend": {
		                    "type": "User",
		                    "keyRaw": "friend",

		                    "fields": {
		                        "firstName": {
		                            "type": "String",
		                            "keyRaw": "firstName"
		                        },

		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id"
		                        }
		                    },

		                    "operations": [{
		                        "action": "insert",
		                        "list": "All_Users",
		                        "position": "last"
		                    }]
		                }
		            }
		        }
		    }
		};
	`)
	})

	test('remove operation', async function () {
		const mutationDocs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_remove
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, mutationDocs)

		// load the contents of the file
		const queryContents = await fs.readFile(
			path.join(config.artifactPath(mutationDocs[0].document)),
			'utf-8'
		)
		expect(queryContents).toBeTruthy()
		// parse the contents
		const parsedQuery: ProgramKind = recast.parse(queryContents, {
			parser: typeScriptParser,
		}).program
		// verify contents
		expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "A",
		    kind: "HoudiniMutation",

		    raw: \`mutation A {
		  addFriend {
		    friend {
		      ...All_Users_remove
		      id
		    }
		  }
		}

		fragment All_Users_remove on User {
		  id
		}
		\`,

		    rootType: "Mutation",

		    selection: {
		        "addFriend": {
		            "type": "AddFriendOutput",
		            "keyRaw": "addFriend",

		            "fields": {
		                "friend": {
		                    "type": "User",
		                    "keyRaw": "friend",

		                    "fields": {
		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id"
		                        }
		                    },

		                    "operations": [{
		                        "action": "remove",
		                        "list": "All_Users"
		                    }]
		                }
		            }
		        }
		    }
		};
	`)
	})

	test('delete operation', async function () {
		const mutationDocs = [
			mockCollectedDoc(
				`mutation A {
					deleteUser(id: "1234") {
						userID @User_delete
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, mutationDocs)

		// load the contents of the file
		const queryContents = await fs.readFile(
			path.join(config.artifactPath(mutationDocs[0].document)),
			'utf-8'
		)
		expect(queryContents).toBeTruthy()
		// parse the contents
		const parsedQuery: ProgramKind = recast.parse(queryContents, {
			parser: typeScriptParser,
		}).program
		// verify contents
		expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "A",
		    kind: "HoudiniMutation",

		    raw: \`mutation A {
		  deleteUser(id: "1234") {
		    userID
		  }
		}
		\`,

		    rootType: "Mutation",

		    selection: {
		        "deleteUser": {
		            "type": "DeleteUserOutput",
		            "keyRaw": "deleteUser(id: \\"1234\\")",

		            "fields": {
		                "userID": {
		                    "type": "ID",
		                    "keyRaw": "userID",

		                    "operations": [{
		                        "action": "delete",
		                        "type": "User"
		                    }]
		                }
		            }
		        }
		    }
		};
	`)
	})

	test('delete operation with condition', async function () {
		const mutationDocs = [
			mockCollectedDoc(
				`mutation A {
					deleteUser(id: "1234") {
						userID @User_delete @when(argument: "stringValue", value: "foo")
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, mutationDocs)

		// load the contents of the file
		const queryContents = await fs.readFile(
			path.join(config.artifactPath(mutationDocs[0].document)),
			'utf-8'
		)
		expect(queryContents).toBeTruthy()
		// parse the contents
		const parsedQuery: ProgramKind = recast.parse(queryContents, {
			parser: typeScriptParser,
		}).program
		// verify contents
		expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "A",
		    kind: "HoudiniMutation",

		    raw: \`mutation A {
		  deleteUser(id: "1234") {
		    userID
		  }
		}
		\`,

		    rootType: "Mutation",

		    selection: {
		        "deleteUser": {
		            "type": "DeleteUserOutput",
		            "keyRaw": "deleteUser(id: \\"1234\\")",

		            "fields": {
		                "userID": {
		                    "type": "ID",
		                    "keyRaw": "userID",

		                    "operations": [{
		                        "action": "delete",
		                        "type": "User",

		                        "when": {
		                            "must": {
		                                "stringValue": "foo"
		                            }
		                        }
		                    }]
		                }
		            }
		        }
		    }
		};
	`)
	})

	test('parentID - prepend', async function () {
		const mutationDocs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @prepend(parentID: "1234")
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, mutationDocs)

		// load the contents of the file
		const queryContents = await fs.readFile(
			path.join(config.artifactPath(mutationDocs[0].document)),
			'utf-8'
		)
		expect(queryContents).toBeTruthy()
		// parse the contents
		const parsedQuery: ProgramKind = recast.parse(queryContents, {
			parser: typeScriptParser,
		}).program
		// verify contents
		expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "A",
		    kind: "HoudiniMutation",

		    raw: \`mutation A {
		  addFriend {
		    friend {
		      ...All_Users_insert
		      id
		    }
		  }
		}

		fragment All_Users_insert on User {
		  firstName
		  id
		}
		\`,

		    rootType: "Mutation",

		    selection: {
		        "addFriend": {
		            "type": "AddFriendOutput",
		            "keyRaw": "addFriend",

		            "fields": {
		                "friend": {
		                    "type": "User",
		                    "keyRaw": "friend",

		                    "fields": {
		                        "firstName": {
		                            "type": "String",
		                            "keyRaw": "firstName"
		                        },

		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id"
		                        }
		                    },

		                    "operations": [{
		                        "action": "insert",
		                        "list": "All_Users",
		                        "position": "first",

		                        "parentID": {
		                            "kind": "String",
		                            "value": "1234"
		                        }
		                    }]
		                }
		            }
		        }
		    }
		};
	`)
	})

	test('parentID - append', async function () {
		const mutationDocs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @append(parentID: "1234")
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, mutationDocs)

		// load the contents of the file
		const queryContents = await fs.readFile(
			path.join(config.artifactPath(mutationDocs[0].document)),
			'utf-8'
		)
		expect(queryContents).toBeTruthy()
		// parse the contents
		const parsedQuery: ProgramKind = recast.parse(queryContents, {
			parser: typeScriptParser,
		}).program
		// verify contents
		expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "A",
		    kind: "HoudiniMutation",

		    raw: \`mutation A {
		  addFriend {
		    friend {
		      ...All_Users_insert
		      id
		    }
		  }
		}

		fragment All_Users_insert on User {
		  firstName
		  id
		}
		\`,

		    rootType: "Mutation",

		    selection: {
		        "addFriend": {
		            "type": "AddFriendOutput",
		            "keyRaw": "addFriend",

		            "fields": {
		                "friend": {
		                    "type": "User",
		                    "keyRaw": "friend",

		                    "fields": {
		                        "firstName": {
		                            "type": "String",
		                            "keyRaw": "firstName"
		                        },

		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id"
		                        }
		                    },

		                    "operations": [{
		                        "action": "insert",
		                        "list": "All_Users",
		                        "position": "last",

		                        "parentID": {
		                            "kind": "String",
		                            "value": "1234"
		                        }
		                    }]
		                }
		            }
		        }
		    }
		};
	`)
	})

	test('parentID - parentID directive', async function () {
		const mutationDocs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @parentID(value: "1234")
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, mutationDocs)

		// load the contents of the file
		const queryContents = await fs.readFile(
			path.join(config.artifactPath(mutationDocs[0].document)),
			'utf-8'
		)
		expect(queryContents).toBeTruthy()
		// parse the contents
		const parsedQuery: ProgramKind = recast.parse(queryContents, {
			parser: typeScriptParser,
		}).program
		// verify contents
		expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "A",
		    kind: "HoudiniMutation",

		    raw: \`mutation A {
		  addFriend {
		    friend {
		      ...All_Users_insert
		      id
		    }
		  }
		}

		fragment All_Users_insert on User {
		  firstName
		  id
		}
		\`,

		    rootType: "Mutation",

		    selection: {
		        "addFriend": {
		            "type": "AddFriendOutput",
		            "keyRaw": "addFriend",

		            "fields": {
		                "friend": {
		                    "type": "User",
		                    "keyRaw": "friend",

		                    "fields": {
		                        "firstName": {
		                            "type": "String",
		                            "keyRaw": "firstName"
		                        },

		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id"
		                        }
		                    },

		                    "operations": [{
		                        "action": "insert",
		                        "list": "All_Users",
		                        "position": "last",

		                        "parentID": {
		                            "kind": "String",
		                            "value": "1234"
		                        }
		                    }]
		                }
		            }
		        }
		    }
		};
	`)
	})

	test('must - prepend', async function () {
		const mutationDocs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @prepend(when: { argument: "stringValue", value: "foo" })
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, mutationDocs)

		// load the contents of the file
		const queryContents = await fs.readFile(
			path.join(config.artifactPath(mutationDocs[0].document)),
			'utf-8'
		)
		expect(queryContents).toBeTruthy()
		// parse the contents
		const parsedQuery: ProgramKind = recast.parse(queryContents, {
			parser: typeScriptParser,
		}).program
		// verify contents
		expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "A",
		    kind: "HoudiniMutation",

		    raw: \`mutation A {
		  addFriend {
		    friend {
		      ...All_Users_insert
		      id
		    }
		  }
		}

		fragment All_Users_insert on User {
		  firstName
		  id
		}
		\`,

		    rootType: "Mutation",

		    selection: {
		        "addFriend": {
		            "type": "AddFriendOutput",
		            "keyRaw": "addFriend",

		            "fields": {
		                "friend": {
		                    "type": "User",
		                    "keyRaw": "friend",

		                    "fields": {
		                        "firstName": {
		                            "type": "String",
		                            "keyRaw": "firstName"
		                        },

		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id"
		                        }
		                    },

		                    "operations": [{
		                        "action": "insert",
		                        "list": "All_Users",
		                        "position": "first",

		                        "when": {
		                            "must": {
		                                "stringValue": "foo"
		                            }
		                        }
		                    }]
		                }
		            }
		        }
		    }
		};
	`)
	})

	test('must - append', async function () {
		const mutationDocs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @append(when: { argument: "stringValue", value: "true" })
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, mutationDocs)

		// load the contents of the file
		const queryContents = await fs.readFile(
			path.join(config.artifactPath(mutationDocs[0].document)),
			'utf-8'
		)
		expect(queryContents).toBeTruthy()
		// parse the contents
		const parsedQuery: ProgramKind = recast.parse(queryContents, {
			parser: typeScriptParser,
		}).program
		// verify contents
		expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "A",
		    kind: "HoudiniMutation",

		    raw: \`mutation A {
		  addFriend {
		    friend {
		      ...All_Users_insert
		      id
		    }
		  }
		}

		fragment All_Users_insert on User {
		  firstName
		  id
		}
		\`,

		    rootType: "Mutation",

		    selection: {
		        "addFriend": {
		            "type": "AddFriendOutput",
		            "keyRaw": "addFriend",

		            "fields": {
		                "friend": {
		                    "type": "User",
		                    "keyRaw": "friend",

		                    "fields": {
		                        "firstName": {
		                            "type": "String",
		                            "keyRaw": "firstName"
		                        },

		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id"
		                        }
		                    },

		                    "operations": [{
		                        "action": "insert",
		                        "list": "All_Users",
		                        "position": "last",

		                        "when": {
		                            "must": {
		                                "stringValue": "true"
		                            }
		                        }
		                    }]
		                }
		            }
		        }
		    }
		};
	`)
	})

	test('must - directive', async function () {
		const mutationDocs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @when(argument: "stringValue", value: "true")
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, mutationDocs)

		// load the contents of the file
		const queryContents = await fs.readFile(
			path.join(config.artifactPath(mutationDocs[0].document)),
			'utf-8'
		)
		expect(queryContents).toBeTruthy()
		// parse the contents
		const parsedQuery: ProgramKind = recast.parse(queryContents, {
			parser: typeScriptParser,
		}).program
		// verify contents
		expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "A",
		    kind: "HoudiniMutation",

		    raw: \`mutation A {
		  addFriend {
		    friend {
		      ...All_Users_insert
		      id
		    }
		  }
		}

		fragment All_Users_insert on User {
		  firstName
		  id
		}
		\`,

		    rootType: "Mutation",

		    selection: {
		        "addFriend": {
		            "type": "AddFriendOutput",
		            "keyRaw": "addFriend",

		            "fields": {
		                "friend": {
		                    "type": "User",
		                    "keyRaw": "friend",

		                    "fields": {
		                        "firstName": {
		                            "type": "String",
		                            "keyRaw": "firstName"
		                        },

		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id"
		                        }
		                    },

		                    "operations": [{
		                        "action": "insert",
		                        "list": "All_Users",
		                        "position": "last",

		                        "when": {
		                            "must": {
		                                "stringValue": "true"
		                            }
		                        }
		                    }]
		                }
		            }
		        }
		    }
		};
	`)
	})

	test('must_not - prepend', async function () {
		const mutationDocs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @prepend(when_not: { argument: "stringValue", value: "true" })
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, mutationDocs)

		// load the contents of the file
		const queryContents = await fs.readFile(
			path.join(config.artifactPath(mutationDocs[0].document)),
			'utf-8'
		)
		expect(queryContents).toBeTruthy()
		// parse the contents
		const parsedQuery: ProgramKind = recast.parse(queryContents, {
			parser: typeScriptParser,
		}).program
		// verify contents
		expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "A",
		    kind: "HoudiniMutation",

		    raw: \`mutation A {
		  addFriend {
		    friend {
		      ...All_Users_insert
		      id
		    }
		  }
		}

		fragment All_Users_insert on User {
		  firstName
		  id
		}
		\`,

		    rootType: "Mutation",

		    selection: {
		        "addFriend": {
		            "type": "AddFriendOutput",
		            "keyRaw": "addFriend",

		            "fields": {
		                "friend": {
		                    "type": "User",
		                    "keyRaw": "friend",

		                    "fields": {
		                        "firstName": {
		                            "type": "String",
		                            "keyRaw": "firstName"
		                        },

		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id"
		                        }
		                    },

		                    "operations": [{
		                        "action": "insert",
		                        "list": "All_Users",
		                        "position": "first",

		                        "when": {
		                            "must_not": {
		                                "stringValue": "true"
		                            }
		                        }
		                    }]
		                }
		            }
		        }
		    }
		};
	`)
	})

	test('must_not - append', async function () {
		const mutationDocs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @append(when_not: { argument: "stringValue", value: "true" })
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, mutationDocs)

		// load the contents of the file
		const queryContents = await fs.readFile(
			path.join(config.artifactPath(mutationDocs[0].document)),
			'utf-8'
		)
		expect(queryContents).toBeTruthy()
		// parse the contents
		const parsedQuery: ProgramKind = recast.parse(queryContents, {
			parser: typeScriptParser,
		}).program
		// verify contents
		expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "A",
		    kind: "HoudiniMutation",

		    raw: \`mutation A {
		  addFriend {
		    friend {
		      ...All_Users_insert
		      id
		    }
		  }
		}

		fragment All_Users_insert on User {
		  firstName
		  id
		}
		\`,

		    rootType: "Mutation",

		    selection: {
		        "addFriend": {
		            "type": "AddFriendOutput",
		            "keyRaw": "addFriend",

		            "fields": {
		                "friend": {
		                    "type": "User",
		                    "keyRaw": "friend",

		                    "fields": {
		                        "firstName": {
		                            "type": "String",
		                            "keyRaw": "firstName"
		                        },

		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id"
		                        }
		                    },

		                    "operations": [{
		                        "action": "insert",
		                        "list": "All_Users",
		                        "position": "last",

		                        "when": {
		                            "must_not": {
		                                "stringValue": "true"
		                            }
		                        }
		                    }]
		                }
		            }
		        }
		    }
		};
	`)
	})

	test('list filters', async function () {
		const mutationDocs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @when_not(argument: "boolValue", value: "true")
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery($value: String!) {
					users(
						stringValue: $value,
						boolValue: true,
						floatValue: 1.2,
						intValue: 1,
					) @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, mutationDocs)

		// load the contents of the file
		const queryContents = await fs.readFile(
			path.join(config.artifactPath(mutationDocs[1].document)),
			'utf-8'
		)
		expect(queryContents).toBeTruthy()
		// parse the contents
		const parsedQuery: ProgramKind = recast.parse(queryContents, {
			parser: typeScriptParser,
		}).program
		// verify contents
		expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "TestQuery",
		    kind: "HoudiniQuery",

		    raw: \`query TestQuery($value: String!) {
		  users(stringValue: $value, boolValue: true, floatValue: 1.2, intValue: 1) {
		    firstName
		    id
		  }
		}
		\`,

		    rootType: "Query",

		    selection: {
		        "users": {
		            "type": "User",
		            "keyRaw": "users(stringValue: $value, boolValue: true, floatValue: 1.2, intValue: 1)",

		            "fields": {
		                "firstName": {
		                    "type": "String",
		                    "keyRaw": "firstName"
		                },

		                "id": {
		                    "type": "ID",
		                    "keyRaw": "id"
		                }
		            },

		            "list": "All_Users",

		            "filters": {
		                "stringValue": {
		                    "kind": "Variable",
		                    "value": "value"
		                },

		                "boolValue": {
		                    "kind": "Boolean",
		                    "value": true
		                },

		                "floatValue": {
		                    "kind": "Float",
		                    "value": 1.2
		                },

		                "intValue": {
		                    "kind": "Int",
		                    "value": 1
		                }
		            }
		        }
		    },

		    input: {
		        "fields": {
		            "value": "String"
		        },

		        "types": {}
		    }
		};
	`)
	})

	test('must_not - directive', async function () {
		const mutationDocs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @when_not(argument: "boolValue", value: "true")
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo", boolValue:true) @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, mutationDocs)

		// load the contents of the file
		const queryContents = await fs.readFile(
			path.join(config.artifactPath(mutationDocs[0].document)),
			'utf-8'
		)
		expect(queryContents).toBeTruthy()
		// parse the contents
		const parsedQuery: ProgramKind = recast.parse(queryContents, {
			parser: typeScriptParser,
		}).program
		// verify contents
		expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "A",
		    kind: "HoudiniMutation",

		    raw: \`mutation A {
		  addFriend {
		    friend {
		      ...All_Users_insert
		      id
		    }
		  }
		}

		fragment All_Users_insert on User {
		  firstName
		  id
		}
		\`,

		    rootType: "Mutation",

		    selection: {
		        "addFriend": {
		            "type": "AddFriendOutput",
		            "keyRaw": "addFriend",

		            "fields": {
		                "friend": {
		                    "type": "User",
		                    "keyRaw": "friend",

		                    "fields": {
		                        "firstName": {
		                            "type": "String",
		                            "keyRaw": "firstName"
		                        },

		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id"
		                        }
		                    },

		                    "operations": [{
		                        "action": "insert",
		                        "list": "All_Users",
		                        "position": "last",

		                        "when": {
		                            "must_not": {
		                                "boolValue": true
		                            }
		                        }
		                    }]
		                }
		            }
		        }
		    }
		};
	`)
	})

	test('tracks list name', async function () {
		const mutationDocs = [
			mockCollectedDoc(
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @prepend(parentID: "1234")
						}
					}
				}`
			),
			mockCollectedDoc(
				`query TestQuery {
					users(stringValue: "foo") @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, mutationDocs)

		// load the contents of the file
		const queryContents = await fs.readFile(
			path.join(config.artifactPath(mutationDocs[1].document)),
			'utf-8'
		)
		expect(queryContents).toBeTruthy()
		// parse the contents
		const parsedQuery: ProgramKind = recast.parse(queryContents, {
			parser: typeScriptParser,
		}).program
		// verify contents
		expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "TestQuery",
		    kind: "HoudiniQuery",

		    raw: \`query TestQuery {
		  users(stringValue: "foo") {
		    firstName
		    id
		  }
		}
		\`,

		    rootType: "Query",

		    selection: {
		        "users": {
		            "type": "User",
		            "keyRaw": "users(stringValue: \\"foo\\")",

		            "fields": {
		                "firstName": {
		                    "type": "String",
		                    "keyRaw": "firstName"
		                },

		                "id": {
		                    "type": "ID",
		                    "keyRaw": "id"
		                }
		            },

		            "list": "All_Users",

		            "filters": {
		                "stringValue": {
		                    "kind": "String",
		                    "value": "foo"
		                }
		            }
		        }
		    }
		};
	`)
	})

	test('field args', async function () {
		const mutationDocs = [
			mockCollectedDoc(
				`query TestQuery($value: String!) {
					users(
						stringValue: $value,
						boolValue: true,
						floatValue: 1.2,
						intValue: 1,
					) @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, mutationDocs)

		// load the contents of the file
		const queryContents = await fs.readFile(
			path.join(config.artifactPath(mutationDocs[0].document)),
			'utf-8'
		)
		expect(queryContents).toBeTruthy()
		// parse the contents
		const parsedQuery: ProgramKind = recast.parse(queryContents, {
			parser: typeScriptParser,
		}).program
		// verify contents
		expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "TestQuery",
		    kind: "HoudiniQuery",

		    raw: \`query TestQuery($value: String!) {
		  users(stringValue: $value, boolValue: true, floatValue: 1.2, intValue: 1) {
		    firstName
		    id
		  }
		}
		\`,

		    rootType: "Query",

		    selection: {
		        "users": {
		            "type": "User",
		            "keyRaw": "users(stringValue: $value, boolValue: true, floatValue: 1.2, intValue: 1)",

		            "fields": {
		                "firstName": {
		                    "type": "String",
		                    "keyRaw": "firstName"
		                },

		                "id": {
		                    "type": "ID",
		                    "keyRaw": "id"
		                }
		            },

		            "list": "All_Users",

		            "filters": {
		                "stringValue": {
		                    "kind": "Variable",
		                    "value": "value"
		                },

		                "boolValue": {
		                    "kind": "Boolean",
		                    "value": true
		                },

		                "floatValue": {
		                    "kind": "Float",
		                    "value": 1.2
		                },

		                "intValue": {
		                    "kind": "Int",
		                    "value": 1
		                }
		            }
		        }
		    },

		    input: {
		        "fields": {
		            "value": "String"
		        },

		        "types": {}
		    }
		};
	`)
	})

	test('sveltekit', async function () {
		const cfg = testConfig({ mode: 'kit' })

		const mutationDocs = [
			mockCollectedDoc(
				`query TestQuery($value: String!) {
					users(
						stringValue: $value,
						boolValue: true,
						floatValue: 1.2,
						intValue: 1,
					) @list(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(cfg, mutationDocs)

		// load the contents of the file
		const queryContents = await fs.readFile(
			path.join(cfg.artifactPath(mutationDocs[0].document)),
			'utf-8'
		)
		expect(queryContents).toBeTruthy()
		// parse the contents
		const parsedQuery: ProgramKind = recast.parse(queryContents, {
			parser: typeScriptParser,
		}).program
		// verify contents
		expect(parsedQuery).toMatchInlineSnapshot(`
		export default {
		    name: "TestQuery",
		    kind: "HoudiniQuery",

		    raw: \`query TestQuery($value: String!) {
		  users(stringValue: $value, boolValue: true, floatValue: 1.2, intValue: 1) {
		    firstName
		    id
		  }
		}
		\`,

		    rootType: "Query",

		    selection: {
		        "users": {
		            "type": "User",
		            "keyRaw": "users(stringValue: $value, boolValue: true, floatValue: 1.2, intValue: 1)",

		            "fields": {
		                "firstName": {
		                    "type": "String",
		                    "keyRaw": "firstName"
		                },

		                "id": {
		                    "type": "ID",
		                    "keyRaw": "id"
		                }
		            },

		            "list": "All_Users",

		            "filters": {
		                "stringValue": {
		                    "kind": "Variable",
		                    "value": "value"
		                },

		                "boolValue": {
		                    "kind": "Boolean",
		                    "value": true
		                },

		                "floatValue": {
		                    "kind": "Float",
		                    "value": 1.2
		                },

		                "intValue": {
		                    "kind": "Int",
		                    "value": 1
		                }
		            }
		        }
		    },

		    input: {
		        "fields": {
		            "value": "String"
		        },

		        "types": {}
		    }
		};
	`)
	})
})

test('custom scalar shows up in artifact', async function () {
	// define a config with a custom scalar
	const localConfig = testConfig({
		schema: `
			scalar DateTime
			type TodoItem {
				text: String!
				createdAt: DateTime!
			}
			type Query {
				allItems: [TodoItem!]!
			}
		`,
		scalars: {
			DateTime: {
				type: 'Date',
				unmarshal(val: number): Date {
					return new Date(val)
				},
				marshal(date: Date): number {
					return date.getTime()
				},
			},
		},
	})

	// execute the generator
	await runPipeline(localConfig, [mockCollectedDoc(`query TestQuery { allItems { createdAt } }`)])

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(config.artifactPath(docs[0].document)),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "TestQuery",
		    kind: "HoudiniQuery",

		    raw: \`query TestQuery {
		  allItems {
		    createdAt
		  }
		}
		\`,

		    rootType: "Query",

		    selection: {
		        "allItems": {
		            "type": "TodoItem",
		            "keyRaw": "allItems",

		            "fields": {
		                "createdAt": {
		                    "type": "DateTime",
		                    "keyRaw": "createdAt"
		                }
		            }
		        }
		    }
		};
	`)
})

test('operation inputs', async function () {
	// the config to use in tests
	const localConfig = testConfig({
		schema: `
		enum MyEnum {
			Hello
		}

		input UserFilter {
			middle: NestedUserFilter
			listRequired: [String!]!
			nullList: [String]
			recursive: UserFilter
			enum: MyEnum
		}

		input NestedUserFilter {
			id: ID!
			firstName: String!
			admin: Boolean
			age: Int
			weight: Float
		}

		type User {
			id: ID!
		}

		type Query {
			user(id: ID, filter: UserFilter, filterList: [UserFilter!], enumArg: MyEnum): User
		}
	`,
	})

	// execute the generator
	await runPipeline(localConfig, [
		mockCollectedDoc(
			`
			query TestQuery(
				$id: ID,
				$filter: UserFilter,
				$filterList: [UserFilter!],
				$enumArg: MyEnum
			) {
				user(
					id: $id,
					filter: $filter,
					filterList: $filterList,
					enumArg: $enumArg,
				) {
					id
				}
			}
			`
		),
	])

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(config.artifactPath(docs[0].document)),
		'utf-8'
	)
	expect(queryContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(queryContents, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "TestQuery",
		    kind: "HoudiniQuery",

		    raw: \`query TestQuery($id: ID, $filter: UserFilter, $filterList: [UserFilter!], $enumArg: MyEnum) {
		  user(id: $id, filter: $filter, filterList: $filterList, enumArg: $enumArg) {
		    id
		  }
		}
		\`,

		    rootType: "Query",

		    selection: {
		        "user": {
		            "type": "User",
		            "keyRaw": "user(id: $id, filter: $filter, filterList: $filterList, enumArg: $enumArg)",

		            "fields": {
		                "id": {
		                    "type": "ID",
		                    "keyRaw": "id"
		                }
		            }
		        }
		    },

		    input: {
		        "fields": {
		            "id": "ID",
		            "filter": "UserFilter",
		            "filterList": "UserFilter",
		            "enumArg": "MyEnum"
		        },

		        "types": {
		            "NestedUserFilter": {
		                "id": "ID",
		                "firstName": "String",
		                "admin": "Boolean",
		                "age": "Int",
		                "weight": "Float"
		            },

		            "UserFilter": {
		                "middle": "NestedUserFilter",
		                "listRequired": "String",
		                "nullList": "String",
		                "recursive": "UserFilter",
		                "enum": "MyEnum"
		            }
		        }
		    }
		};
	`)
})

describe('subscription artifacts', function () {
	test('happy path', async function () {
		const mutationDocs = [
			mockCollectedDoc(
				`subscription B {
					newUser {
						user {
							firstName
						}
					}
				}`
			),
		]

		// execute the generator
		await runPipeline(config, mutationDocs)

		// load the contents of the file
		const queryContents = await fs.readFile(
			path.join(config.artifactPath(mutationDocs[0].document)),
			'utf-8'
		)
		expect(queryContents).toBeTruthy()
		// parse the contents
		const parsedQuery: ProgramKind = recast.parse(queryContents, {
			parser: typeScriptParser,
		}).program
		// verify contents
		expect(parsedQuery).toMatchInlineSnapshot(`
		module.exports = {
		    name: "B",
		    kind: "HoudiniSubscription",

		    raw: \`subscription B {
		  newUser {
		    user {
		      firstName
		      id
		    }
		  }
		}
		\`,

		    rootType: "Subscription",

		    selection: {
		        "newUser": {
		            "type": "NewUserResult",
		            "keyRaw": "newUser",

		            "fields": {
		                "user": {
		                    "type": "User",
		                    "keyRaw": "user",

		                    "fields": {
		                        "firstName": {
		                            "type": "String",
		                            "keyRaw": "firstName"
		                        },

		                        "id": {
		                            "type": "ID",
		                            "keyRaw": "id"
		                        }
		                    }
		                }
		            }
		        }
		    }
		};
	`)
	})
})
