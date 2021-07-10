// external imports
import { testConfig } from 'houdini-common'
// local imports
import '../../../../jest.setup'
import { runPipeline } from '../generate'
import { mockCollectedDoc } from '../testUtils'

test('adds pagination info to full', async function () {
	const docs = [
		mockCollectedDoc(
			'TestPaginationFields',
			`
                fragment UserFriends on User {
                    friendsByCursor(first: 10) @paginate {
                        edges {
                            node {
                                id
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

	// load the contents of the file
	expect(docs[0].document).toMatchInlineSnapshot(`
		fragment UserFriends on User @arguments(first: {type: "Int", default: 10}, after: {type: "String"}) {
		  friendsByCursor(first: $first, after: $after) @paginate {
		    edges {
		      node {
		        id
		      }
		    }
		    edges {
		      cursor
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

test("doesn't add pagination info to offset pagination", async function () {
	const docs = [
		mockCollectedDoc(
			'TestPaginationFields',
			`
                fragment UserFriends on User {
                    friendsByOffset(limit: 10) @paginate {
						id
                    }
                }
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0].document).toMatchInlineSnapshot(`
		fragment UserFriends on User @arguments(offset: {type: "Int"}, limit: {type: "Int", default: 10}) {
		  friendsByOffset(limit: $limit, offset: $offset) @paginate {
		    id
		  }
		}

	`)
})

test('paginate adds forwards cursor args to the full cursor fragment', async function () {
	const docs = [
		mockCollectedDoc(
			'TestPaginationFields',
			`
                fragment UserFriends on User {
                    friendsByCursor(first: 10) @paginate {
                        edges {
                            node {
                                id
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

	// load the contents of the file
	expect(docs[0].document).toMatchInlineSnapshot(`
		fragment UserFriends on User @arguments(first: {type: "Int", default: 10}, after: {type: "String"}) {
		  friendsByCursor(first: $first, after: $after) @paginate {
		    edges {
		      node {
		        id
		      }
		    }
		    edges {
		      cursor
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

test('paginate adds backwards cursor args to the full cursor fragment', async function () {
	const docs = [
		mockCollectedDoc(
			'TestPaginationFields',
			`
                fragment UserFriends on User {
                    friendsByCursor(last: 10) @paginate {
                        edges {
                            node {
                                id
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

	// load the contents of the file
	expect(docs[0].document).toMatchInlineSnapshot(`
		fragment UserFriends on User @arguments(last: {type: "Int", default: 10}, before: {type: "String"}) {
		  friendsByCursor(last: $last, before: $before) @paginate {
		    edges {
		      node {
		        id
		      }
		    }
		    edges {
		      cursor
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

test('paginate adds forwards cursor args to the fragment', async function () {
	const docs = [
		mockCollectedDoc(
			'TestPaginationFields',
			`
                fragment UserFriends on User {
                    friendsByForwardsCursor(first: 10) @paginate {
                        edges {
                            node {
                                id
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

	// load the contents of the file
	expect(docs[0].document).toMatchInlineSnapshot(`
		fragment UserFriends on User @arguments(first: {type: "Int", default: 10}, after: {type: "String"}) {
		  friendsByForwardsCursor(first: $first, after: $after) @paginate {
		    edges {
		      node {
		        id
		      }
		    }
		    edges {
		      cursor
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

test('paginate adds backwards cursor args to the fragment', async function () {
	const docs = [
		mockCollectedDoc(
			'TestPaginationFields',
			`
                fragment UserFriends on User {
                    friendsByBackwardsCursor(last: 10) @paginate {
                        edges {
                            node {
                                id
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

	// load the contents of the file
	expect(docs[0].document).toMatchInlineSnapshot(`
		fragment UserFriends on User @arguments(last: {type: "Int", default: 10}, before: {type: "String"}) {
		  friendsByBackwardsCursor(last: $last, before: $before) @paginate {
		    edges {
		      node {
		        id
		      }
		    }
		    edges {
		      cursor
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

test('sets before with default value', async function () {
	const docs = [
		mockCollectedDoc(
			'TestPaginationFields',
			`
                fragment UserFriends on User {
                    friendsByCursor(last: 10, before: "cursor") @paginate {
                        edges {
                            node {
                                id
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

	// load the contents of the file
	expect(docs[0].document).toMatchInlineSnapshot(`
		fragment UserFriends on User @arguments(last: {type: "Int", default: 10}, before: {type: "String", default: "cursor"}) {
		  friendsByCursor(last: $last, before: $before) @paginate {
		    edges {
		      node {
		        id
		      }
		    }
		    edges {
		      cursor
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

test('embeds pagination query as a separate document', async function () {
	const docs = [
		mockCollectedDoc(
			'TestPaginationFields',
			`
                fragment UserFriends on User {
                    friendsByForwardsCursor(first: 10) @paginate {
                        edges {
                            node {
                                id
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

	// load the contents of the file
	expect(docs[1]?.document).toMatchInlineSnapshot(`
		query UserFriends_Houdini_Paginate($first: Int = 10, $after: String) {
		  ...UserFriends_jrGTj @with(first: $first, after: $after)
		}

		fragment UserFriends_jrGTj on User @arguments(first: {type: "Int", default: 10}, after: {type: "String"}) {
		  friendsByForwardsCursor(first: $first, after: $after) @paginate {
		    edges {
		      node {
		        id
		      }
		    }
		    edges {
		      cursor
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
