import { fs, path, load_manifest } from 'houdini'
import { test, expect } from 'vitest'

import { test_config } from '../config'
import { generate_type_root } from './typeRoot'

test('generates type files for pages', async function () {
	const config = await test_config()

	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			'+layout.gql': mockQuery('LayoutQuery'),
			'+page.tsx': mockView(['LayoutQuery']),
			'(subRoute)': {
				'+page.tsx': mockView(['FinalQuery']),
				'+page.gql': mockQuery('FinalQuery', true),
				'+layout.gql': mockQuery('RootQuery'),
			},
		},
	})

	const manifest = await load_manifest({
		config,
	})

	// generate the type rot
	await generate_type_root({ config, manifest })

	// make sure we generated the right thing
	expect(fs.snapshot(config.typeRootDir)).toMatchInlineSnapshot(`
		{
		    "/src/routes/(subRoute)/$types.d.ts": "\\nimport { DocumentHandle, RouteProp } from '../../../../plugins/houdini-react/runtime'\\nimport React from 'react'\\nimport type { LayoutQuery$result, LayoutQuery$artifact, LayoutQuery$input } from '../../../../artifacts/LayoutQuery'\\nimport type { RootQuery$result, RootQuery$artifact, RootQuery$input } from '../../../../artifacts/RootQuery'\\nimport type { FinalQuery$result, FinalQuery$artifact, FinalQuery$input } from '../../../../artifacts/FinalQuery'\\n\\nexport type PageProps = {\\n\\t\\tParams: {\\n\\t\\t\\n\\t},\\n\\t\\t\\n    LayoutQuery: LayoutQuery$result,\\n    LayoutQuery$handle: DocumentHandle<LayoutQuery$artifact, LayoutQuery$result, LayoutQuery$input>,\\n    RootQuery: RootQuery$result,\\n    RootQuery$handle: DocumentHandle<RootQuery$artifact, RootQuery$result, RootQuery$input>,\\n    FinalQuery: FinalQuery$result,\\n    FinalQuery$handle: DocumentHandle<FinalQuery$artifact, FinalQuery$result, FinalQuery$input>,\\n}\\n\\n\\nexport type LayoutProps = {\\n\\tParams: {\\n\\t\\t\\n\\t},\\n\\tchildren: React.ReactNode,\\n}\\n",
		    "/src/routes/$types.d.ts": "\\nimport { DocumentHandle, RouteProp } from '../../../plugins/houdini-react/runtime'\\nimport React from 'react'\\nimport type { LayoutQuery$result, LayoutQuery$artifact, LayoutQuery$input } from '../../../artifacts/LayoutQuery'\\n\\nexport type PageProps = {\\n\\t\\tParams: {\\n\\t\\t\\n\\t},\\n\\t\\t\\n    LayoutQuery: LayoutQuery$result,\\n    LayoutQuery$handle: DocumentHandle<LayoutQuery$artifact, LayoutQuery$result, LayoutQuery$input>,\\n}\\n\\n\\nexport type LayoutProps = {\\n\\tParams: {\\n\\t\\t\\n\\t},\\n\\tchildren: React.ReactNode,\\n}\\n"
		}
	`)
})

test('generates route prop type', async function () {
	const config = await test_config()

	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			'[id]': {
				'+page.tsx': mockView(['MyQuery']),
				'+layout.gql': `
					query MyQuery($id: ID!) {
						node(id: $id) {
							__typename
						}
					}
				`,
			},
		},
	})

	const manifest = await load_manifest({
		config,
	})

	// generate the type rot
	await generate_type_root({ config, manifest })

	// make sure we generated the right thing
	expect(await fs.readFile(path.join(config.typeRootDir, 'src', 'routes', '[id]', '$types.d.ts')))
		.toMatchInlineSnapshot(`
			"
			import { DocumentHandle, RouteProp } from '../../../../plugins/houdini-react/runtime'
			import React from 'react'
			import type { MyQuery$result, MyQuery$artifact, MyQuery$input } from '../../../../artifacts/MyQuery'

			export type PageProps = {
					Params: {
					id: string,
				},
					
			    MyQuery: MyQuery$result,
			    MyQuery$handle: DocumentHandle<MyQuery$artifact, MyQuery$result, MyQuery$input>,
			}


			export type LayoutProps = {
				Params: {
					id: string,
				},
				children: React.ReactNode,
			}
			"
		`)
})

function mockView(deps: string[]) {
	return `export default ({ ${deps.join(', ')} }) => <div>hello</div>`
}

function mockQuery(name: string, loading?: boolean) {
	return `
query ${name} ${loading ? '@loading' : ''}{
	id
}
	`
}
