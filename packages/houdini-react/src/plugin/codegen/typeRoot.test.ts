import { fs } from 'houdini'
import { test, expect } from 'vitest'

import { test_config } from '../config'
import { load_manifest } from './manifest'
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
		    "/src/routes/(subRoute)/$types.d.ts": "\\nimport { DocumentHandle } from '../../../../plugins/houdini-react/runtime'\\n\\nimport type { LayoutQuery$result, LayoutQuery$artifact, LayoutQuery$input } from '../../../../artifacts/LayoutQuery'\\nimport type { RootQuery$result, RootQuery$artifact, RootQuery$input } from '../../../../artifacts/RootQuery'\\nimport type { FinalQuery$result, FinalQuery$artifact, FinalQuery$input } from '../../../../artifacts/FinalQuery'\\n\\n\\nexport type PageProps = {\\n    LayoutQuery: LayoutQuery$result,\\n    LayoutQuery$handle: DocumentHandle<LayoutQuery$artifact, LayoutQuery$result, LayoutQuery$input>,\\n    RootQuery: RootQuery$result,\\n    RootQuery$handle: DocumentHandle<RootQuery$artifact, RootQuery$result, RootQuery$input>,\\n    FinalQuery: FinalQuery$result,\\n    FinalQuery$handle: DocumentHandle<FinalQuery$artifact, FinalQuery$result, FinalQuery$input>,\\n}\\n\\n\\n\\n",
		    "/src/routes/$types.d.ts": "\\nimport { DocumentHandle } from '../../../plugins/houdini-react/runtime'\\n\\nimport type { LayoutQuery$result, LayoutQuery$artifact, LayoutQuery$input } from '../../../artifacts/LayoutQuery'\\n\\n\\nexport type PageProps = {\\n    LayoutQuery: LayoutQuery$result,\\n    LayoutQuery$handle: DocumentHandle<LayoutQuery$artifact, LayoutQuery$result, LayoutQuery$input>,\\n}\\n\\n\\n\\n"
		}
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
