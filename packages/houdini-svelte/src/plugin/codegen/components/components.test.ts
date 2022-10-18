import { parseJS, fs } from 'houdini'
import { testConfig } from 'houdini/test'
import path from 'path'
import { test, expect } from 'vitest'

import generate from '..'

const config = testConfig()
const plugin_root = config.pluginDirectory('test-plugin')

test('generates type defintions for non-route components in their local ./$houdini', async function () {
	const component_dir = path.join(process.cwd(), 'src', 'lib', 'foo.svelte')

	await fs.mock({
		[component_dir]: `
            <script>
                import { query, graphql } from '$houdini'

                const result = query(graphql\`query MyInlineQuery2 { viewer { id } } \`)
            </script>
        `,
	})

	// execute the generator
	await generate({ config, documents: [], framework: 'kit', plugin_root })

	// load the contents of the file
	const typedef = await fs.readFile(
		path.join(path.join(config.typeRootDir, 'src', 'lib', '$houdini.d.ts'))
	)
	expect(typedef).toBeTruthy()

	const parsedQuery = (await parseJS(typedef!))?.script
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import type * as Kit from "@sveltejs/kit";
		import type { VariableFunction, AfterLoadFunction, BeforeLoadFunction } from "../../../plugins/houdini-svelte/runtime/types";
		import type { PageLoadEvent, PageData as KitPageData } from "./$types";
		import { MyInlineQuery2$result, MyInlineQuery2$input } from "../../../artifacts/MyInlineQuery2";
		import { MyInlineQuery2Store } from "../../../stores/MyInlineQuery2";
		type PageParams = PageLoadEvent["params"];

		export type PageData = {
		    MyInlineQuery2: MyInlineQuery2Store
		};a
	`)
})
