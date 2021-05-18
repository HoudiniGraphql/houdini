// external imports
import * as svelte from 'svelte/compiler'
// local imports
import subscriptionProcessor from './subscription'
import { testConfig } from 'houdini-common'
import '../../../../jest.setup'

describe('subscription preprocessor', function () {
	test('happy path', async function () {
		const doc = await preprocessorTest(`
			<script>
				const data = subscription(graphql\`
                    subscription TestSubscription { 
                        newUser { 
                            user { 
                                id
                            }
                        }
                    }
				\`, variables)
			</script>
		`)

		// make sure we added the right stuff
		expect(doc.instance.content).toMatchInlineSnapshot(`
		import _TestSubscriptionArtifact from "$houdini/artifacts/TestSubscription";

		const data = subscription({
		    "kind": "HoudiniSubscription",
		    "artifact": _TestSubscriptionArtifact
		}, variables);
	`)
	})
})

async function preprocessorTest(content: string) {
	// parse the document
	const parsed = svelte.parse(content)

	// build up the document we'll pass to the processor
	const config = testConfig({ verifyHash: false })

	const doc = {
		instance: parsed.instance,
		module: parsed.module,
		config,
		dependencies: [],
		filename: 'base.svelte',
	}

	// @ts-ignore
	// run the source through the processor
	await subscriptionProcessor(config, doc)

	// invoke the test
	return doc
}
