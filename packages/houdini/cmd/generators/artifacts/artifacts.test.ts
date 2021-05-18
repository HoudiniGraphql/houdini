// external imports
import path from 'path'
import { testConfig } from 'houdini-common'
import fs from 'fs/promises'
import * as typeScriptParser from 'recast/parsers/typescript'
import { ProgramKind } from 'ast-types/gen/kinds'
import * as recast from 'recast'
// local imports
import '../../../../../jest.setup.cjs'
import { runPipeline } from '../../compile'
import { CollectedGraphQLDocument } from '../../types'
import { mockCollectedDoc } from '../../testUtils'

// the config to use in tests
const config = testConfig()

// the documents to test
const docs: CollectedGraphQLDocument[] = [
	mockCollectedDoc('TestQuery', `query TestQuery { version }`),
	mockCollectedDoc('TestFragment', `fragment TestFragment on User { firstName }`),
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
		    hash: "41ec892821ed25278cbbaf2c4d434205",

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
		    hash: "a77288e39dcdadb70e4010b543c89c6a",

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
		mockCollectedDoc('TestQuery', `query TestQuery { user { ...TestFragment } }`),
		mockCollectedDoc('TestFragment', `fragment TestFragment on User { firstName }`),
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
		    hash: "8662e6b2267b8667e81533ecbb73dd23",

		    raw: \`query TestQuery {
		  user {
		    ...TestFragment
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
		    hash: "a77288e39dcdadb70e4010b543c89c6a",

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
		mockCollectedDoc('Fragment', `fragment A on User { firstName }`),
		mockCollectedDoc('TestQuery', `query TestQuery { user { ...A @prepend } }`),
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
		    hash: "f4887b164296c8e6be4c4461520a7f99",

		    raw: \`query TestQuery {
		  user {
		    ...A
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
		mockCollectedDoc('Fragment', `fragment A on User { firstName }`),
		mockCollectedDoc('TestQuery', `query TestQuery { user { firstName ...A @prepend } }`),
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
		    hash: "3ec890e9ea3a5482628bdaf932551e3c",

		    raw: \`query TestQuery {
		  user {
		    firstName
		    ...A
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
		mockCollectedDoc('Fragment', `fragment A on User { friends { id } }`),
		mockCollectedDoc(
			'TestQuery',
			`query TestQuery { user { friends { firstName } ...A @prepend } }`
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
		    hash: "d99668cf016f0e99335dce103bd6ccfd",

		    raw: \`query TestQuery {
		  user {
		    friends {
		      firstName
		    }
		    ...A
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
		                }
		            }
		        }
		    }
		};
	`)
})

