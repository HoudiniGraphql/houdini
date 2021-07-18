// external imports
import { testConfig } from 'houdini-common'
import * as graphql from 'graphql'
// local imports
import '../../../../jest.setup'
import { runPipeline } from '../generate'
import { mockCollectedDoc } from '../testUtils'

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
		    id
		    __typename
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
                        aka
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
		    aka
		    __typename
		  }
		}

	`)
})
