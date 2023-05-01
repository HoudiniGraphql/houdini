import { fs, parseJS } from 'houdini'
import { test, expect } from 'vitest'

import { test_config } from '../config'
import { page_entry_path, page_unit_path, layout_unit_path } from '../conventions'
import { generate_entries } from './entries'
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
					'+page.gql': mockQuery('FinalQuery', true),
					'+page.tsx': mockView(['FinalQuery']),
				},
			},
		},
	})

	// generate the manifest
	const manifest = await load_manifest({ config })

	// generate the bundle for the nested page
	await generate_entries({ config, manifest })

	await expect(
		parseJS(
			(await fs.readFile(page_entry_path(config, Object.keys(manifest.pages)[0]))) ?? '',
			{ plugins: ['jsx'] }
		)
	).resolves.toMatchInlineSnapshot(`
		import { Page, Fallback } from "$houdini/plugins/houdini-react/runtime/routing/components";
		import Layout___ from "../units/layouts/__.jsx";
		import Layout___subRoute from "../units/layouts/__subRoute.jsx";
		import Page___subRoute__nested from "../units/pages/__subRoute__nested.jsx";

		export default () => (<Layout___>
		    <Layout___subRoute>
		        <Fallback Component={Page___subRoute__nested} queries={["FinalQuery"]}>
		            <Page___subRoute__nested />
		        </Fallback>
		    </Layout___subRoute>
		</Layout___>);
	`)

	await expect(
		parseJS((await fs.readFile(page_unit_path(config, Object.keys(manifest.pages)[0]))) ?? '', {
			plugins: ['jsx'],
		})
	).resolves.toMatchInlineSnapshot(`
		import { useDocumentStore } from "$houdini/plugins/houdini-react/runtime/routing/components/Router";
		import Component___subRoute__nested from "../../../../../src/routes/subRoute/nested/layout";

		export default (
		    {
		        children
		    }
		) => {
		    const [FinalQuery$data, FinalQuery$handle] = useDocumentStore("FinalQuery");

		    return (
		        (<Component___subRoute__nested FinalQuery={FinalQuery$data} FinalQuery$handle={FinalQuery$handle}>
		            {children}
		        </Component___subRoute__nested>)
		    );
		};
	`)

	await expect(
		parseJS(
			(await fs.readFile(layout_unit_path(config, Object.keys(manifest.layouts)[0]))) ?? '',
			{
				plugins: ['jsx'],
			}
		)
	).resolves.toMatchInlineSnapshot(`
		import { useDocumentStore } from "$houdini/plugins/houdini-react/runtime/routing/components/Router";
		import Component___ from "../../../../../src/routes/layout";

		export default (
		    {
		        children
		    }
		) => {
		    return (
		        (<Component___>
		            {children}
		        </Component___>)
		    );
		};
	`)

	await expect(
		parseJS(
			(await fs.readFile(layout_unit_path(config, Object.keys(manifest.layouts)[1]))) ?? '',
			{
				plugins: ['jsx'],
			}
		)
	).resolves.toMatchInlineSnapshot(`
		import { useDocumentStore } from "$houdini/plugins/houdini-react/runtime/routing/components/Router";
		import Component___subRoute from "../../../../../src/routes/subRoute/layout";

		export default (
		    {
		        children
		    }
		) => {
		    const [RootQuery$data, RootQuery$handle] = useDocumentStore("RootQuery");
		    const [SubQuery$data, SubQuery$handle] = useDocumentStore("SubQuery");

		    return (
		        (<Component___subRoute
		            RootQuery={RootQuery$data}
		            RootQuery$handle={RootQuery$handle}
		            SubQuery={SubQuery$data}
		            SubQuery$handle={SubQuery$handle}>
		            {children}
		        </Component___subRoute>)
		    );
		};
	`)
})

function mockView(deps: string[]) {
	return `export default ({ ${deps.join(', ')} }) => <div>hello</div>`
}

function mockQuery(name: string, loading?: boolean) {
	return `
query ${name} ${loading ? '@loading' : ''} {
	id
}
	`
}
