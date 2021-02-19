// external imports
import * as recast from 'recast'
import path from 'path'
import { testConfig } from 'houdini-common'
import * as graphql from 'graphql'
import fs from 'fs/promises'
import { FileKind } from 'ast-types/gen/kinds'
import * as typeScriptParser from 'recast/parsers/typescript'
// local imports
import { runPipeline as runGenerators } from '../../compile'
import { CollectedGraphQLDocument } from '../../types'
import '../../../../../jest.setup'
import { mockCollectedDoc } from '../../testUtils'

const config = testConfig()

test('generates patches', async function () {
	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		// the query needs to ask for a field that the mutation could update
		mockCollectedDoc('TestQuery', `query TestQuery { user { id firstName } }`),
		mockCollectedDoc('TestMutation', `mutation TestMutation { updateUser { id firstName } }`),
	]

	// run the generators
	await runGenerators(config, docs)

	// look up the files in the mutation directory
	const files = await fs.readdir(config.patchDirectory)

	// make sure we made two files
	expect(files).toHaveLength(1)
	// and they have the right names
	expect(files).toEqual(
		expect.arrayContaining([
			path.basename(config.patchPath({ query: 'TestQuery', mutation: 'TestMutation' })),
		])
	)

	// load the contents of the file
	const contents = await fs.readFile(
		config.patchPath({ query: 'TestQuery', mutation: 'TestMutation' }),
		'utf-8'
	)

	// make sure there is something
	expect(contents).toBeTruthy()

	// parse the contents
	const parsedContents: FileKind = recast.parse(contents, {
		parser: typeScriptParser,
	})

	// make sure this doesn't change without approval
	expect(parsedContents).toMatchInlineSnapshot(`
		export default {
		    "edges": {
		        "updateUser": {
		            "fields": {
		                "firstName": [["user", "firstName"]]
		            }
		        }
		    }
		};
	`)
})

test('patches include connection operations', async function () {
	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		// the query needs to ask for a field that the mutation could update
		mockCollectedDoc(
			'TestQuery',
			`query TestQuery {
				user {
					id
					cats @connection(name: "Friends") {
						name
					}
				}
			}`
		),
		mockCollectedDoc(
			'TestMutation',
			`mutation TestMutation {
				catMutation {
					cat {
						...Friends_insert
					}
				}
			}`
		),
	]

	// run the generators
	await runGenerators(config, docs)

	// the patch betweeen TestQuery and TestMutation should include an operation that adds the result
	// to the marked connection
	const contents = await fs.readFile(
		config.patchPath({ query: 'TestQuery', mutation: 'TestMutation' }),
		'utf-8'
	)

	expect(
		recast.parse(contents, {
			parser: typeScriptParser,
		})
	).toMatchInlineSnapshot(`
		export default {
		    "edges": {
		        "catMutation": {
		            "edges": {
		                "cat": {
		                    "operations": {
		                        "add": [{
		                            "position": "end",

		                            "parentID": {
		                                "kind": "Root",
		                                "value": "root"
		                            },

		                            "path": ["user", "cats"],
		                            "connectionName": "Friends"
		                        }]
		                    }
		                }
		            }
		        }
		    }
		};
	`)
})

test('patches include remove operations', async function () {
	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		// the query needs to ask for a field that the mutation could update
		mockCollectedDoc(
			'TestQuery',
			`query TestQuery {
				user {
					id
					cats @connection(name: "Friends") {
						name
					}
				}
			}`
		),
		mockCollectedDoc(
			'TestMutation',
			`mutation TestMutation {
				catMutation {
					cat {
						...Friends_remove
					}
				}
			}`
		),
	]

	// run the generators
	await runGenerators(config, docs)

	// the patch betweeen TestQuery and TestMutation should include an operation that adds the result
	// to the marked connection
	const contents = await fs.readFile(
		config.patchPath({ query: 'TestQuery', mutation: 'TestMutation' }),
		'utf-8'
	)

	expect(
		recast.parse(contents, {
			parser: typeScriptParser,
		})
	).toMatchInlineSnapshot(`
		export default {
		    "edges": {
		        "catMutation": {
		            "edges": {
		                "cat": {
		                    "operations": {
		                        "remove": [{
		                            "position": "end",

		                            "parentID": {
		                                "kind": "Root",
		                                "value": "root"
		                            },

		                            "path": ["user", "cats"],
		                            "connectionName": "Friends"
		                        }]
		                    }
		                }
		            }
		        }
		    }
		};
	`)
})

