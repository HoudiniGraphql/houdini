import { test, expect } from 'vitest'

import { runPipeline } from '..'
import { testConfig, mockCollectedDoc } from '../../test'

test('adds ids to selection sets of objects with them', async function () {
	const docs = [
		mockCollectedDoc(
			`
				query Friends {
                    user {
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
		query Friends {
		  user {
		    firstName
		  }
		  ...Friends__houdini__extra__fields
		}

		fragment Friends__houdini__extra__fields on Query {
		  user {
		    id
		  }
		}
	`)
})

test("doesn't add id if there isn't one", async function () {
	const docs = [
		mockCollectedDoc(
			`
				query Friends {
                    ghost {
                        legends {
							name
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
		query Friends {
		  ghost {
		    legends {
		      name
		    }
		  }
		  ...Friends__houdini__extra__fields
		}

		fragment Friends__houdini__extra__fields on Query {
		  ghost {
		    legends {
		      name
		    }
		    name
		    aka
		  }
		}
	`)
})

test('adds custom id fields to selection sets of objects with them', async function () {
	const docs = [
		mockCollectedDoc(
			`
				query Friends {
                    ghost {
                        name
                    }
				}
			`
		),
	]

	// run the pipeline
	const config = testConfig()
	await runPipeline(config, docs)

	expect(docs[0].document).toMatchInlineSnapshot(`
		query Friends {
		  ghost {
		    name
		  }
		  ...Friends__houdini__extra__fields
		}

		fragment Friends__houdini__extra__fields on Query {
		  ghost {
		    name
		    aka
		  }
		}
	`)
})

test('adds __typename on interface selection sets under query', async function () {
	const docs = [
		mockCollectedDoc(
			`
				query Friends {
					friends {
                        ... on Cat {
                            id
                        }
                        ... on Ghost {
                            name
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
		query Friends {
		  friends {
		    ... on Cat {
		      id
		    }
		    ... on Ghost {
		      name
		    }
		  }
		  ...Friends__houdini__extra__fields
		}

		fragment Friends__houdini__extra__fields on Query {
		  friends {
		    __typename
		  }
		}
	`)
})

test('adds __typename on interface selection sets under an object', async function () {
	const docs = [
		mockCollectedDoc(
			`
				query Friends {
                    users(stringValue: "hello") {
                        friendsInterface {
                            ... on Cat {
                                id
                            }
                            ... on Ghost {
                                name
                                aka
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
		query Friends {
		  users(stringValue: "hello") {
		    friendsInterface {
		      ... on Cat {
		        id
		      }
		      ... on Ghost {
		        name
		        aka
		      }
		    }
		  }
		  ...Friends__houdini__extra__fields
		}

		fragment Friends__houdini__extra__fields on Query {
		  users(stringValue: "hello") {
		    friendsInterface {
		      __typename
		    }
		    id
		  }
		}
	`)
})

test('adds __typename on unions', async function () {
	const docs = [
		mockCollectedDoc(
			`
				query Friends {
					entities {
                        ... on Cat {
                            id
                        }
                        ... on Ghost {
                            name
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
		query Friends {
		  entities {
		    ... on Cat {
		      id
		    }
		    ... on Ghost {
		      name
		    }
		  }
		  ...Friends__houdini__extra__fields
		}

		fragment Friends__houdini__extra__fields on Query {
		  entities {
		    __typename
		  }
		}
	`)
})
