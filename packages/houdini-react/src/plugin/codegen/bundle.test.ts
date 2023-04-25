import { fs, parseJS } from 'houdini'
import { test, expect } from 'vitest'

import { test_config } from '../../../../houdini-router/src/plugin/config'
import { page_bundle_component } from '../conventions'
import { generate_bundles } from './bundles'
import { load_manifest } from './manifest'

test('composes layouts and pages', async function () {
	const config = await test_config()

	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			'+layout.tsx': 'export default ({children}) => <div>{children}</div>',
			'+layout.gql': mockQuery('RootQuery'),
			subRoute: {
				'+layout.tsx': mockView(['RootQuery', 'SubQuery']),
				'+layout.gql': mockQuery('SubQuery'),
				nested: {
					'+page.gql': mockQuery('FinalQuery'),
					'+page.tsx': mockView(['FinalQuery']),
				},
			},
		},
	})

	// generate the manifest
	const manifest = await load_manifest({ config })

	// generate the bundle for the nested page
	await generate_bundles({ config, manifest })

	await expect(
		parseJS(
			(await fs.readFile(page_bundle_component(config, Object.keys(manifest.pages)[0]))) ??
				'',
			{ plugins: ['jsx'] }
		)
	).resolves.toMatchInlineSnapshot(`
		import Layout___ from "../../../../../src/routes/+layout";
		import Layout___subRoute__ from "../../../../../src/routes/subRoute/+layout";
		import Component___subRoute__nested from "../../../../../src/routes/subRoute/nested/+page";

		export default (
		    {
		        FinalQuery,
		        FinalQuery$handle,
		        RootQuery,
		        RootQuery$handle,
		        SubQuery,
		        SubQuery$handle
		    }
		) => (<Layout___>
		    <Layout___subRoute__
		        RootQuery={RootQuery}
		        RootQuery$handle={RootQuery$handle}
		        SubQuery={SubQuery}
		        SubQuery$handle={SubQuery$handle}>
		        <Component___subRoute__nested FinalQuery={FinalQuery} FinalQuery$handle={FinalQuery$handle} />
		    </Layout___subRoute__>
		</Layout___>);
	`)
})

function mockView(deps: string[]) {
	return `export default ({ ${deps.join(', ')} }) => <div>hello</div>`
}

function mockQuery(name: string) {
	return `
query ${name} {
	id
}
	`
}