test('patches include delete operations', async function () {
	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		// the query needs to ask for a field that the mutation could update
		mockCollectedDoc(
			'TestQuery',
			`query TestQuery {
				user {
					id
					cats @connection(name: "Friends") {
						name
					}
				}
			}`
		),
		mockCollectedDoc(
			'TestMutation',
			`mutation TestMutation {
				deleteCat {
					catID @Cat_delete
				}
			}`
		),
	]

	// run the generators
	await runGenerators(config, docs)

	// the patch betweeen TestQuery and TestMutation should include an operation that adds the result
	// to the marked connection
	const contents = await fs.readFile(
		config.patchPath({ query: 'TestQuery', mutation: 'TestMutation' }),
		'utf-8'
	)

	expect(
		recast.parse(contents, {
			parser: typeScriptParser,
		})
	).toMatchInlineSnapshot(`
		export default {
		    "edges": {
		        "deleteCat": {
		            "edges": {
		                "catID": {
		                    "operations": {
		                        "delete": [{
		                            "position": "end",

		                            "parentID": {
		                                "kind": "Root",
		                                "value": "root"
		                            },

		                            "path": ["user", "cats"],
		                            "connectionName": "__houdini__delete_Cat"
		                        }]
		                    }
		                }
		            }
		        }
		    }
		};
	`)
})

test('connection patches track insert position', async function () {
	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		// the query needs to ask for a field that the mutation could update
		mockCollectedDoc(
			'TestQuery',
			`fragment TestFragment on User {
				id
				cats @connection(name: "Friends") {
					name
				}
			}`
		),
		mockCollectedDoc(
			'TestMutation',
			`mutation TestMutation {
				catMutation {
					cat {
						...Friends_insert @prepend(parentID: "1234")
					}
				}
			}`
		),
	]

	// run the generators
	await runGenerators(config, docs)

	// the patch betweeen TestQuery and TestMutation should include an operation that adds the result
	// to the marked connection
	const contents = await fs.readFile(
		config.patchPath({ query: 'TestFragment', mutation: 'TestMutation' }),
		'utf-8'
	)

	expect(
		recast.parse(contents, {
			parser: typeScriptParser,
		})
	).toMatchInlineSnapshot(`
		export default {
		    "edges": {
		        "catMutation": {
		            "edges": {
		                "cat": {
		                    "operations": {
		                        "add": [{
		                            "position": "start",

		                            "parentID": {
		                                "kind": "String",
		                                "value": "1234"
		                            },

		                            "path": ["cats"],
		                            "connectionName": "Friends"
		                        }]
		                    }
		                }
		            }
		        }
		    }
		};
	`)
})

test('connection patches track insert condition', async function () {
	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		// the query needs to ask for a field that the mutation could update
		mockCollectedDoc(
			'TestQuery',
			`query TestQuery {
				users(stringValue: "1234")  @connection(name:"Friends"){
					firstName
				}
			}`
		),
		mockCollectedDoc(
			'TestMutation',
			`mutation TestMutation {
				updateUser {
					...Friends_insert @prepend(when: { argument: "boolValue", value: "true" })
				}
			}`
		),
	]

	// run the generators
	await runGenerators(config, docs)

	// the patch betweeen TestQuery and TestMutation should include an operation that adds the result
	// to the marked connection
	const contents = await fs.readFile(
		config.patchPath({ query: 'TestQuery', mutation: 'TestMutation' }),
		'utf-8'
	)

	expect(
		recast.parse(contents, {
			parser: typeScriptParser,
		})
	).toMatchInlineSnapshot(`
		export default {
		    "edges": {
		        "updateUser": {
		            "operations": {
		                "add": [{
		                    "position": "start",

		                    "parentID": {
		                        "kind": "Root",
		                        "value": "root"
		                    },

		                    "path": ["users"],
		                    "connectionName": "Friends",

		                    "when": {
		                        "must": {
		                            "boolValue": true
		                        }
		                    }
		                }]
		            }
		        }
		    }
		};
	`)
})

