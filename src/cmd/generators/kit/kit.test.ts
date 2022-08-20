import path from 'path'
import { test, expect } from 'vitest'

import { parseJS, testConfig } from '../../../common'
import * as fs from '../../../common/fs'
import { runPipeline } from '../../generate'

const config = testConfig()

test('generates types for inline queries', async function () {
	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			myProfile: {
				'+page.svelte': `
<script>
    import { query, graphql } from '$houdini'

    const result = query(graphql\`query MyInlineQuery { viewer { id } } \`)
</script>
`,
			},
		},
	})

	// execute the generator
	await runPipeline(config, [])

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(path.join(config.typeRouteDir, 'myProfile', '$houdini.d.ts'))
	)
	expect(queryContents).toBeTruthy()

	const parsedQuery = (await parseJS(queryContents!))?.script
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import type { VariableFunction, AfterLoadFunction, BeforeLoadFunction } from "../../../../runtime/lib/types";
		import type { PageLoad, PageData as KitPageData } from "./$types";
		import { MyInlineQuery$result, MyInlineQuery$input } from "../../../../artifacts/MyInlineQuery";
		type Params = PageLoad extends Kit.Load<infer X, infer Y, infer Z>["LayoutData"] ? X : never;

		export type PageData = {
		    MyInlineQuery: MyInlineQuery$result
		};

		type AfterLoadInput = {};
		export type AfterLoad = AfterLoadFunction<Params, PageData, AfterLoadInput>;
		export type BeforeLoad = BeforeLoadFunction<Params>;
	`)
})

test('generates types for page queries', async function () {
	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			myProfile: {
				'+page.gql': `
query MyPageQuery { 
    viewer { 
        id
    }
}
`,
			},
		},
	})

	// execute the generator
	await runPipeline(config, [])

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(path.join(config.typeRouteDir, 'myProfile', '$houdini.d.ts'))
	)
	expect(queryContents).toBeTruthy()

	const parsedQuery = (await parseJS(queryContents!))?.script
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import type { VariableFunction, AfterLoadFunction, BeforeLoadFunction } from "../../../../runtime/lib/types";
		import type { PageLoad, PageData as KitPageData } from "./$types";
		import { MyPageQuery$result, MyPageQuery$input } from "../../../../artifacts/MyPageQuery";
		type Params = PageLoad extends Kit.Load<infer X, infer Y, infer Z>["LayoutData"] ? X : never;

		export type PageData = {
		    MyPageQuery: MyPageQuery$result
		};

		type AfterLoadInput = {};
		export type AfterLoad = AfterLoadFunction<Params, PageData, AfterLoadInput>;
		export type BeforeLoad = BeforeLoadFunction<Params>;
	`)
})

test('generates types for after load', async function () {
	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			myProfile: {
				'+page.js': `
                    import { graphql } from '$houdini'

                    const store1 = graphql\`query MyPageLoad1Query($id: ID!) { 
                        viewer(id: $id) { 
                            id
                        }
                    }\`

                    const store2 = graphql\`query MyPageLoad2Query { 
                        viewer { 
                            id
                        }
                    }\`

                    export const houdini_load = [ store1, store2 ]

                    export function afterLoad() {
                        return { 
                            hello: 'world'
                        }
                    }
                `,
			},
		},
	})

	// execute the generator
	await runPipeline(config, [])

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(config.typeRouteDir, 'myProfile', '$houdini.d.ts')
	)
	expect(queryContents).toBeTruthy()

	// verify contents
	expect((await parseJS(queryContents!))?.script).toMatchInlineSnapshot(`
		import type { VariableFunction, AfterLoadFunction, BeforeLoadFunction } from "../../../../runtime/lib/types";
		import type { PageLoad, PageData as KitPageData } from "./$types";
		import { afterLoad } from "../../../../../../src/routes/myProfile/+page.ts";
		import { MyPageLoad1Query$result, MyPageLoad1Query$input } from "../../../../artifacts/MyPageLoad1Query";
		import { MyPageLoad2Query$result, MyPageLoad2Query$input } from "../../../../artifacts/MyPageLoad2Query";
		type Params = PageLoad extends Kit.Load<infer X, infer Y, infer Z>["LayoutData"] ? X : never;
		export type MyPageLoad1QueryVariables = VariableFunction<Params, MyPageLoad1Query$input>;

		export type PageData = {
		    MyPageLoad1Query: MyPageLoad1Query$result,
		    MyPageLoad2Query: MyPageLoad2Query$result
		} & ReturnType<typeof afterLoad>;

		type AfterLoadInput = {
		    MyPageLoad1Query: MyPageLoad1Query$input
		};

		export type AfterLoad = AfterLoadFunction<Params, PageData, AfterLoadInput>;
		export type BeforeLoad = BeforeLoadFunction<Params>;
	`)
})
