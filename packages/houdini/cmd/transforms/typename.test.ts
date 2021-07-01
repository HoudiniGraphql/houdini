// external imports
import { testConfig } from 'houdini-common'
import * as graphql from 'graphql'
// local imports
import '../../../../jest.setup'
import { runPipeline } from '../generate'
import { mockCollectedDoc } from '../testUtils'

test('adds __typename__ on query selection set', async function () {
	const docs = [
		mockCollectedDoc(
			'Friends',
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

	expect(graphql.print(docs[0].document)).toMatchInlineSnapshot(`
		"query Friends {
		  friends {
		    __typename
		    ... on Cat {
		      id
		    }
		    ... on Ghost {
		      name
		    }
		  }
		}
		"
	`)
})

test('adds __typename__ on object selection set', async function () {
	const docs = [
		mockCollectedDoc(
			'Friends',
			`
				query Friends {
                    users(stringValue: "hello") { 
                        friendsInterface {
                            ... on Cat { 
                                id
                            }
                            ... on Ghost { 
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
	await runPipeline(config, docs)

	expect(graphql.print(docs[0].document)).toMatchInlineSnapshot(`
		"query Friends {
		  users(stringValue: \\"hello\\") {
		    friendsInterface {
		      __typename
		      ... on Cat {
		        id
		      }
		      ... on Ghost {
		        name
		      }
		    }
		  }
		}
		"
	`)
})
