// external imports
import { testConfig } from 'houdini-common'
import * as graphql from 'graphql'
// local imports
import '../../../../jest.setup'
import { runPipeline } from '../compile'
import { docFromQuery } from '../testUtils'

test('connection fragments on query selection set', async function () {
	const docs = [
		docFromQuery(
			'UpdateUser',
			`
				mutation UpdateUser {
					updateUser {
                        ...User_Friends_Connection
					}
				}
			`
		),
		docFromQuery(
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
		docFromQuery(
			'UpdateUser',
			`
				mutation UpdateUser {
					updateUser {
                        ...User_Friends_Connection
					}
				}
			`
		),
		docFromQuery(
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
		docFromQuery(
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