describe('mutation artifacts', function () {
	test('empty operation list', async function () {
		const mutationDocs = [
			mockCollectedDoc(
				'Mutation B',
				`mutation B {
					addFriend {
						friend {
							firstName
						}
					}
				}`
			),
			mockCollectedDoc(
				'TestQuery',
				`query TestQuery {
					users(stringValue: "foo") @connection(name: "All_Users") {
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
		    name: "Mutation B",
		    kind: "HoudiniMutation",
		    hash: "e9f6440182fec6d7a6d505710f13786e",

		    raw: \`mutation B {
		  addFriend {
		    friend {
		      firstName
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
				'Mutation A',
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert
						}
					}
				}`
			),
			mockCollectedDoc(
				'TestQuery',
				`query TestQuery {
					users(stringValue: "foo") @connection(name: "All_Users") {
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
		    name: "Mutation A",
		    kind: "HoudiniMutation",
		    hash: "8b0662945dc40367f151352db91956d9",

		    raw: \`mutation A {
		  addFriend {
		    friend {
		      ...All_Users_insert
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
		                        "connection": "All_Users",
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
				'Mutation A',
				`mutation A {
					addFriend {
						friend {
							...All_Users_remove
						}
					}
				}`
			),
			mockCollectedDoc(
				'TestQuery',
				`query TestQuery {
					users(stringValue: "foo") @connection(name: "All_Users") {
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
		    name: "Mutation A",
		    kind: "HoudiniMutation",
		    hash: "1c16742ee77c99369985c0eb3977bb51",

		    raw: \`mutation A {
		  addFriend {
		    friend {
		      ...All_Users_remove
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
		                        "connection": "All_Users"
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
				'Mutation A',
				`mutation A {
					deleteUser(id: "1234") {
						userID @User_delete
					}
				}`
			),
			mockCollectedDoc(
				'TestQuery',
				`query TestQuery {
					users(stringValue: "foo") @connection(name: "All_Users") {
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
		    name: "Mutation A",
		    kind: "HoudiniMutation",
		    hash: "93b6b6a347ea5d70f4a0eec5aa3bcad6",

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
				'Mutation A',
				`mutation A {
					deleteUser(id: "1234") {
						userID @User_delete @when(argument: "stringValue", value: "foo")
					}
				}`
			),
			mockCollectedDoc(
				'TestQuery',
				`query TestQuery {
					users(stringValue: "foo") @connection(name: "All_Users") {
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
		    name: "Mutation A",
		    kind: "HoudiniMutation",
		    hash: "7c841bbbbd206c7c2e40bc683b173294",

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
				'Mutation A',
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @prepend(parentID: "1234")
						}
					}
				}`
			),
			mockCollectedDoc(
				'TestQuery',
				`query TestQuery {
					users(stringValue: "foo") @connection(name: "All_Users") {
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
		    name: "Mutation A",
		    kind: "HoudiniMutation",
		    hash: "661e8ea6aef15a9dc54d9a75e6e7b181",

		    raw: \`mutation A {
		  addFriend {
		    friend {
		      ...All_Users_insert
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
		                        "connection": "All_Users",
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
				'Mutation A',
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @append(parentID: "1234")
						}
					}
				}`
			),
			mockCollectedDoc(
				'TestQuery',
				`query TestQuery {
					users(stringValue: "foo") @connection(name: "All_Users") {
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
		    name: "Mutation A",
		    kind: "HoudiniMutation",
		    hash: "542ad5bd1546c881cd681f11f00681b9",

		    raw: \`mutation A {
		  addFriend {
		    friend {
		      ...All_Users_insert
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
		                        "connection": "All_Users",
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
				'Mutation A',
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @parentID(value: "1234")
						}
					}
				}`
			),
			mockCollectedDoc(
				'TestQuery',
				`query TestQuery {
					users(stringValue: "foo") @connection(name: "All_Users") {
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
		    name: "Mutation A",
		    kind: "HoudiniMutation",
		    hash: "86320c3ec367b754e394444499e08955",

		    raw: \`mutation A {
		  addFriend {
		    friend {
		      ...All_Users_insert
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
		                        "connection": "All_Users",
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
				'Mutation A',
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @prepend(when: { argument: "stringValue", value: "foo" })
						}
					}
				}`
			),
			mockCollectedDoc(
				'TestQuery',
				`query TestQuery {
					users(stringValue: "foo") @connection(name: "All_Users") {
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
		    name: "Mutation A",
		    kind: "HoudiniMutation",
		    hash: "aca7e0bd918f4c47a73b6e7f58f550cc",

		    raw: \`mutation A {
		  addFriend {
		    friend {
		      ...All_Users_insert
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
		                        "connection": "All_Users",
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
				'Mutation A',
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @append(when: { argument: "stringValue", value: "true" })
						}
					}
				}`
			),
			mockCollectedDoc(
				'TestQuery',
				`query TestQuery {
					users(stringValue: "foo") @connection(name: "All_Users") {
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
		    name: "Mutation A",
		    kind: "HoudiniMutation",
		    hash: "bbb139f4dbff5e14ac8fbf686c5f0361",

		    raw: \`mutation A {
		  addFriend {
		    friend {
		      ...All_Users_insert
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
		                        "connection": "All_Users",
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
				'Mutation A',
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @when(argument: "stringValue", value: "true")
						}
					}
				}`
			),
			mockCollectedDoc(
				'TestQuery',
				`query TestQuery {
					users(stringValue: "foo") @connection(name: "All_Users") {
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
		    name: "Mutation A",
		    kind: "HoudiniMutation",
		    hash: "b143d50e839463c0ec641cadd67f2c5b",

		    raw: \`mutation A {
		  addFriend {
		    friend {
		      ...All_Users_insert
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
		                        "connection": "All_Users",
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
				'Mutation A',
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @prepend(when_not: { argument: "stringValue", value: "true" })
						}
					}
				}`
			),
			mockCollectedDoc(
				'TestQuery',
				`query TestQuery {
					users(stringValue: "foo") @connection(name: "All_Users") {
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
		    name: "Mutation A",
		    kind: "HoudiniMutation",
		    hash: "d99dd22eb6d5cabf74c839e786ad6017",

		    raw: \`mutation A {
		  addFriend {
		    friend {
		      ...All_Users_insert
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
		                        "connection": "All_Users",
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
				'Mutation A',
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @append(when_not: { argument: "stringValue", value: "true" })
						}
					}
				}`
			),
			mockCollectedDoc(
				'TestQuery',
				`query TestQuery {
					users(stringValue: "foo") @connection(name: "All_Users") {
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
		    name: "Mutation A",
		    kind: "HoudiniMutation",
		    hash: "a85f3dd007201c1cf851405358b13505",

		    raw: \`mutation A {
		  addFriend {
		    friend {
		      ...All_Users_insert
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
		                        "connection": "All_Users",
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

	test('connection filters', async function () {
		const mutationDocs = [
			mockCollectedDoc(
				'Mutation A',
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @when_not(argument: "boolValue", value: "true")
						}
					}
				}`
			),
			mockCollectedDoc(
				'TestQuery',
				`query TestQuery($value: String!) {
					users(
						stringValue: $value,
						boolValue: true,
						floatValue: 1.2,
						intValue: 1,
					) @connection(name: "All_Users") {
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
		    hash: "24f50fa3efd06490701180759984ddbb",

		    raw: \`query TestQuery($value: String!) {
		  users(stringValue: $value, boolValue: true, floatValue: 1.2, intValue: 1) {
		    firstName
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
		                }
		            },

		            "connection": "All_Users",

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
		    }
		};
	`)
	})

	test('must_not - directive', async function () {
		const mutationDocs = [
			mockCollectedDoc(
				'Mutation A',
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @when_not(argument: "boolValue", value: "true")
						}
					}
				}`
			),
			mockCollectedDoc(
				'TestQuery',
				`query TestQuery {
					users(stringValue: "foo", boolValue:true) @connection(name: "All_Users") {
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
		    name: "Mutation A",
		    kind: "HoudiniMutation",
		    hash: "7bcbb707250eccabf4fecb1b8976889c",

		    raw: \`mutation A {
		  addFriend {
		    friend {
		      ...All_Users_insert
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
		                        "connection": "All_Users",
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

	test('tracks connection name', async function () {
		const mutationDocs = [
			mockCollectedDoc(
				'Mutation A',
				`mutation A {
					addFriend {
						friend {
							...All_Users_insert @prepend(parentID: "1234")
						}
					}
				}`
			),
			mockCollectedDoc(
				'TestQuery',
				`query TestQuery {
					users(stringValue: "foo") @connection(name: "All_Users") {
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
		    hash: "214e4de1395c8620738a3c53619e73bd",

		    raw: \`query TestQuery {
		  users(stringValue: "foo") {
		    firstName
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
		                }
		            },

		            "connection": "All_Users",

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
				'TestQuery',
				`query TestQuery($value: String!) {
					users(
						stringValue: $value,
						boolValue: true,
						floatValue: 1.2,
						intValue: 1,
					) @connection(name: "All_Users") {
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
		    hash: "24f50fa3efd06490701180759984ddbb",

		    raw: \`query TestQuery($value: String!) {
		  users(stringValue: $value, boolValue: true, floatValue: 1.2, intValue: 1) {
		    firstName
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
		                }
		            },

		            "connection": "All_Users",

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
		    }
		};
	`)
	})

	test('sveltekit', async function () {
		const mutationDocs = [
			mockCollectedDoc(
				'TestQuery',
				`query TestQuery($value: String!) {
					users(
						stringValue: $value,
						boolValue: true,
						floatValue: 1.2,
						intValue: 1,
					) @connection(name: "All_Users") {
						firstName
					}
				}`
			),
		]

		// execute the generator
		config.mode = 'kit'
		await runPipeline(config, mutationDocs)
		config.mode = 'sapper'

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
		export default {
		    name: "TestQuery",
		    kind: "HoudiniQuery",
		    hash: "24f50fa3efd06490701180759984ddbb",

		    raw: \`query TestQuery($value: String!) {
		  users(stringValue: $value, boolValue: true, floatValue: 1.2, intValue: 1) {
		    firstName
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
		                }
		            },

		            "connection": "All_Users",

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
		    }
		};
	`)
	})
})

describe('subscription artifacts', function () {
	test('happy path', async function () {
		const mutationDocs = [
			mockCollectedDoc(
				'Subscription B',
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
		    name: "Subscription B",
		    kind: "HoudiniSubscription",
		    hash: "5b9fd19fce6b2a025d3d7e4a1b2a61c0",

		    raw: \`subscription B {
		  newUser {
		    user {
		      firstName
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
