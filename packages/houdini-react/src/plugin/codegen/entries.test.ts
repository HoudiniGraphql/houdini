import { fs, parseJS, routerConventions, load_manifest } from 'houdini'
import { test, expect } from 'vitest'

import { test_config } from '../config'
import { generate_entries } from './entries'

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
		(await fs.readFile(
			routerConventions.page_entry_path(config, Object.keys(manifest.pages)[0])
		)) ?? '',
		{ plugins: ['jsx'] }
	)
	expect(page_entry).toMatchInlineSnapshot(`
		import Layout__0 from "../layouts/_0.jsx";
		import Layout__0subRoute from "../layouts/_0subRoute.jsx";
		import Page__0subRoute_0nested from "../pages/_0subRoute_0nested.jsx";
		import PageFallback__0subRoute_0nested from "../fallbacks/page/_0subRoute_0nested.jsx";
		import LayoutFallback__0subRoute_0nested from "../../fallbacks/layout";

		export default (
		    {
		        url
		    }
		) => {
		    return (
		        (<LayoutFallback__0subRoute_0nested key={url}>
		            <Layout__0 key={url}>
		                <Layout__0subRoute key={url}>
		                    <PageFallback__0subRoute_0nested key={url}>
		                        <Page__0subRoute_0nested />
		                    </PageFallback__0subRoute_0nested>
		                </Layout__0subRoute>
		            </Layout__0>
		        </LayoutFallback__0subRoute_0nested>)
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
		import { useQueryResult } from "$houdini/plugins/houdini-react/runtime/routing/components/Router";
		import Component__0subRoute_0nested from "../../../../../src/routes/subRoute/nested/+page";

		export default (
		    {
		        children
		    }
		) => {
		    const [FinalQuery$data, FinalQuery$handle] = useQueryResult("FinalQuery");

		    return (
		        (<Component__0subRoute_0nested FinalQuery={FinalQuery$data} FinalQuery$handle={FinalQuery$handle}>
		            {children}
		        </Component__0subRoute_0nested>)
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
		import { useQueryResult } from "$houdini/plugins/houdini-react/runtime/routing/components/Router";
		import Component__0 from "../../../../../src/routes/+layout";

		export default (
		    {
		        children
		    }
		) => {
		    return (
		        (<Component__0>
		            {children}
		        </Component__0>)
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
		import { useQueryResult } from "$houdini/plugins/houdini-react/runtime/routing/components/Router";
		import Component__0subRoute from "../../../../../src/routes/subRoute/+layout";

		export default (
		    {
		        children
		    }
		) => {
		    const [RootQuery$data, RootQuery$handle] = useQueryResult("RootQuery");
		    const [SubQuery$data, SubQuery$handle] = useQueryResult("SubQuery");

		    return (
		        (<Component__0subRoute
		            RootQuery={RootQuery$data}
		            RootQuery$handle={RootQuery$handle}
		            SubQuery={SubQuery$data}
		            SubQuery$handle={SubQuery$handle}>
		            {children}
		        </Component__0subRoute>)
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
		import { useRouterContext, useCache, useQueryResult } from "$houdini/plugins/houdini-react/runtime/routing/components/Router";
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
		import { useRouterContext, useCache, useQueryResult } from "$houdini/plugins/houdini-react/runtime/routing/components/Router";
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
