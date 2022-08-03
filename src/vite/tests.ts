import path from 'path'
import * as recast from 'recast'

import { writeFile } from '../common/fs'
import { ParsedFile, parseJS, parseSvelte } from '../common/parse'
import { testConfig } from '../common/tests'
import type { ConfigFile } from '../runtime/lib/config'
import runTransforms from './transforms'
import type { PageStoreReference } from './transforms/kit'

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

export async function routeTest({
	component = '',
	script = '',
	query = '',
	config: extra,
	page_stores = [],
}: {
	component?: string
	script?: string
	query?: string
	config?: Partial<ConfigFile>
	page_stores?: PageStoreReference[]
}): Promise<{ component: ParsedFile; script: ParsedFile }> {
	// build up the document we'll pass to the processor
	const config = testConfig({ schema, ...extra })

	// scripts live in src/routes/+page.svelte
	const filepath = path.join(process.cwd(), 'src/routes', '+page.svelte')

	// write the content
	await Promise.all([
		writeFile(filepath, component),
		writeFile(config.routeDataPath(filepath), script),
		writeFile(config.pageQueryPath(filepath), query),
	])

	// we want to run the transformer on both the component and script paths
	const [componentResult, scriptResult] = await Promise.all([
		runTransforms(
			config,
			{
				config,
				filepath,
				addWatchFile: () => {},
				mock_page_stores: page_stores,
			},
			// the component transforms happen on the script content only
			recast.prettyPrint((await parseSvelte(component))!).code
		),
		runTransforms(
			config,
			{
				config,
				filepath: config.routeDataPath(filepath),
				addWatchFile: () => {},
				mock_page_stores: page_stores,
			},
			script
		),
	])

	// return both
	return {
		component: await parseJS(componentResult.code),
		script: await parseJS(scriptResult.code),
	}
}

export async function componentTest(
	content: string,
	extra?: Partial<ConfigFile>
): Promise<ParsedFile> {
	// build up the document we'll pass to the processor
	const config = testConfig({ schema, ...extra })

	// routes live in src/routes/+page.svelte
	const filepath = path.join(process.cwd(), 'src/lib', 'component.svelte')

	// write the content
	await Promise.all([writeFile(filepath, content)])

	// we want to run the transformer on both the component and script paths
	const result = await runTransforms(
		config,
		{
			config,
			filepath,
			addWatchFile: () => {},
		},
		content
	)

	// return both
	return await parseJS(result.code)
}
