import { fs, parseJS, routerConventions, load_manifest } from 'houdini'
import { test, expect } from 'vitest'

import { test_config } from '../../config'
import { generate_entries } from '../entries'

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
	await generate_entries({ config, manifest, documents: [], componentFields: [] })

	const page_entry = await parseJS(
		(await fs.readFile(
			routerConventions.page_entry_path(config, Object.keys(manifest.pages)[0])
		)) ?? '',
		{ plugins: ['jsx'] }
	)
	expect(page_entry).toMatchInlineSnapshot(`
		import Layout__ from "../layouts/_.jsx";
		import Layout__subRoute from "../layouts/_subRoute.jsx";
		import Page__subRoute_nested from "../pages/_subRoute_nested.jsx";
		import client from "$houdini/plugins/houdini-react/runtime/client";
		import PageFallback__subRoute_nested from "../fallbacks/page/_subRoute_nested.jsx";
		import LayoutFallback__subRoute_nested from "../../fallbacks/layout";

		export default (
		    {
		        url
		    }
		) => {
		    return (
		        (<LayoutFallback__subRoute_nested key={url}>
		            <Layout__ key={url}>
		                <Layout__subRoute key={url}>
		                    <PageFallback__subRoute_nested key={url}>
		                        <Page__subRoute_nested />
		                    </PageFallback__subRoute_nested>
		                </Layout__subRoute>
		            </Layout__>
		        </LayoutFallback__subRoute_nested>)
		    );
		};
	`)

	const page_unit = await parseJS(
		(await fs.readFile(
			routerConventions.page_unit_path(config, Object.keys(manifest.pages)[0])
		)) ?? '',
		{
			plugins: ['jsx'],
		}
	)
	expect(page_unit).toMatchInlineSnapshot(`
		import { useQueryResult, PageContextProvider } from "$houdini/plugins/houdini-react/runtime/routing";
		import Component__subRoute_nested from "../../../../../src/routes/subRoute/nested/+page";

		export default (
		    {
		        children
		    }
		) => {
		    const [FinalQuery$data, FinalQuery$handle] = useQueryResult("FinalQuery");

		    return (
		        (<PageContextProvider keys={[]}>
		            <Component__subRoute_nested FinalQuery={FinalQuery$data} FinalQuery$handle={FinalQuery$handle}>
		                {children}
		            </Component__subRoute_nested>
		        </PageContextProvider>)
		    );
		};
	`)

	const root_layout_unit = await parseJS(
		(await fs.readFile(
			routerConventions.layout_unit_path(config, Object.keys(manifest.layouts)[0])
		)) ?? '',
		{
			plugins: ['jsx'],
		}
	)
	expect(root_layout_unit).toMatchInlineSnapshot(`
		import { useQueryResult, PageContextProvider } from "$houdini/plugins/houdini-react/runtime/routing";
		import Component__ from "../../../../../src/routes/+layout";

		export default (
		    {
		        children
		    }
		) => {
		    return (
		        (<PageContextProvider keys={[]}>
		            <Component__>
		                {children}
		            </Component__>
		        </PageContextProvider>)
		    );
		};
	`)

	const deep_layout_unit = await parseJS(
		(await fs.readFile(
			routerConventions.layout_unit_path(config, Object.keys(manifest.layouts)[1])
		)) ?? '',
		{
			plugins: ['jsx'],
		}
	)
	expect(deep_layout_unit).toMatchInlineSnapshot(`
		import { useQueryResult, PageContextProvider } from "$houdini/plugins/houdini-react/runtime/routing";
		import Component__subRoute from "../../../../src/routes/subRoute/+layout";

		export default (
		    {
		        children
		    }
		) => {
		    const [RootQuery$data, RootQuery$handle] = useQueryResult("RootQuery");
		    const [SubQuery$data, SubQuery$handle] = useQueryResult("SubQuery");

		    return (
		        (<PageContextProvider keys={[]}>
		            <Component__subRoute
		                RootQuery={RootQuery$data}
		                RootQuery$handle={RootQuery$handle}
		                SubQuery={SubQuery$data}
		                SubQuery$handle={SubQuery$handle}>
		                {children}
		            </Component__subRoute>
		        </PageContextProvider>)
		    );
		};
	`)

	// make sure we generated the fallback units
	const page_fallback = await parseJS(
		(await fs.readFile(
			routerConventions.fallback_unit_path(config, 'page', Object.keys(manifest.pages)[0])
		)) ?? '',
		{
			plugins: ['jsx'],
		}
	)
	expect(page_fallback).toMatchInlineSnapshot(`
		import { useRouterContext, useCache, useQueryResult } from "$houdini/plugins/houdini-react/runtime/routing/Router";
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
			routerConventions.fallback_unit_path(config, 'layout', Object.keys(manifest.layouts)[0])
		)) ?? '',
		{
			plugins: ['jsx'],
		}
	)
	expect(layout_fallback).toMatchInlineSnapshot(`
		import { useRouterContext, useCache, useQueryResult } from "$houdini/plugins/houdini-react/runtime/routing/Router";
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

test('layout with params', async function () {
	const config = await test_config()

	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			'[id]': {
				'+page.gql': 'query RootQuery($id: ID!) { node(id: $id) { id } }',
				'+page.tsx': 'export default function({ RootQuery}) { return "hello" }',
			},
		},
	})
	// generate the manifest
	const manifest = await load_manifest({ config })

	// generate the bundle for the nested page
	await generate_entries({ config, manifest, documents: [], componentFields: [] })

	const page_entry = await parseJS(
		(await fs.readFile(
			routerConventions.page_unit_path(config, Object.keys(manifest.pages)[0])
		)) ?? '',
		{ plugins: ['jsx'] }
	)
	expect(page_entry).toMatchInlineSnapshot(`
		import { useQueryResult, PageContextProvider } from "$houdini/plugins/houdini-react/runtime/routing";
		import Component___id_ from "../../../../../src/routes/[id]/+page";

		export default (
		    {
		        children
		    }
		) => {
		    const [RootQuery$data, RootQuery$handle] = useQueryResult("RootQuery");

		    return (
		        (<PageContextProvider keys={["id"]}>
		            <Component___id_ RootQuery={RootQuery$data} RootQuery$handle={RootQuery$handle}>
		                {children}
		            </Component___id_>
		        </PageContextProvider>)
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
