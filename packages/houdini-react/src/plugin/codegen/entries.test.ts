import { fs, parseJS } from 'houdini'
import { test, expect } from 'vitest'

import { test_config } from '../config'
import {
	page_entry_path,
	page_unit_path,
	layout_unit_path,
	fallback_unit_path,
} from '../conventions'
import { generate_entries } from './entries'
import { load_manifest } from './manifest'

test('composes layouts and pages', async function () {
	const config = await test_config()

	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			'+layout.tsx': 'export default ({children}) => <div>{children}</div>',
			'+layout.gql': mockQuery('RootQuery', true),
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

	const page_entry = await parseJS(
		(await fs.readFile(page_entry_path(config, Object.keys(manifest.pages)[0]))) ?? '',
		{ plugins: ['jsx'] }
	)
	expect(page_entry).toMatchInlineSnapshot(`
		import Layout___ from "../layouts/__.jsx";
		import Layout___subRoute from "../layouts/__subRoute.jsx";
		import Page___subRoute__nested from "../pages/__subRoute__nested.jsx";
		import PageFallback___subRoute__nested from "../fallbacks/page/__subRoute__nested.jsx";
		import LayoutFallback___subRoute__nested from "../../fallbacks/layout";

		export default () => (<LayoutFallback___subRoute__nested>
		    <Layout___>
		        <Layout___subRoute>
		            <PageFallback___subRoute__nested>
		                <Page___subRoute__nested />
		            </PageFallback___subRoute__nested>
		        </Layout___subRoute>
		    </Layout___>
		</LayoutFallback___subRoute__nested>);
	`)

	const page_unit = await parseJS(
		(await fs.readFile(page_unit_path(config, Object.keys(manifest.pages)[0]))) ?? '',
		{
			plugins: ['jsx'],
		}
	)
	expect(page_unit).toMatchInlineSnapshot(`
		import { useDocumentStore } from "$houdini/plugins/houdini-react/runtime/routing/components/Router";
		import Component___subRoute__nested from "../../../../../src/routes/subRoute/nested/+page";

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

	const root_layout_unit = await parseJS(
		(await fs.readFile(layout_unit_path(config, Object.keys(manifest.layouts)[0]))) ?? '',
		{
			plugins: ['jsx'],
		}
	)
	expect(root_layout_unit).toMatchInlineSnapshot(`
		import { useDocumentStore } from "$houdini/plugins/houdini-react/runtime/routing/components/Router";
		import Component___ from "../../../../../src/routes/+layout";

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

	const deep_layout_unit = await parseJS(
		(await fs.readFile(layout_unit_path(config, Object.keys(manifest.layouts)[1]))) ?? '',
		{
			plugins: ['jsx'],
		}
	)
	expect(deep_layout_unit).toMatchInlineSnapshot(`
		import { useDocumentStore } from "$houdini/plugins/houdini-react/runtime/routing/components/Router";
		import Component___subRoute from "../../../../../src/routes/subRoute/+layout";

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

	// make sure we generated the fallback units
	const page_fallback = await parseJS(
		(await fs.readFile(fallback_unit_path(config, 'page', Object.keys(manifest.pages)[0]))) ??
			'',
		{
			plugins: ['jsx'],
		}
	)
	expect(page_fallback).toMatchInlineSnapshot(`
		import { useRouterContext, useCache, useDocumentStore } from "$houdini/plugins/houdini-react/runtime/routing/components/Router";
		import Component from "../../../../../src/routes/subRoute/nested/+page";
		import { Suspense } from "react";

		export default (
		    {
		        children
		    }
		) => {
		    const {
		        artifact_cache
		    } = useRouterContext();

		    const FinalQuery_artifact = artifact_cache.get("FinalQuery");

		    return (
		        (<Suspense
		            fallback={<Fallback
		                required_queries={{}}
		                loading_queries={{
		                    FinalQuery: FinalQuery_artifact
		                }} />}>
		            {children}
		        </Suspense>)
		    );
		};

		const Fallback = (
		    {
		        required_queries,
		        loading_queries
		    }
		) => {
		    const cache = useCache();

		    let props = Object.entries(loading_queries).reduce((prev, [name, artifact]) => ({
		        ...prev,

		        [name]: cache.read({
		            selection: artifact.selection,
		            loading: true
		        }).data
		    }), required_queries);

		    return <Component {...props} />;
		};
	`)
	const layout_fallback = await parseJS(
		(await fs.readFile(
			fallback_unit_path(config, 'layout', Object.keys(manifest.layouts)[0])
		)) ?? '',
		{
			plugins: ['jsx'],
		}
	)
	expect(layout_fallback).toMatchInlineSnapshot(`
		import { useRouterContext, useCache, useDocumentStore } from "$houdini/plugins/houdini-react/runtime/routing/components/Router";
		import Component from "../../../../../src/routes/+layout";
		import { Suspense } from "react";

		export default (
		    {
		        children
		    }
		) => {
		    const {
		        artifact_cache
		    } = useRouterContext();

		    return (
		        (<Suspense fallback={<Fallback required_queries={{}} loading_queries={{}} />}>
		            {children}
		        </Suspense>)
		    );
		};

		const Fallback = (
		    {
		        required_queries,
		        loading_queries
		    }
		) => {
		    const cache = useCache();

		    let props = Object.entries(loading_queries).reduce((prev, [name, artifact]) => ({
		        ...prev,

		        [name]: cache.read({
		            selection: artifact.selection,
		            loading: true
		        }).data
		    }), required_queries);

		    return <Component {...props} />;
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
