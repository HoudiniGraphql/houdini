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
	expect(files).toEqual(expect.arrayContaining(['TestQuery.cjs', 'TestFragment.cjs']))
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

		module.exports.response = {
		    rootType: "Query",

		    fields: {
		        "Query": {
		            "version": {
		                "key": "versionsomething_with_args",
		                "type": "Int"
		            }
		        }
		    }
		};

		module.exports.rootType = "Query";

		module.exports.selection = {
		    "version": {
		        "type": "Int",
		        "key": "versionsomething_with_args"
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
		        "key": "firstNamesomething_with_args"
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

		module.exports.response = {
		    rootType: "Query",

		    fields: {
		        "Query": {
		            "user": {
		                "key": "usersomething_with_args",
		                "type": "User"
		            }
		        },

		        "User": {
		            "firstName": {
		                "key": "firstNamesomething_with_args",
		                "type": "String"
		            }
		        }
		    }
		};

		module.exports.rootType = "Query";

		module.exports.selection = {
		    "user": {
		        "type": "User",
		        "key": "usersomething_with_args"
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

		module.exports.response = {
		    rootType: "Mutation",

		    fields: {
		        "Mutation": {
		            "addFriend": {
		                "key": "addFriendsomething_with_args",
		                "type": "AddFriendOutput"
		            }
		        },

		        "AddFriendOutput": {
		            "friend": {
		                "key": "friendsomething_with_args",
		                "type": "User"
		            }
		        },

		        "User": {
		            "firstName": {
		                "key": "firstNamesomething_with_args",
		                "type": "String"
		            }
		        }
		    }
		};

		module.exports.rootType = "Mutation";

		module.exports.selection = {
		    "addFriend": {
		        "type": "AddFriendOutput",
		        "key": "addFriendsomething_with_args",

		        "fields": {
		            "friend": {
		                "type": "User",
		                "key": "friendsomething_with_args",

		                "fields": {
		                    "firstName": {
		                        "type": "String",
		                        "key": "firstNamesomething_with_args"
		                    }
		                }
		            }
		        }
		    }
		};

		module.exports.operations = [];
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

		module.exports.response = {
		    rootType: "Mutation",

		    fields: {
		        "Mutation": {
		            "addFriend": {
		                "key": "addFriendsomething_with_args",
		                "type": "AddFriendOutput"
		            }
		        },

		        "AddFriendOutput": {
		            "friend": {
		                "key": "friendsomething_with_args",
		                "type": "User"
		            }
		        },

		        "User": {
		            "firstName": {
		                "key": "firstNamesomething_with_args",
		                "type": "String"
		            },

		            "id": {
		                "key": "idsomething_with_args",
		                "type": "ID"
		            }
		        }
		    }
		};

		module.exports.rootType = "Mutation";

		module.exports.selection = {
		    "addFriend": {
		        "type": "AddFriendOutput",
		        "key": "addFriendsomething_with_args",

		        "fields": {
		            "friend": {
		                "type": "User",
		                "key": "friendsomething_with_args"
		            }
		        }
		    }
		};

		module.exports.operations = [{
		    "source": ["addFriend", "friend"],
		    "target": "All_Users",
		    "kind": "insert",
		    "position": "last"
		}];
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

		module.exports.response = {
		    rootType: "Mutation",

		    fields: {
		        "Mutation": {
		            "addFriend": {
		                "key": "addFriendsomething_with_args",
		                "type": "AddFriendOutput"
		            }
		        },

		        "AddFriendOutput": {
		            "friend": {
		                "key": "friendsomething_with_args",
		                "type": "User"
		            }
		        },

		        "User": {
		            "firstName": {
		                "key": "firstNamesomething_with_args",
		                "type": "String"
		            },

		            "id": {
		                "key": "idsomething_with_args",
		                "type": "ID"
		            }
		        }
		    }
		};

		module.exports.rootType = "Mutation";

		module.exports.selection = {
		    "addFriend": {
		        "type": "AddFriendOutput",
		        "key": "addFriendsomething_with_args",

		        "fields": {
		            "friend": {
		                "type": "User",
		                "key": "friendsomething_with_args"
		            }
		        }
		    }
		};

		module.exports.operations = [{
		    "source": ["addFriend", "friend"],
		    "target": "All_Users",
		    "kind": "insert",
		    "position": "first",

		    "parentID": {
		        "kind": "String",
		        "value": "1234"
		    }
		}];
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

		module.exports.response = {
		    rootType: "Mutation",

		    fields: {
		        "Mutation": {
		            "addFriend": {
		                "key": "addFriendsomething_with_args",
		                "type": "AddFriendOutput"
		            }
		        },

		        "AddFriendOutput": {
		            "friend": {
		                "key": "friendsomething_with_args",
		                "type": "User"
		            }
		        },

		        "User": {
		            "firstName": {
		                "key": "firstNamesomething_with_args",
		                "type": "String"
		            },

		            "id": {
		                "key": "idsomething_with_args",
		                "type": "ID"
		            }
		        }
		    }
		};

		module.exports.rootType = "Mutation";

		module.exports.selection = {
		    "addFriend": {
		        "type": "AddFriendOutput",
		        "key": "addFriendsomething_with_args",

		        "fields": {
		            "friend": {
		                "type": "User",
		                "key": "friendsomething_with_args"
		            }
		        }
		    }
		};

		module.exports.operations = [{
		    "source": ["addFriend", "friend"],
		    "target": "All_Users",
		    "kind": "insert",
		    "position": "last",

		    "parentID": {
		        "kind": "String",
		        "value": "1234"
		    }
		}];
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

		module.exports.response = {
		    rootType: "Mutation",

		    fields: {
		        "Mutation": {
		            "addFriend": {
		                "key": "addFriendsomething_with_args",
		                "type": "AddFriendOutput"
		            }
		        },

		        "AddFriendOutput": {
		            "friend": {
		                "key": "friendsomething_with_args",
		                "type": "User"
		            }
		        },

		        "User": {
		            "firstName": {
		                "key": "firstNamesomething_with_args",
		                "type": "String"
		            },

		            "id": {
		                "key": "idsomething_with_args",
		                "type": "ID"
		            }
		        }
		    }
		};

		module.exports.rootType = "Mutation";

		module.exports.selection = {
		    "addFriend": {
		        "type": "AddFriendOutput",
		        "key": "addFriendsomething_with_args",

		        "fields": {
		            "friend": {
		                "type": "User",
		                "key": "friendsomething_with_args"
		            }
		        }
		    }
		};

		module.exports.operations = [{
		    "source": ["addFriend", "friend"],
		    "target": "All_Users",
		    "kind": "insert",
		    "position": "last",

		    "parentID": {
		        "kind": "String",
		        "value": "1234"
		    }
		}];
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

		module.exports.response = {
		    rootType: "Mutation",

		    fields: {
		        "Mutation": {
		            "addFriend": {
		                "key": "addFriendsomething_with_args",
		                "type": "AddFriendOutput"
		            }
		        },

		        "AddFriendOutput": {
		            "friend": {
		                "key": "friendsomething_with_args",
		                "type": "User"
		            }
		        },

		        "User": {
		            "firstName": {
		                "key": "firstNamesomething_with_args",
		                "type": "String"
		            },

		            "id": {
		                "key": "idsomething_with_args",
		                "type": "ID"
		            }
		        }
		    }
		};

		module.exports.rootType = "Mutation";

		module.exports.selection = {
		    "addFriend": {
		        "type": "AddFriendOutput",
		        "key": "addFriendsomething_with_args",

		        "fields": {
		            "friend": {
		                "type": "User",
		                "key": "friendsomething_with_args"
		            }
		        }
		    }
		};

		module.exports.operations = [{
		    "source": ["addFriend", "friend"],
		    "target": "All_Users",
		    "kind": "insert",
		    "position": "first",

		    "when": {
		        "must": {
		            "boolValue": "true"
		        }
		    }
		}];
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

		module.exports.response = {
		    rootType: "Mutation",

		    fields: {
		        "Mutation": {
		            "addFriend": {
		                "key": "addFriendsomething_with_args",
		                "type": "AddFriendOutput"
		            }
		        },

		        "AddFriendOutput": {
		            "friend": {
		                "key": "friendsomething_with_args",
		                "type": "User"
		            }
		        },

		        "User": {
		            "firstName": {
		                "key": "firstNamesomething_with_args",
		                "type": "String"
		            },

		            "id": {
		                "key": "idsomething_with_args",
		                "type": "ID"
		            }
		        }
		    }
		};

		module.exports.rootType = "Mutation";

		module.exports.selection = {
		    "addFriend": {
		        "type": "AddFriendOutput",
		        "key": "addFriendsomething_with_args",

		        "fields": {
		            "friend": {
		                "type": "User",
		                "key": "friendsomething_with_args"
		            }
		        }
		    }
		};

		module.exports.operations = [{
		    "source": ["addFriend", "friend"],
		    "target": "All_Users",
		    "kind": "insert",
		    "position": "last",

		    "when": {
		        "must": {
		            "boolValue": "true"
		        }
		    }
		}];
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

		module.exports.response = {
		    rootType: "Mutation",

		    fields: {
		        "Mutation": {
		            "addFriend": {
		                "key": "addFriendsomething_with_args",
		                "type": "AddFriendOutput"
		            }
		        },

		        "AddFriendOutput": {
		            "friend": {
		                "key": "friendsomething_with_args",
		                "type": "User"
		            }
		        },

		        "User": {
		            "firstName": {
		                "key": "firstNamesomething_with_args",
		                "type": "String"
		            },

		            "id": {
		                "key": "idsomething_with_args",
		                "type": "ID"
		            }
		        }
		    }
		};

		module.exports.rootType = "Mutation";

		module.exports.selection = {
		    "addFriend": {
		        "type": "AddFriendOutput",
		        "key": "addFriendsomething_with_args",

		        "fields": {
		            "friend": {
		                "type": "User",
		                "key": "friendsomething_with_args"
		            }
		        }
		    }
		};

		module.exports.operations = [{
		    "source": ["addFriend", "friend"],
		    "target": "All_Users",
		    "kind": "insert",
		    "position": "last",

		    "when": {
		        "must": {
		            "boolValue": "true"
		        }
		    }
		}];
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

		module.exports.response = {
		    rootType: "Mutation",

		    fields: {
		        "Mutation": {
		            "addFriend": {
		                "key": "addFriendsomething_with_args",
		                "type": "AddFriendOutput"
		            }
		        },

		        "AddFriendOutput": {
		            "friend": {
		                "key": "friendsomething_with_args",
		                "type": "User"
		            }
		        },

		        "User": {
		            "firstName": {
		                "key": "firstNamesomething_with_args",
		                "type": "String"
		            },

		            "id": {
		                "key": "idsomething_with_args",
		                "type": "ID"
		            }
		        }
		    }
		};

		module.exports.rootType = "Mutation";

		module.exports.selection = {
		    "addFriend": {
		        "type": "AddFriendOutput",
		        "key": "addFriendsomething_with_args",

		        "fields": {
		            "friend": {
		                "type": "User",
		                "key": "friendsomething_with_args"
		            }
		        }
		    }
		};

		module.exports.operations = [{
		    "source": ["addFriend", "friend"],
		    "target": "All_Users",
		    "kind": "insert",
		    "position": "first",

		    "when": {
		        "must_not": {
		            "boolValue": "true"
		        }
		    }
		}];
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

		module.exports.response = {
		    rootType: "Mutation",

		    fields: {
		        "Mutation": {
		            "addFriend": {
		                "key": "addFriendsomething_with_args",
		                "type": "AddFriendOutput"
		            }
		        },

		        "AddFriendOutput": {
		            "friend": {
		                "key": "friendsomething_with_args",
		                "type": "User"
		            }
		        },

		        "User": {
		            "firstName": {
		                "key": "firstNamesomething_with_args",
		                "type": "String"
		            },

		            "id": {
		                "key": "idsomething_with_args",
		                "type": "ID"
		            }
		        }
		    }
		};

		module.exports.rootType = "Mutation";

		module.exports.selection = {
		    "addFriend": {
		        "type": "AddFriendOutput",
		        "key": "addFriendsomething_with_args",

		        "fields": {
		            "friend": {
		                "type": "User",
		                "key": "friendsomething_with_args"
		            }
		        }
		    }
		};

		module.exports.operations = [{
		    "source": ["addFriend", "friend"],
		    "target": "All_Users",
		    "kind": "insert",
		    "position": "last",

		    "when": {
		        "must_not": {
		            "boolValue": "true"
		        }
		    }
		}];
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

		module.exports.response = {
		    rootType: "Mutation",

		    fields: {
		        "Mutation": {
		            "addFriend": {
		                "key": "addFriendsomething_with_args",
		                "type": "AddFriendOutput"
		            }
		        },

		        "AddFriendOutput": {
		            "friend": {
		                "key": "friendsomething_with_args",
		                "type": "User"
		            }
		        },

		        "User": {
		            "firstName": {
		                "key": "firstNamesomething_with_args",
		                "type": "String"
		            },

		            "id": {
		                "key": "idsomething_with_args",
		                "type": "ID"
		            }
		        }
		    }
		};

		module.exports.rootType = "Mutation";

		module.exports.selection = {
		    "addFriend": {
		        "type": "AddFriendOutput",
		        "key": "addFriendsomething_with_args",

		        "fields": {
		            "friend": {
		                "type": "User",
		                "key": "friendsomething_with_args"
		            }
		        }
		    }
		};

		module.exports.operations = [{
		    "source": ["addFriend", "friend"],
		    "target": "All_Users",
		    "kind": "insert",
		    "position": "last",

		    "when": {
		        "must_not": {
		            "boolValue": "true"
		        }
		    }
		}];
	`)
	})
})
