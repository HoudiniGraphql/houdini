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
                fragment UserFriends on Query {
                    usersByCursor(first: 10) @paginate {
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
		fragment UserFriends on Query @arguments(first: {type: "Int", default: 10}, after: {type: "String"}) {
		  usersByCursor(first: $first, after: $after) @paginate {
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

		fragment UserFriends_jrGTj on Query @arguments(first: {type: "Int", default: 10}, after: {type: "String"}) {
		  usersByCursor(first: $first, after: $after) @paginate {
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
                fragment UserFriends on Query {
                    usersByOffset(limit: 10) @paginate {
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
		fragment UserFriends on Query @arguments(offset: {type: "Int"}, limit: {type: "Int", default: 10}) {
		  usersByOffset(limit: $limit, offset: $offset) @paginate {
		    id
		  }
		}

		fragment UserFriends_1ZUIJ1 on Query @arguments(offset: {type: "Int"}, limit: {type: "Int", default: 10}) {
		  usersByOffset(limit: $limit, offset: $offset) @paginate {
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
                fragment UserFriends on Query {
                    usersByCursor(first: 10) @paginate {
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
		fragment UserFriends on Query @arguments(first: {type: "Int", default: 10}, after: {type: "String"}) {
		  usersByCursor(first: $first, after: $after) @paginate {
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

		fragment UserFriends_jrGTj on Query @arguments(first: {type: "Int", default: 10}, after: {type: "String"}) {
		  usersByCursor(first: $first, after: $after) @paginate {
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
                fragment UserFriends on Query {
                    usersByCursor(last: 10) @paginate {
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
		fragment UserFriends on Query @arguments(last: {type: "Int", default: 10}, before: {type: "String"}) {
		  usersByCursor(last: $last, before: $before) @paginate {
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

		fragment UserFriends_41Q4zu on Query @arguments(last: {type: "Int", default: 10}, before: {type: "String"}) {
		  usersByCursor(last: $last, before: $before) @paginate {
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
                fragment UserFriends on Query {
                    usersByForwardsCursor(first: 10) @paginate {
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
		fragment UserFriends on Query @arguments(first: {type: "Int", default: 10}, after: {type: "String"}) {
		  usersByForwardsCursor(first: $first, after: $after) @paginate {
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

		fragment UserFriends_jrGTj on Query @arguments(first: {type: "Int", default: 10}, after: {type: "String"}) {
		  usersByForwardsCursor(first: $first, after: $after) @paginate {
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
                fragment UserFriends on Query {
                    usersByBackwardsCursor(last: 10) @paginate {
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
		fragment UserFriends on Query @arguments(last: {type: "Int", default: 10}, before: {type: "String"}) {
		  usersByBackwardsCursor(last: $last, before: $before) @paginate {
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

		fragment UserFriends_41Q4zu on Query @arguments(last: {type: "Int", default: 10}, before: {type: "String"}) {
		  usersByBackwardsCursor(last: $last, before: $before) @paginate {
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
                fragment UserFriends on Query {
                    usersByCursor(last: 10, before: "cursor") @paginate {
                        edges {
                            node {
                                id
                            }
                        }
                    }
                }
			`
		),
		// mockCollectedDoc('')
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	// load the contents of the file
	expect(docs[0].document).toMatchInlineSnapshot(`
		fragment UserFriends on Query @arguments(last: {type: "Int", default: 10}, before: {type: "String", default: "cursor"}) {
		  usersByCursor(last: $last, before: $before) @paginate {
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

		fragment UserFriends_41Q4zu on Query @arguments(last: {type: "Int", default: 10}, before: {type: "String", default: "cursor"}) {
		  usersByCursor(last: $last, before: $before) @paginate {
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
                fragment UserFriends on Query {
                    usersByForwardsCursor(first: 10) @paginate {
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

		fragment UserFriends_jrGTj on Query @arguments(first: {type: "Int", default: 10}, after: {type: "String"}) {
		  usersByForwardsCursor(first: $first, after: $after) @paginate {
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
