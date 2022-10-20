import { parseJS, fs, path } from 'houdini'
import { testConfig } from 'houdini/test'
import { test, expect } from 'vitest'

import generate from '..'
import { type_route_dir } from '../../kit'

const config = testConfig()
const plugin_root = config.pluginDirectory('test-plugin')

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
	await generate({ config, documents: [], framework: 'kit', plugin_root })

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(path.join(type_route_dir(config), 'myProfile', '$houdini.d.ts'))
	)
	expect(queryContents).toBeTruthy()

	const parsedQuery = (await parseJS(queryContents!))?.script
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import type * as Kit from "@sveltejs/kit";
		import type { VariableFunction, AfterLoadFunction, BeforeLoadFunction } from "../../../../plugins/houdini-svelte/runtime/types";
		import type { PageLoadEvent, PageData as KitPageData } from "./$types";
		import { MyInlineQuery$result, MyInlineQuery$input } from "../../../../artifacts/MyInlineQuery";
		import { MyInlineQueryStore } from "../../../../stores/MyInlineQuery";
		type PageParams = PageLoadEvent["params"];

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
	await generate({ config, documents: [], framework: 'kit', plugin_root })

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(path.join(type_route_dir(config), 'myProfile', '$houdini.d.ts'))
	)
	expect(queryContents).toBeTruthy()

	const parsedQuery = (await parseJS(queryContents!))?.script
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import type * as Kit from "@sveltejs/kit";
		import type { VariableFunction, AfterLoadFunction, BeforeLoadFunction } from "../../../../plugins/houdini-svelte/runtime/types";
		import type { PageLoadEvent, PageData as KitPageData } from "./$types";
		import { MyPageQuery$result, MyPageQuery$input } from "../../../../artifacts/MyPageQuery";
		import { MyPageQueryStore } from "../../../../stores/MyPageQuery";
		type PageParams = PageLoadEvent["params"];

		export type PageData = {
		    MyPageQuery: MyPageQueryStore
		};
	`)
})

test('generates types for layout queries', async function () {
	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			myProfile: {
				'+layout.gql': `
query MyLayoutQuery { 
    viewer { 
        id
    }
}
`,
			},
		},
	})

	// execute the generator
	await generate({ config, documents: [], framework: 'kit', plugin_root })

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(path.join(type_route_dir(config), 'myProfile', '$houdini.d.ts'))
	)
	expect(queryContents).toBeTruthy()

	const parsedQuery = (await parseJS(queryContents!))?.script
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import type * as Kit from "@sveltejs/kit";
		import type { VariableFunction, AfterLoadFunction, BeforeLoadFunction } from "../../../../plugins/houdini-svelte/runtime/types";
		import type { LayoutLoadEvent, LayoutData as KitPageData } from "./$types";
		import { MyLayoutQuery$result, MyLayoutQuery$input } from "../../../../artifacts/MyLayoutQuery";
		import { MyLayoutQueryStore } from "../../../../stores/MyLayoutQuery";
		type LayoutParams = LayoutLoadEvent["params"];

		export type LayoutData = {
		    MyLayoutQuery: MyLayoutQueryStore
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
	await generate({ config, documents: [], framework: 'kit', plugin_root })

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(type_route_dir(config), 'myProfile', '$houdini.d.ts')
	)
	expect(queryContents).toBeTruthy()

	// verify contents
	expect((await parseJS(queryContents!))?.script).toMatchInlineSnapshot(`
		import type * as Kit from "@sveltejs/kit";
		import type { VariableFunction, AfterLoadFunction, BeforeLoadFunction } from "../../../../plugins/houdini-svelte/runtime/types";
		import type { PageLoadEvent, PageData as KitPageData } from "./$types";
		import { MyPageLoad1Query$result, MyPageLoad1Query$input } from "../../../../artifacts/MyPageLoad1Query";
		import { MyPageLoad1QueryStore } from "../../../../stores/MyPageLoad1Query";
		import { MyPageLoad2Query$result, MyPageLoad2Query$input } from "../../../../artifacts/MyPageLoad2Query";
		import { MyPageLoad2QueryStore } from "../../../../stores/MyPageLoad2Query";
		type PageParams = PageLoadEvent["params"];
		export type MyPageLoad1QueryVariables = VariableFunction<PageParams, MyPageLoad1Query$input>;
		type AfterLoadReturn = ReturnType<typeof import("./+page").afterLoad>;

		type AfterLoadData = {
		    MyPageLoad1Query: MyPageLoad1Query$result
		    MyPageLoad2Query: MyPageLoad2Query$result
		};

		type LoadInput = {
		    MyPageLoad1Query: MyPageLoad1Query$input
		};

		export type AfterLoadEvent = {
		    event: PageLoadEvent
		    data: AfterLoadData
		    input: LoadInput
		};

		export type PageData = {
		    MyPageLoad1Query: MyPageLoad1QueryStore
		    MyPageLoad2Query: MyPageLoad2QueryStore
		} & AfterLoadReturn;
	`)
})

test('generates types for onError', async function () {
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

                    export function onError() {
                        return {
                            hello: 'world'
                        }
                    }
                `,
			},
		},
	})

	// execute the generator
	await generate({ config, documents: [], framework: 'kit', plugin_root })

	// load the contents of the file
	const queryContents = await fs.readFile(
		path.join(type_route_dir(config), 'myProfile', '$houdini.d.ts')
	)
	expect(queryContents).toBeTruthy()

	// verify contents
	expect((await parseJS(queryContents!))?.script).toMatchInlineSnapshot(`
		import type * as Kit from "@sveltejs/kit";
		import type { VariableFunction, AfterLoadFunction, BeforeLoadFunction } from "../../../../plugins/houdini-svelte/runtime/types";
		import type { PageLoadEvent, PageData as KitPageData } from "./$types";
		import { MyPageLoad1Query$result, MyPageLoad1Query$input } from "../../../../artifacts/MyPageLoad1Query";
		import { MyPageLoad1QueryStore } from "../../../../stores/MyPageLoad1Query";
		import { MyPageLoad2Query$result, MyPageLoad2Query$input } from "../../../../artifacts/MyPageLoad2Query";
		import { MyPageLoad2QueryStore } from "../../../../stores/MyPageLoad2Query";
		type PageParams = PageLoadEvent["params"];
		export type MyPageLoad1QueryVariables = VariableFunction<PageParams, MyPageLoad1Query$input>;

		export type OnErrorEvent = {
		    event: LoadEvent
		    input: LoadInput
		    error: Error | Error[]
		};

		type OnErrorReturn = ReturnType<typeof import("./+page").onError>;

		export type PageData = {
		    MyPageLoad1Query: MyPageLoad1QueryStore
		    MyPageLoad2Query: MyPageLoad2QueryStore
		} & OnErrorReturn;
	`)
})
