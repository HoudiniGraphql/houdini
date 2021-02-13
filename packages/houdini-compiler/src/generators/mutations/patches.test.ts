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
		    "fields": {},

		    "edges": {
		        "updateUser": {
		            "fields": {
		                "firstName": [["user", "firstName"]]
		            },

		            "edges": {},

		            "operations": {
		                "add": []
		            }
		        }
		    },

		    "operations": {
		        "add": []
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
					friends @connection(name: "Friends") {
						firstName
					}
				}
			}`
		),
		mockCollectedDoc(
			'TestMutation',
			`mutation TestMutation {
				addFriend {
					friend {
						...Friends_Connection
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
		    "fields": {},

		    "edges": {
		        "addFriend": {
		            "fields": {},

		            "edges": {
		                "friend": {
		                    "fields": {},
		                    "edges": {},

		                    "operations": {
		                        "add": [{
		                            "parentID": {
		                                "kind": "Root",
		                                "value": "root"
		                            },

		                            "path": ["user", "friends"]
		                        }]
		                    }
		                }
		            },

		            "operations": {
		                "add": []
		            }
		        }
		    },

		    "operations": {
		        "add": []
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
				friends @connection(name: "Friends") {
					firstName
				}
			}`
		),
		mockCollectedDoc(
			'TestMutation',
			`mutation TestMutation {
				addFriend {
					friend {
						...Friends_Connection @append(parentID: "1234")
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
		    "fields": {},

		    "edges": {
		        "addFriend": {
		            "fields": {},

		            "edges": {
		                "friend": {
		                    "fields": {},
		                    "edges": {},

		                    "operations": {
		                        "add": [{
		                            "parentID": {
		                                "kind": "String",
		                                "value": "1234"
		                            },

		                            "path": ["friends"]
		                        }]
		                    }
		                }
		            },

		            "operations": {
		                "add": []
		            }
		        }
		    },

		    "operations": {
		        "add": []
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
				friends @connection(name: "Friends") {
					firstName
				}
			}`
		),
		mockCollectedDoc(
			'TestMutation',
			`mutation TestMutation($userID: ID!) {
				addFriend {
					friend {
						...Friends_Connection @append(parentID: $userID)
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
		    "fields": {},

		    "edges": {
		        "addFriend": {
		            "fields": {},

		            "edges": {
		                "friend": {
		                    "fields": {},
		                    "edges": {},

		                    "operations": {
		                        "add": [{
		                            "parentID": {
		                                "kind": "Variable",
		                                "value": "userID"
		                            },

		                            "path": ["friends"]
		                        }]
		                    }
		                }
		            },

		            "operations": {
		                "add": []
		            }
		        }
		    },

		    "operations": {
		        "add": []
		    }
		};
	`)
})

test.skip('inline fragments in mutation body count as an intersection', function () {})

test.skip('inline fragments in queries count as an intersection', function () {})

test.skip('inline fragments in fragments count as an intersection', function () {})

test.skip('fragment spread in mutation body', function () {})

test.skip("nested objects that don't have id should also update", function () {})
