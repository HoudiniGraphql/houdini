// external imports
import path from 'path'
import { testConfig } from 'houdini-common'
import * as graphql from 'graphql'
import fs from 'fs/promises'
import * as typeScriptParser from 'recast/parsers/typescript'
import { ProgramKind } from 'ast-types/gen/kinds'
import * as recast from 'recast'
// local imports
import '../../../../jest.setup'
import { runPipeline } from '../compile'
import { CollectedGraphQLDocument } from '../types'
import { mockCollectedDoc } from '../testUtils'

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

	//
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
		module.exports.name = "TestQuery";
		module.exports.kind = "HoudiniQuery";
		module.exports.hash = "41ec892821ed25278cbbaf2c4d434205";

		module.exports.raw = \`query TestQuery {
		  version
		}
		\`;

		module.exports.rootType = "Query";

		module.exports.selection = {
		    "version": {
		        "type": "Int",
		        "keyRaw": "version"
		    }
		};

		module.exports.response = {
		    "version": {
		        "type": "Int",
		        "keyRaw": "version"
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
		module.exports.name = "TestFragment";
		module.exports.kind = "HoudiniFragment";
		module.exports.hash = "a77288e39dcdadb70e4010b543c89c6a";

		module.exports.raw = \`fragment TestFragment on User {
		  firstName
		}
		\`;

		module.exports.rootType = "User";

		module.exports.selection = {
		    "firstName": {
		        "type": "String",
		        "keyRaw": "firstName"
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
		module.exports.name = "TestQuery";
		module.exports.kind = "HoudiniQuery";
		module.exports.hash = "f4887b164296c8e6be4c4461520a7f99";

		module.exports.raw = \`query TestQuery {
		  user {
		    ...A
		  }
		}

		fragment A on User {
		  firstName
		}
		\`;

		module.exports.rootType = "Query";

		module.exports.selection = {
		    "user": {
		        "type": "User",
		        "keyRaw": "user"
		    }
		};

		module.exports.response = {
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
		module.exports.name = "TestQuery";
		module.exports.kind = "HoudiniQuery";
		module.exports.hash = "3ec890e9ea3a5482628bdaf932551e3c";

		module.exports.raw = \`query TestQuery {
		  user {
		    firstName
		    ...A
		  }
		}

		fragment A on User {
		  firstName
		}
		\`;

		module.exports.rootType = "Query";

		module.exports.selection = {
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
		};

		module.exports.response = {
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
		module.exports.name = "TestQuery";
		module.exports.kind = "HoudiniQuery";
		module.exports.hash = "d99668cf016f0e99335dce103bd6ccfd";

		module.exports.raw = \`query TestQuery {
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
		\`;

		module.exports.rootType = "Query";

		module.exports.selection = {
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
		                    }
		                }
		            }
		        }
		    }
		};

		module.exports.response = {
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
		module.exports.name = "Mutation B";
		module.exports.kind = "HoudiniMutation";
		module.exports.hash = "0787170232c25410f1fb16804ac92fc2";

		module.exports.raw = \`mutation B {
		  addFriend {
		    friend {
		      firstName
		    }
		  }
		}
		\`;

		module.exports.rootType = "Mutation";

		module.exports.selection = {
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
		};

		module.exports.response = {
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
		module.exports.name = "Mutation A";
		module.exports.kind = "HoudiniMutation";
		module.exports.hash = "473d90402922a8cce8e90d53d1060222";

		module.exports.raw = \`mutation A {
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
		\`;

		module.exports.rootType = "Mutation";

		module.exports.selection = {
		    "addFriend": {
		        "type": "AddFriendOutput",
		        "keyRaw": "addFriend",

		        "fields": {
		            "friend": {
		                "type": "User",
		                "keyRaw": "friend",

		                "operations": [{
		                    "action": "insert",
		                    "connection": "All_Users",
		                    "position": "last"
		                }]
		            }
		        }
		    }
		};

		module.exports.response = {
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
		module.exports.name = "Mutation A";
		module.exports.kind = "HoudiniMutation";
		module.exports.hash = "880cba22e81ec6142d1dce5f869911a0";

		module.exports.raw = \`mutation A {
		  addFriend {
		    friend {
		      ...All_Users_remove
		    }
		  }
		}

		fragment All_Users_remove on User {
		  id
		}
		\`;

		module.exports.rootType = "Mutation";

		module.exports.selection = {
		    "addFriend": {
		        "type": "AddFriendOutput",
		        "keyRaw": "addFriend",

		        "fields": {
		            "friend": {
		                "type": "User",
		                "keyRaw": "friend",

		                "operations": [{
		                    "action": "remove",
		                    "connection": "All_Users"
		                }]
		            }
		        }
		    }
		};

		module.exports.response = {
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
		module.exports.name = "Mutation A";
		module.exports.kind = "HoudiniMutation";
		module.exports.hash = "136c10c3710d03590c93fbaa6070b23d";

		module.exports.raw = \`mutation A {
		  deleteUser(id: "1234") {
		    userID
		  }
		}
		\`;

		module.exports.rootType = "Mutation";

		module.exports.selection = {
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
		};

		module.exports.response = {
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
		module.exports.name = "Mutation A";
		module.exports.kind = "HoudiniMutation";
		module.exports.hash = "e493f4442d18a3b9a2f0d7e17849afe3";

		module.exports.raw = \`mutation A {
		  deleteUser(id: "1234") {
		    userID
		  }
		}
		\`;

		module.exports.rootType = "Mutation";

		module.exports.selection = {
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
		};

		module.exports.response = {
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
		module.exports.name = "Mutation A";
		module.exports.kind = "HoudiniMutation";
		module.exports.hash = "668ff1dae6a853db970112b94cc7b3f6";

		module.exports.raw = \`mutation A {
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
		\`;

		module.exports.rootType = "Mutation";

		module.exports.selection = {
		    "addFriend": {
		        "type": "AddFriendOutput",
		        "keyRaw": "addFriend",

		        "fields": {
		            "friend": {
		                "type": "User",
		                "keyRaw": "friend",

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
		};

		module.exports.response = {
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
		module.exports.name = "Mutation A";
		module.exports.kind = "HoudiniMutation";
		module.exports.hash = "023533de87e89e1234f9e4f37f05cdc1";

		module.exports.raw = \`mutation A {
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
		\`;

		module.exports.rootType = "Mutation";

		module.exports.selection = {
		    "addFriend": {
		        "type": "AddFriendOutput",
		        "keyRaw": "addFriend",

		        "fields": {
		            "friend": {
		                "type": "User",
		                "keyRaw": "friend",

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
		};

		module.exports.response = {
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
		module.exports.name = "Mutation A";
		module.exports.kind = "HoudiniMutation";
		module.exports.hash = "65685926dbe59762e208efc8f29bf137";

		module.exports.raw = \`mutation A {
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
		\`;

		module.exports.rootType = "Mutation";

		module.exports.selection = {
		    "addFriend": {
		        "type": "AddFriendOutput",
		        "keyRaw": "addFriend",

		        "fields": {
		            "friend": {
		                "type": "User",
		                "keyRaw": "friend",

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
		};

		module.exports.response = {
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
							...All_Users_insert @prepend(when: { argument: "boolValue", value: "true" })
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
		module.exports.name = "Mutation A";
		module.exports.kind = "HoudiniMutation";
		module.exports.hash = "5ced4c4d96cac1354214e620d431efbc";

		module.exports.raw = \`mutation A {
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
		\`;

		module.exports.rootType = "Mutation";

		module.exports.selection = {
		    "addFriend": {
		        "type": "AddFriendOutput",
		        "keyRaw": "addFriend",

		        "fields": {
		            "friend": {
		                "type": "User",
		                "keyRaw": "friend",

		                "operations": [{
		                    "action": "insert",
		                    "connection": "All_Users",
		                    "position": "first",

		                    "when": {
		                        "must": {
		                            "boolValue": "true"
		                        }
		                    }
		                }]
		            }
		        }
		    }
		};

		module.exports.response = {
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
		                            "boolValue": "true"
		                        }
		                    }
		                }]
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
							...All_Users_insert @append(when: { argument: "boolValue", value: "true" })
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
		module.exports.name = "Mutation A";
		module.exports.kind = "HoudiniMutation";
		module.exports.hash = "75f855274f5456a4c8004caf01942c48";

		module.exports.raw = \`mutation A {
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
		\`;

		module.exports.rootType = "Mutation";

		module.exports.selection = {
		    "addFriend": {
		        "type": "AddFriendOutput",
		        "keyRaw": "addFriend",

		        "fields": {
		            "friend": {
		                "type": "User",
		                "keyRaw": "friend",

		                "operations": [{
		                    "action": "insert",
		                    "connection": "All_Users",
		                    "position": "last",

		                    "when": {
		                        "must": {
		                            "boolValue": "true"
		                        }
		                    }
		                }]
		            }
		        }
		    }
		};

		module.exports.response = {
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
		                            "boolValue": "true"
		                        }
		                    }
		                }]
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
							...All_Users_insert @when(argument: "boolValue", value: "true")
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
		module.exports.name = "Mutation A";
		module.exports.kind = "HoudiniMutation";
		module.exports.hash = "3c8dba5b58162f442b994f5b8ea4a86e";

		module.exports.raw = \`mutation A {
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
		\`;

		module.exports.rootType = "Mutation";

		module.exports.selection = {
		    "addFriend": {
		        "type": "AddFriendOutput",
		        "keyRaw": "addFriend",

		        "fields": {
		            "friend": {
		                "type": "User",
		                "keyRaw": "friend",

		                "operations": [{
		                    "action": "insert",
		                    "connection": "All_Users",
		                    "position": "last",

		                    "when": {
		                        "must": {
		                            "boolValue": "true"
		                        }
		                    }
		                }]
		            }
		        }
		    }
		};

		module.exports.response = {
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
		                            "boolValue": "true"
		                        }
		                    }
		                }]
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
							...All_Users_insert @prepend(when_not: { argument: "boolValue", value: "true" })
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
		module.exports.name = "Mutation A";
		module.exports.kind = "HoudiniMutation";
		module.exports.hash = "855ecff81a12f90d28c79cd143e0e1b0";

		module.exports.raw = \`mutation A {
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
		\`;

		module.exports.rootType = "Mutation";

		module.exports.selection = {
		    "addFriend": {
		        "type": "AddFriendOutput",
		        "keyRaw": "addFriend",

		        "fields": {
		            "friend": {
		                "type": "User",
		                "keyRaw": "friend",

		                "operations": [{
		                    "action": "insert",
		                    "connection": "All_Users",
		                    "position": "first",

		                    "when": {
		                        "must_not": {
		                            "boolValue": "true"
		                        }
		                    }
		                }]
		            }
		        }
		    }
		};

		module.exports.response = {
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
		                            "boolValue": "true"
		                        }
		                    }
		                }]
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
							...All_Users_insert @append(when_not: { argument: "boolValue", value: "true" })
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
		module.exports.name = "Mutation A";
		module.exports.kind = "HoudiniMutation";
		module.exports.hash = "56fe5c85d17523318a96c2d78c3db735";

		module.exports.raw = \`mutation A {
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
		\`;

		module.exports.rootType = "Mutation";

		module.exports.selection = {
		    "addFriend": {
		        "type": "AddFriendOutput",
		        "keyRaw": "addFriend",

		        "fields": {
		            "friend": {
		                "type": "User",
		                "keyRaw": "friend",

		                "operations": [{
		                    "action": "insert",
		                    "connection": "All_Users",
		                    "position": "last",

		                    "when": {
		                        "must_not": {
		                            "boolValue": "true"
		                        }
		                    }
		                }]
		            }
		        }
		    }
		};

		module.exports.response = {
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
		                            "boolValue": "true"
		                        }
		                    }
		                }]
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
		module.exports.name = "Mutation A";
		module.exports.kind = "HoudiniMutation";
		module.exports.hash = "1a7aff185b471fe8e2af42b0b3919d0a";

		module.exports.raw = \`mutation A {
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
		\`;

		module.exports.rootType = "Mutation";

		module.exports.selection = {
		    "addFriend": {
		        "type": "AddFriendOutput",
		        "keyRaw": "addFriend",

		        "fields": {
		            "friend": {
		                "type": "User",
		                "keyRaw": "friend",

		                "operations": [{
		                    "action": "insert",
		                    "connection": "All_Users",
		                    "position": "last",

		                    "when": {
		                        "must_not": {
		                            "boolValue": "true"
		                        }
		                    }
		                }]
		            }
		        }
		    }
		};

		module.exports.response = {
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
		                            "boolValue": "true"
		                        }
		                    }
		                }]
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
		module.exports.name = "TestQuery";
		module.exports.kind = "HoudiniQuery";
		module.exports.hash = "2e9999cf0a02b0af68f84249ec50a4cc";

		module.exports.raw = \`query TestQuery {
		  users(stringValue: "foo") {
		    firstName
		  }
		}
		\`;

		module.exports.rootType = "Query";

		module.exports.selection = {
		    "users": {
		        "type": "User",
		        "keyRaw": "users(stringValue: \\"foo\\")",

		        "fields": {
		            "firstName": {
		                "type": "String",
		                "keyRaw": "firstName"
		            }
		        },

		        "connection": "All_Users"
		    }
		};

		module.exports.response = {
		    "users": {
		        "type": "User",
		        "keyRaw": "users(stringValue: \\"foo\\")",

		        "fields": {
		            "firstName": {
		                "type": "String",
		                "keyRaw": "firstName"
		            }
		        },

		        "connection": "All_Users"
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
		module.exports.name = "TestQuery";
		module.exports.kind = "HoudiniQuery";
		module.exports.hash = "77e73a9f844dc87ec168c5255d4a7eb0";

		module.exports.raw = \`query TestQuery($value: String!) {
		  users(stringValue: $value, boolValue: true, floatValue: 1.2, intValue: 1) {
		    firstName
		  }
		}
		\`;

		module.exports.rootType = "Query";

		module.exports.selection = {
		    "users": {
		        "type": "User",
		        "keyRaw": "users(stringValue: $value, boolValue: true, floatValue: 1.2, intValue: 1)",

		        "fields": {
		            "firstName": {
		                "type": "String",
		                "keyRaw": "firstName"
		            }
		        },

		        "connection": "All_Users"
		    }
		};

		module.exports.response = {
		    "users": {
		        "type": "User",
		        "keyRaw": "users(stringValue: $value, boolValue: true, floatValue: 1.2, intValue: 1)",

		        "fields": {
		            "firstName": {
		                "type": "String",
		                "keyRaw": "firstName"
		            }
		        },

		        "connection": "All_Users"
		    }
		};
	`)
	})
})
