// external imports
import * as svelte from 'svelte/compiler'
import { default as path } from 'path'
// local imports
import { testConfig } from '../../common'
import { ConfigFile } from '../../runtime'
import runTransforms from '../transforms'

export default async function preprocessorTest(
	content: string,
	{ route, ...cfg }: { route: boolean } & Partial<ConfigFile> = { route: true }
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
	const config = testConfig({ schema, framework: 'sapper', ...cfg })

	const doc = {
		content,
		filename: route
			? path.join(config.projectRoot, 'src', 'routes', 'component.svelte')
			: path.join(config.projectRoot, 'src', 'lib', 'component.svelte'),
	}

	// run the source through the processor
	const result = await runTransforms(config, doc)

	return svelte.parse(result.code)
}

type Partial<T> = {
	[P in keyof T]?: T[P]
}
