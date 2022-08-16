import path from 'path'
import { test, expect } from 'vitest'

import { testConfig } from '../../../common'
import * as fs from '../../../common/fs'
import { runPipeline } from '../../generate'

// create a config we can test against
const config = testConfig()

test('typedefs for inline queries without variables', async function () {
	// the path of the route page (relative to routes Dir)
	const routeRelative = 'myProfile/+page.svelte'
	await fs.mkdirp(path.join(config.routesDir, 'myProfile'))

	// write a file with an inline query
	await fs.writeFile(
		path.join(config.routesDir, routeRelative),
		`
			<script>
				const { data  } = graphql\`
					query Foo {
						viewer {
							id
						}
					}
				\`
			</script>
        `
	)

	// execute the generator
	await runPipeline(config, [])

	expect(await fs.readFile(path.join(config.typeRouteDir, 'myProfile', config.typeRootFile)))
		.toMatchJavascriptSnapshot(`
 import type { VariableFunction, AfterLoadFunction, BeforeLoadFunction } from "../../../../runtime/lib/types";
 import { Params } from "./$types";
 import { Foo$result, Foo$input } from "../../../../artifacts/Foo";
 
 type AfterLoadData = {
     Foo: Foo$result
 };

 type AfterLoadInput = {};
 export type AfterLoad = AfterLoadFunction<Params, AfterLoadData, AfterLoadInput>;
 export type BeforeLoad = BeforeLoadFunction<Params>;
`)
})

test('typedefs for inline queries with variables', async function () {
	// the path of the route page (relative to routes Dir)
	const routeRelative = 'myProfile/+page.svelte'
	await fs.mkdirp(path.join(config.routesDir, 'myProfile'))

	// write a file with an inline query
	await fs.writeFile(
		path.join(config.routesDir, routeRelative),
		`
			<script>
				const { data  } = graphql\`
					query Foo($input: Input) {
						viewer(input: $input) {
							id
						}
					}
				\`
			</script>
        `
	)

	// execute the generator
	await runPipeline(config, [])

	expect(await fs.readFile(path.join(config.typeRouteDir, 'myProfile', config.typeRootFile)))
		.toMatchJavascriptSnapshot(`
 import type { VariableFunction, AfterLoadFunction, BeforeLoadFunction } from "../../../../runtime/lib/types";
 import { Params } from "./$types";
 import { Foo$result, Foo$input } from "../../../../artifacts/Foo";
 export type FooVariables = VariableFunction<Params, Foo$input>;

 type AfterLoadData = {
     Foo: Foo$result
 };

 type AfterLoadInput = {
     Foo: Foo$input
 };

 export type AfterLoad = AfterLoadFunction<Params, AfterLoadData, AfterLoadInput>;
 export type BeforeLoad = BeforeLoadFunction<Params>;
`)
})
