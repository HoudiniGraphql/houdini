import * as graphql from 'graphql'
import { expect, test } from 'vitest'

import { fs } from '../../../lib'
import { mockCollectedDoc, testConfig } from '../../test'
import { runPipeline } from '../codegen'

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
		        id
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

test('nested connections contain pageInfo', async function () {
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
							friendsByCursor @list(name:"Friends_by_Cursor"){
								edges {
									node {
										id
									}
								}
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
		  friendsByCursor @list(name: "Friends_by_Cursor") {
		    edges {
		      node {
		        id
		      }
		    }
		    edges {
		      cursor
		      node {
		        __typename
		        id
		      }
		    }
		    pageInfo {
		      hasPreviousPage
		      hasNextPage
		      startCursor
		      endCursor
		    }
		  }
		}
	`)
})

test('nested connections contain pageInfo', async function () {
	const docs = [
		mockCollectedDoc(
			`
			mutation UpdateUser {
				updateUser {
					...User_Friends_insert @parentID(value:"foo")
				}
			}
		`
		),
		mockCollectedDoc(
			`
			fragment AllUsers  on User{
				friendsByCursor(first:10) @paginate(name:"User_Friends") {
					edges {
						node {
							id
							firstName
							friendsByCursor @list(name:"Friends_by_Cursor"){
								edges {
									node {
										id
									}
								}
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
		    ...User_Friends_insert @parentID(value: "foo")
		    id
		  }
		}

		fragment User_Friends_insert on User {
		  id
		  firstName
		  friendsByCursor @list(name: "Friends_by_Cursor") {
		    edges {
		      node {
		        id
		      }
		    }
		    edges {
		      cursor
		      node {
		        __typename
		        id
		      }
		    }
		    pageInfo {
		      hasPreviousPage
		      hasNextPage
		      startCursor
		      endCursor
		    }
		  }
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
			'"@list on [32mLegend[39m has a configuration issue: Legend dos not have a valid key. Please check this link for more information: https://houdinigraphql.com/guides/caching-data#custom-ids"'
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
