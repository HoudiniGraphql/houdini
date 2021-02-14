// external imports
import { testConfig } from 'houdini-common'
import * as graphql from 'graphql'
// local imports
import '../../../../jest.setup'
import { runPipeline } from '../compile'
import { mockCollectedDoc } from '../testUtils'

test('insert fragments on query selection set', async function () {
	const docs = [
		mockCollectedDoc(
			'UpdateUser',
			`
				mutation UpdateUser {
					updateUser {
                        ...User_Friends_insert
					}
				}
			`
		),
		mockCollectedDoc(
			'TestQuery',
			`
				query AllUsers {
					user {
						friends @connection(name:"User_Friends") {
							firstName
							id
						}
					}
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	expect(graphql.print(docs[0].document)).toMatchInlineSnapshot(`
		"mutation UpdateUser {
		  updateUser {
		    ...User_Friends_insert
		  }
		}

		fragment User_Friends_insert on User {
		  firstName
		  id
		}
		"
	`)
})

test('delete fragments on query selection set', async function () {
	const docs = [
		mockCollectedDoc(
			'UpdateUser',
			`
				mutation UpdateUser {
					updateUser {
                        ...User_Friends_remove
					}
				}
			`
		),
		mockCollectedDoc(
			'TestQuery',
			`
				query AllUsers {
					user {
						friends @connection(name:"User_Friends") {
							firstName
							id
						}
					}
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	expect(graphql.print(docs[0].document)).toMatchInlineSnapshot(`
		"mutation UpdateUser {
		  updateUser {
		    ...User_Friends_remove
		  }
		}

		fragment User_Friends_remove on User {
		  id
		}
		"
	`)
})

test('connection fragments on fragment selection set', async function () {
	const docs = [
		mockCollectedDoc(
			'UpdateUser',
			`
				mutation UpdateUser {
					updateUser {
                        ...User_Friends_insert @prepend(parentID: "1234")
					}
				}
			`
		),
		mockCollectedDoc(
			'TestQuery',
			`
				fragment AllUsers  on User{
					friends @connection(name:"User_Friends") {
						firstName
						id
					}
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	expect(graphql.print(docs[0].document)).toMatchInlineSnapshot(`
		"mutation UpdateUser {
		  updateUser {
		    ...User_Friends_insert @prepend(parentID: \\"1234\\")
		  }
		}

		fragment User_Friends_insert on User {
		  firstName
		  id
		}
		"
	`)
})

test('connection fragments must be unique', async function () {
	const docs = [
		mockCollectedDoc(
			'TestQuery',
			`
				query AllUsers {
					user {
						friends @connection(name:"User_Friends") {
							firstName
							id
						}
						otherFriends: friends @connection(name:"User_Friends") {
							firstName
							id
						}
					}
				}
			`
		),
	]

	// run the pipeline and make sure it fails
	await expect(runPipeline(testConfig(), docs)).rejects.toBeTruthy()
})

test('includes `id` in connection fragment', async function () {
	const docs = [
		mockCollectedDoc(
			'UpdateUser',
			`
			mutation UpdateUser {
				updateUser {
					...User_Friends_insert @prepend(parentID: "1234")
				}
			}
		`
		),
		mockCollectedDoc(
			'TestQuery',
			`
			fragment AllUsers  on User{
				friends @connection(name:"User_Friends") {
					firstName
				}
			}
		`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	expect(graphql.print(docs[0].document)).toMatchInlineSnapshot(`
		"mutation UpdateUser {
		  updateUser {
		    ...User_Friends_insert @prepend(parentID: \\"1234\\")
		  }
		}

		fragment User_Friends_insert on User {
		  firstName
		}
		"
	`)
})

test('cannot use connection directive if id is not a valid field', async function () {
	const docs = [
		mockCollectedDoc(
			'TestQuery',
			`
			query AllGhosts {
				ghost {
					friends {
						friends @connection(name: "Ghost_Friends"){
							name
						}
					}
				}
			}
		`
		),
	]

	// run the pipeline
	const config = testConfig()
	await expect(runPipeline(config, docs)).rejects.toBeTruthy()
})
