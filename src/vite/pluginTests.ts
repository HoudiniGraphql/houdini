// external imports
import { default as path } from 'path'
import { parse as parseJS } from '@babel/parser'
// local imports
import { testConfig } from '../common'
import { ConfigFile } from '../runtime'
import { transform } from './plugin'
import { parse } from 'acorn'

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

	const filename = route
		? path.join(config.projectRoot, 'src', 'routes', 'component.svelte')
		: path.join(config.projectRoot, 'src', 'lib', 'component.svelte')

	// run the source through the processor
	const ctx = {
		config,
		filepath: filename,
		addWatchFile: () => {},
		parse: (val: string) => parse(val, { ecmaVersion: 'latest' }),
	}

	const result = await transform(ctx, content)
	return parseJS(typeof result !== 'string' ? result!.code! : result || '', {
		plugins: ['typescript'],
		sourceType: 'module',
	}).program
}

type Partial<T> = {
	[P in keyof T]?: T[P]
}
