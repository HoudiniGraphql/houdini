// local imports
import { testConfig } from '../../common'
import '../../../jest.setup'
import { runPipeline } from '../generate'
import { mockCollectedDoc } from '../testUtils'

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
		    __typename
		  }
		}

	`)
})
