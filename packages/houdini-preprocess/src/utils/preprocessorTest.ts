// external imports
import * as svelte from 'svelte/compiler'
// local imports
import { testConfig, parseFile } from 'houdini-common'
import runTransforms from '../transforms'

export default async function preprocessorTest(content: string, cfg?: {}) {
	const schema = `
		type User {
			id: ID!
		}
        
        type Query {
            viewer: User
        }

        type Mutation { 
            addUser: User 
        }
	`

	// parse the document
	const parsed = svelte.parse(content)

	// build up the document we'll pass to the processor
	const config = testConfig({ schema, verifyHash: false, ...cfg })

	const doc = {
		content,
		filename: 'base.svelte',
	}

	// run the source through the processor
	const result = await runTransforms(config, doc)

	return svelte.parse(result.code)
}
