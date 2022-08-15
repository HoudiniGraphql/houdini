import path from 'path'
import { test, expect } from 'vitest'

import { testConfig } from '../../../common'
import * as fs from '../../../common/fs'
import { runPipeline } from '../../generate'

// create a config we can test against
const config = testConfig()

test('generates variables and hook definitions for inline queries', async function () {
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

	expect(fs.readFile(path.join(config.typeRouteDir, routeRelative))).toMatchInlineSnapshot(``)
})