test('connection when not', async function () {
	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		// the query needs to ask for a field that the mutation could update
		mockCollectedDoc(
			'TestQuery',
			`query TestQuery {
				users(stringValue: "1234")  @connection(name:"Friends"){
					firstName
				}
			}`
		),
		mockCollectedDoc(
			'TestMutation',
			`mutation TestMutation {
				updateUser {
					...Friends_insert @prepend(when_not: { argument: "boolValue", value: "true" })
				}
			}`
		),
	]

	// run the generators
	await runGenerators(config, docs)

	// the patch betweeen TestQuery and TestMutation should include an operation that adds the result
	// to the marked connection
	const contents = await fs.readFile(
		config.patchPath({ query: 'TestQuery', mutation: 'TestMutation' }),
		'utf-8'
	)

	expect(
		recast.parse(contents, {
			parser: typeScriptParser,
		})
	).toMatchInlineSnapshot(`
		export default {
		    "edges": {
		        "updateUser": {
		            "operations": {
		                "add": [{
		                    "position": "start",

		                    "parentID": {
		                        "kind": "Root",
		                        "value": "root"
		                    },

		                    "path": ["users"],
		                    "connectionName": "Friends",

		                    "when": {
		                        "must_not": {
		                            "boolValue": true
		                        }
		                    }
		                }]
		            }
		        }
		    }
		};
	`)
})

test('connection patches include reference to parentID string value', async function () {
	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		// the query needs to ask for a field that the mutation could update
		mockCollectedDoc(
			'TestQuery',
			`fragment TestFragment on User {
				id
				cats @connection(name: "Friends") {
					name
				}
			}`
		),
		mockCollectedDoc(
			'TestMutation',
			`mutation TestMutation {
				catMutation {
					cat {
						...Friends_insert @append(parentID: "1234")
					}
				}
			}`
		),
	]

	// run the generators
	await runGenerators(config, docs)

	// the patch betweeen TestQuery and TestMutation should include an operation that adds the result
	// to the marked connection
	const contents = await fs.readFile(
		config.patchPath({ query: 'TestFragment', mutation: 'TestMutation' }),
		'utf-8'
	)

	expect(
		recast.parse(contents, {
			parser: typeScriptParser,
		})
	).toMatchInlineSnapshot(`
		export default {
		    "edges": {
		        "catMutation": {
		            "edges": {
		                "cat": {
		                    "operations": {
		                        "add": [{
		                            "position": "end",

		                            "parentID": {
		                                "kind": "String",
		                                "value": "1234"
		                            },

		                            "path": ["cats"],
		                            "connectionName": "Friends"
		                        }]
		                    }
		                }
		            }
		        }
		    }
		};
	`)
})

test('connection patches include reference to parentID variable', async function () {
	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		// the query needs to ask for a field that the mutation could update
		mockCollectedDoc(
			'TestQuery',
			`fragment TestFragment on User {
				id
				cats @connection(name: "Friends") {
					name
				}
			}`
		),
		mockCollectedDoc(
			'TestMutation',
			`mutation TestMutation($userID: ID!) {
				catMutation {
					cat {
						...Friends_insert @append(parentID: $userID)
					}
				}
			}`
		),
	]

	// run the generators
	await runGenerators(config, docs)

	// the patch betweeen TestQuery and TestMutation should include an operation that adds the result
	// to the marked connection
	const contents = await fs.readFile(
		config.patchPath({ query: 'TestFragment', mutation: 'TestMutation' }),
		'utf-8'
	)

	expect(
		recast.parse(contents, {
			parser: typeScriptParser,
		})
	).toMatchInlineSnapshot(`
		export default {
		    "edges": {
		        "catMutation": {
		            "edges": {
		                "cat": {
		                    "operations": {
		                        "add": [{
		                            "position": "end",

		                            "parentID": {
		                                "kind": "Variable",
		                                "value": "userID"
		                            },

		                            "path": ["cats"],
		                            "connectionName": "Friends"
		                        }]
		                    }
		                }
		            }
		        }
		    }
		};
	`)
})

