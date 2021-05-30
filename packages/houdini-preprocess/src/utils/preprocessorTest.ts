// external imports
import * as svelte from 'svelte/compiler'
// local imports
import { testConfig, ConfigFile } from 'houdini-common'
import runTransforms from '../transforms'

export default async function preprocessorTest(
	content: string,
	{ filename = 'base.svelte', ...cfg }: { filename?: string } & Partial<ConfigFile> = {}
) {
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
	// build up the document we'll pass to the processor
	const config = testConfig({ schema, verifyHash: false, ...cfg })

	const doc = {
		content,
		filename,
	}

	// run the source through the processor
	const result = await runTransforms(config, doc)

	return svelte.parse(result.code)
}

type Partial<T> = {
	[P in keyof T]?: T[P]
}
