// external imports
import { testConfig } from 'houdini-common'
import * as graphql from 'graphql'
// local imports
import '../../../../jest.setup'
import { runPipeline } from '../generate'
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
						friends @list(name:"User_Friends") {
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
						friends @list(name:"User_Friends") {
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

test('list fragments on fragment selection set', async function () {
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
					friends @list(name:"User_Friends") {
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

test('delete node', async function () {
	const docs = [
		mockCollectedDoc(
			'DeleteUser',
			`
				mutation DeleteUser {
					deleteUser(id: "1234") {
						userID @User_delete
					}
				}
			`
		),
		mockCollectedDoc(
			'TestQuery',
			`
				fragment AllUsers  on User{
					friends @list(name:"User_Friends") {
						firstName
						id
					}
				}
			`
		),
	]

	// the document should validate
	await expect(runPipeline(testConfig(), docs)).resolves.toBeUndefined()
})

test('list fragments must be unique', async function () {
	const docs = [
		mockCollectedDoc(
			'TestQuery',
			`
				query AllUsers {
					user {
						friends @list(name:"User_Friends") {
							firstName
							id
						}
						otherFriends: friends @list(name:"User_Friends") {
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

test('includes `id` in list fragment', async function () {
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
				friends @list(name:"User_Friends") {
					id
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
		  id
		  firstName
		}
		"
	`)
})

test('cannot use list directive if id is not a valid field', async function () {
	const docs = [
		mockCollectedDoc(
			'TestQuery',
			`
			query AllGhosts {
				ghost {
					friends {
						friends @list(name: "Ghost_Friends"){
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
