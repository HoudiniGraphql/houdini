// external imports
import * as svelte from 'svelte/compiler'
// local imports
import mutationProcessor from './mutation'
import { testConfig } from 'houdini-common'
import '../../../../jest.setup'

describe('mutation preprocessor', function () {
	test('happy path', async function () {
		const doc = await preprocessorTest(`
			<script>
				import { mutation } from '$houdini'

				const data = mutation(graphql\`
                    mutation AddUser { 
                        addUser { 
                            id
                        }
                    }
				\`)
			</script>
		`)

		// make sure we added the right stuff
		expect(doc.instance.content).toMatchInlineSnapshot(`
		import _AddUserArtifact from "$houdini/artifacts/AddUser";
		import { mutation } from "$houdini";

		const data = mutation({
		    "kind": "HoudiniMutation",
		    "artifact": _AddUserArtifact
		});
	`)
	})
})

async function preprocessorTest(content: string) {
	const schema = `
		type User {
			id: ID!
		}

        type Mutation { 
            addUser: User!
        }
	`

	// parse the document
	const parsed = svelte.parse(content)

	// build up the document we'll pass to the processor
	const config = testConfig({ schema, verifyHash: false })

	const doc = {
		instance: parsed.instance,
		module: parsed.module,
		config,
		dependencies: [],
		filename: 'base.svelte',
	}

	// @ts-ignore
	// run the source through the processor
	await mutationProcessor(config, doc)

	// invoke the test
	return doc
}
