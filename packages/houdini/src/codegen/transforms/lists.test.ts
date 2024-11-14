import * as graphql from 'graphql'
import { expect, test } from 'vitest'

import { runPipeline } from '../../codegen'
import { fs } from '../../lib'
import { mockCollectedDoc, testConfig } from '../../test'

test('insert fragments on query selection set', async function () {
	const docs = [
		mockCollectedDoc(
			`
				mutation UpdateUser {
					updateUser {
                        ...User_Friends_insert
					}
				}
			`
		),
		mockCollectedDoc(
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

	expect(docs[0].document).toMatchInlineSnapshot(`
		mutation UpdateUser {
		  updateUser {
		    ...User_Friends_insert
		    id
		  }
		}

		fragment User_Friends_insert on User {
		  firstName
		  id
		}
	`)
})

test('delete fragments on query selection set', async function () {
	const docs = [
		mockCollectedDoc(
			`
				mutation UpdateUser {
					updateUser {
                        ...User_Friends_remove
					}
				}
			`
		),
		mockCollectedDoc(
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

	expect(docs[0].document).toMatchInlineSnapshot(`
		mutation UpdateUser {
		  updateUser {
		    ...User_Friends_remove
		    id
		  }
		}

		fragment User_Friends_remove on User {
		  id
		}
	`)
})

test('list fragments on fragment selection set', async function () {
	const docs = [
		mockCollectedDoc(
			`
				mutation UpdateUser {
					updateUser {
              ...User_Friends_insert @prepend @parentID(value: "1234")
					}
				}
			`
		),
		mockCollectedDoc(
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

	expect(docs[0].document).toMatchInlineSnapshot(`
		mutation UpdateUser {
		  updateUser {
		    ...User_Friends_insert @prepend @parentID(value: "1234")
		    id
		  }
		}

		fragment User_Friends_insert on User {
		  firstName
		  id
		}
	`)
})

test('delete node', async function () {
	const docs = [
		mockCollectedDoc(
			`
				mutation DeleteUser {
					deleteUser(id: "1234") {
						userID @User_delete
					}
				}
			`
		),
		mockCollectedDoc(
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

test('delete node from connection', async function () {
	const docs = [
		mockCollectedDoc(
			`
				mutation DeleteUser {
					deleteUser(id: "1234") {
						userID @User_delete
					}
				}
			`
		),
		mockCollectedDoc(
			`
				fragment AllUsers  on User{
					friendsByCursor @list(name:"User_Friends") {
							edges {
								node {
								firstName
								id
							}
						}
					}
				}
			`
		),
	]

	expect(docs[0].document).toMatchInlineSnapshot(`
		mutation DeleteUser {
		  deleteUser(id: "1234") {
		    userID @User_delete
		  }
		}

	`)
})

test('list fragments must be unique', async function () {
	const docs = [
		mockCollectedDoc(
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

test("fragment with list doesn't clutter its definition", async function () {
	const docs = [
		mockCollectedDoc(`fragment Friends on User  {
			friends @list(name:"Friends") {
				id
			}
		}`),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	expect(docs[0].document).toMatchInlineSnapshot(`
		fragment Friends on User {
		  friends @list(name: "Friends") {
		    id
		  }
		  id
		  __typename
		}
	`)
})

test('includes `id` in list fragment', async function () {
	const docs = [
		mockCollectedDoc(
			`
			mutation UpdateUser {
				updateUser {
					...User_Friends_insert @prepend @parentID(value: "1234")
				}
			}
		`
		),
		mockCollectedDoc(
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

	expect(docs[0].document).toMatchInlineSnapshot(`
		mutation UpdateUser {
		  updateUser {
		    ...User_Friends_insert @prepend @parentID(value: "1234")
		    id
		  }
		}

		fragment User_Friends_insert on User {
		  id
		  firstName
		}
	`)
})

test('connections marked with list directive get cursor information', async function () {
	const docs = [
		mockCollectedDoc(
			`
			fragment AllUsers  on User{
				friendsByCursor @list(name:"User_Friends") {
					edges {
						node {
							id
							firstName
							friends {
								id
							}
						}
					}
				}
			}
		`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	expect(docs[0].document).toMatchInlineSnapshot(`
		fragment AllUsers on User {
		  friendsByCursor @list(name: "User_Friends", connection: true) {
		    edges {
		      node {
		        id
		        firstName
		        friends {
		          id
		        }
		      }
		    }
		    edges {
		      cursor
		      node {
		        __typename
		      }
		    }
		    pageInfo {
		      hasPreviousPage
		      hasNextPage
		      startCursor
		      endCursor
		    }
		  }
		  id
		  __typename
		}
	`)
})

test('includes node selection on connection', async function () {
	const docs = [
		mockCollectedDoc(
			`
			mutation UpdateUser {
				updateUser {
					...User_Friends_insert @prepend @parentID(value: "1234")
				}
			}
		`
		),
		mockCollectedDoc(
			`
			fragment AllUsers  on User{
				friendsByCursor @list(name:"User_Friends") {
					edges {
						node {
							id
							firstName
							friends {
								id
							}
						}
					}
				}
			}
		`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	expect(docs[0].document).toMatchInlineSnapshot(`
		mutation UpdateUser {
		  updateUser {
		    ...User_Friends_insert @prepend @parentID(value: "1234")
		    id
		  }
		}

		fragment User_Friends_insert on User {
		  id
		  firstName
		  friends {
		    id
		  }
		}
	`)
})

test('list flags connections', async function () {
	const docs = [
		mockCollectedDoc(
			`
			fragment AllUsers on User {
				friendsByCursor @list(name:"User_Friends") {
					edges {
						node {
							id
							firstName
							friends {
								id
							}
						}
					}
				}
			}
		`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	expect(docs[0].document).toMatchInlineSnapshot(`
		fragment AllUsers on User {
		  friendsByCursor @list(name: "User_Friends", connection: true) {
		    edges {
		      node {
		        id
		        firstName
		        friends {
		          id
		        }
		      }
		    }
		    edges {
		      cursor
		      node {
		        __typename
		      }
		    }
		    pageInfo {
		      hasPreviousPage
		      hasNextPage
		      startCursor
		      endCursor
		    }
		  }
		  id
		  __typename
		}
	`)
})

test('cannot use list directive if id is not a valid field', async function () {
	const docs = [
		mockCollectedDoc(
			`
			query AllGhosts {
				ghost {
					friends {
						legends @list(name: "Ghost_Friends"){
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

	let nbError = 0
	// run the pipeline
	try {
		await runPipeline(config, docs)
	} catch (error: unknown) {
		nbError++
		// @ts-ignore
		expect(error[0].message).toMatchInlineSnapshot(
			`"@list on [32mLegend[39m has a configuration issue: Legend does not have a valid key. Please check this link for more information: https://houdinigraphql.com/guides/caching-data#custom-ids"`
		)
	}
	expect(nbError).toBe(1)
	// expect(docs[0]).toMatchInlineSnapshot(``)
})

test('list with Custom Ids & an extra field', async function () {
	const docs = [
		mockCollectedDoc(
			`
			query CustomIdList {
				customIdList @list(name: "theList") {
					foo
					dummy
				}
			}
		`
		),
	]

	const config = testConfig()

	// run the pipeline
	await runPipeline(config, docs)

	const content = await fs.readFile(config.definitionsDocumentsPath)

	// We want Obj Identification & the extra field on insert & toggle
	expect(graphql.parse(content!)).toMatchInlineSnapshot(
		`
		fragment theList_insert on CustomIdType {
		  foo
		  dummy
		  bar
		}

		fragment theList_toggle on CustomIdType {
		  foo
		  dummy
		  bar
		}

		fragment theList_remove on CustomIdType {
		  foo
		  bar
		}
	`
	)
})

test('paginate with name also gets treated as a list', async function () {
	const docs = [
		mockCollectedDoc(
			`
			mutation UpdateUser {
				updateUser {
					...User_Friends_insert @prepend @parentID(value: "1234")
				}
			}
		`
		),
		mockCollectedDoc(
			`
			fragment AllUsers  on User{
				friendsByCursor(first: 10) @paginate(name:"User_Friends") {
					edges {
						node {
							id
							firstName
							friends {
								id
							}
						}
					}
				}
			}
		`
		),
	]

	// run the pipeline
	const config = testConfig()
	try {
		await runPipeline(config, docs)
	} catch (error) {
		console.log(`error`, error)
	}

	expect(docs[0].document).toMatchInlineSnapshot(`
		mutation UpdateUser {
		  updateUser {
		    ...User_Friends_insert @prepend @parentID(value: "1234")
		    id
		  }
		}

		fragment User_Friends_insert on User {
		  id
		  firstName
		  friends {
		    id
		  }
		}
	`)
})

test.todo('cursor could be a Cursor scalar, not as string')