test('connection patches include reference to parentID directive', async function () {
	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		// the query needs to ask for a field that the mutation could update
		mockCollectedDoc(
			'TestQuery',
			`fragment TestFragment on User {
				id
				cats @connection(name: "Friends") {
					name
				}
			}`
		),
		mockCollectedDoc(
			'TestMutation',
			`mutation TestMutation($userID: ID!) {
				catMutation {
					cat {
						...Friends_insert @append @parentID(value: $userID)
					}
				}
			}`
		),
	]

	// run the generators
	await runGenerators(config, docs)

	// the patch betweeen TestQuery and TestMutation should include an operation that adds the result
	// to the marked connection
	const contents = await fs.readFile(
		config.patchPath({ query: 'TestFragment', mutation: 'TestMutation' }),
		'utf-8'
	)

	expect(
		recast.parse(contents, {
			parser: typeScriptParser,
		})
	).toMatchInlineSnapshot(`
		export default {
		    "edges": {
		        "catMutation": {
		            "edges": {
		                "cat": {
		                    "operations": {
		                        "add": [{
		                            "position": "end",

		                            "parentID": {
		                                "kind": "Variable",
		                                "value": "userID"
		                            },

		                            "path": ["cats"],
		                            "connectionName": "Friends"
		                        }]
		                    }
		                }
		            }
		        }
		    }
		};
	`)
})

test('no patches for connection fragments', async function () {
	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		// the query needs to ask for a field that the mutation could update
		mockCollectedDoc(
			'TestQuery',
			`fragment TestFragment on User {
				id
				cats @connection(name: "Friends") {
					name
				}
			}`
		),
		mockCollectedDoc(
			'TestMutation',
			`mutation TestMutation($userID: ID!) {
				catMutation {
					cat {
						...Friends_insert @append(parentID: $userID)
					}
				}
			}`
		),
	]

	// run the generators
	await runGenerators(config, docs)

	// the patch betweeen TestQuery and TestMutation should include an operation that adds the result
	// to the marked connection
	await expect(
		fs.stat(config.patchPath({ query: 'Friends_insert', mutation: 'TestMutation' }))
	).rejects.toBeTruthy()
})

test('one operation multiple queries dont double up', async function () {
	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		// the query needs to ask for a field that the mutation could update
		mockCollectedDoc(
			'TestQuery1',
			`query TestQuery1 {
				user {
					id
					cats @connection(name: "Friends1") {
						name
					}
				}
			}`
		),
		mockCollectedDoc(
			'TestQuery2',
			`query TestQuery2 {
				user {
					id
					cats @connection(name: "Friends2") {
						name
					}
				}
			}`
		),
		mockCollectedDoc(
			'TestMutation',
			`mutation TestMutation {
				catMutation {
					cat {
						...Friends1_insert
						...Friends2_insert
					}
				}
			}`
		),
	]

	// run the generators
	await runGenerators(config, docs)

	// the patch betweeen TestQuery and TestMutation should include an operation that adds the result
	// to the marked connection
	const contents = await fs.readFile(
		config.patchPath({ query: 'TestQuery1', mutation: 'TestMutation' }),
		'utf-8'
	)

	expect(
		recast.parse(contents, {
			parser: typeScriptParser,
		})
	).toMatchInlineSnapshot(`
		export default {
		    "edges": {
		        "catMutation": {
		            "edges": {
		                "cat": {
		                    "operations": {
		                        "add": [{
		                            "position": "end",

		                            "parentID": {
		                                "kind": "Root",
		                                "value": "root"
		                            },

		                            "path": ["user", "cats"],
		                            "connectionName": "Friends1"
		                        }]
		                    }
		                }
		            }
		        }
		    }
		};
	`)
})

test.todo('inline fragments in mutation body count as an intersection')

test.todo('inline fragments in queries count as an intersection')

test.todo('inline fragments in fragments count as an intersection')

test.todo('fragment spread in mutation body')

test.todo("nested objects that don't have id should also update")
