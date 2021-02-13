// external imports
import { testConfig } from 'houdini-common'
import * as graphql from 'graphql'
// local imports
import '../../../../jest.setup'
import { runPipeline } from '../compile'
import { mockCollectedDoc } from '../testUtils'

test('connection fragments on query selection set', async function () {
	const docs = [
		mockCollectedDoc(
			'UpdateUser',
			`
				mutation UpdateUser {
					updateUser {
                        ...User_Friends_Connection
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
		    ...User_Friends_Connection
		  }
		}

		fragment User_Friends_Connection on User {
		  firstName
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
                        ...User_Friends_Connection
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
		    ...User_Friends_Connection
		  }
		}

		fragment User_Friends_Connection on User {
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

test('includes `id` in connection fragment', function () {
	fail('high prio')
})

test('fails if id is not present as a connection operation target', function () {
	fail('high prio')
})
