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
		import type * as Kit from "@sveltejs/kit";
		import type { VariableFunction, AfterLoadFunction, BeforeLoadFunction } from "../../../../runtime/lib/types";
		import type { PageLoadEvent, PageData as KitPageData } from "./$types";
		import { MyInlineQuery$result, MyInlineQuery$input } from "../../../../artifacts/MyInlineQuery";
		import { MyInlineQueryStore } from "../../../../stores/MyInlineQuery";
		type Params = PageLoadEvent["params"];

		export type PageData = {
		    MyInlineQuery: MyInlineQueryStore
		};
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
		import type * as Kit from "@sveltejs/kit";
		import type { VariableFunction, AfterLoadFunction, BeforeLoadFunction } from "../../../../runtime/lib/types";
		import type { PageLoadEvent, PageData as KitPageData } from "./$types";
		import { MyPageQuery$result, MyPageQuery$input } from "../../../../artifacts/MyPageQuery";
		import { MyPageQueryStore } from "../../../../stores/MyPageQuery";
		type Params = PageLoadEvent["params"];

		export type PageData = {
		    MyPageQuery: MyPageQueryStore
		};
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
		import type * as Kit from "@sveltejs/kit";
		import type { VariableFunction, AfterLoadFunction, BeforeLoadFunction } from "../../../../runtime/lib/types";
		import type { PageLoadEvent, PageData as KitPageData } from "./$types";
		import { MyPageLoad1Query$result, MyPageLoad1Query$input } from "../../../../artifacts/MyPageLoad1Query";
		import { MyPageLoad1QueryStore } from "../../../../stores/MyPageLoad1Query";
		import { MyPageLoad2Query$result, MyPageLoad2Query$input } from "../../../../artifacts/MyPageLoad2Query";
		import { MyPageLoad2QueryStore } from "../../../../stores/MyPageLoad2Query";
		type Params = PageLoadEvent["params"];
		export type MyPageLoad1QueryVariables = VariableFunction<Params, MyPageLoad1Query$input>;
		type AfterLoadReturn = ReturnType<typeof import("./+page").afterLoad>;

		type AfterLoadData = {
		    MyPageLoad1Query: MyPageLoad1Query$result,
		    MyPageLoad2Query: MyPageLoad2Query$result
		};

		type AfterLoadInput = {
		    MyPageLoad1Query: MyPageLoad1Query$input
		};

		export type AfterLoadEvent = {
		    event: LoadEvent,
		    data: AfterLoadData,
		    input: AfterLoadInput
		};

		export type AfterLoad = AfterLoadFunction<Params, AfterLoadData, AfterLoadInput>;

		export type PageData = {
		    MyPageLoad1Query: MyPageLoad1QueryStore,
		    MyPageLoad2Query: MyPageLoad2QueryStore
		} & AfterLoadReturn;
	`)
})
