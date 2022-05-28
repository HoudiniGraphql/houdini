// local imports
import '../../../jest.setup'
import { preprocessorTest } from '../utils'

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
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		import _TestSubscriptionStore from "$houdini/stores/GQL_TestSubscription";

		const data = subscription({
		    "kind": "HoudiniSubscription",
		    "store": _TestSubscriptionStore,
		    "config": houdiniConfig
		}, variables);
	`)
	})
})
