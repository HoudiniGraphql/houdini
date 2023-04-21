import { fs } from 'houdini'
import { test, expect } from 'vitest'

import { test_config } from '../config'
import { load_manifest } from './manifest'
import { print_router_manifest } from './router'

test('happy path', async function () {
	const config = await test_config()

	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			'+layout.tsx': 'export default ({children}) => <div>{children}</div>',
			'+layout.gql': mockQuery('RootQuery'),
			'+page.tsx': mockView(['RootQuery']),
			subRoute: {
				'+layout.tsx': mockView(['RootQuery']),
				'+layout.gql': mockQuery('SubQuery'),
				'+page.tsx': mockView(['SubQuery', 'RootQuery']),
				nested: {
					'+page.gql': mockQuery('FinalQuery'),
					'+page.tsx': mockView(['FinalQuery']),
				},
			},
			another: {
				'+layout.tsx': mockView(['RootQuery']),
				'+page.gql': mockQuery('MyQuery'),
				'+layout.gql': mockQuery('MyLayoutQuery'),
				'+page.tsx': mockView(['MyQuery', 'MyLayoutQuery']),
			},
		},
	})

	const manifest = await load_manifest({
		config,
	})

	expect(print_router_manifest({ config, manifest })).toMatchInlineSnapshot(`
		"\\"\\"__\\"\\": {
				id: \\"__\\",

				pattern: /^\\\\/$/,
				params: [],

				required_queries: [],

				load_query: {

				},
				load_artifact: {

				},

				load_component: () => import(\\"./\\")
			}
		}
		\\"\\"__subRoute\\"\\": {
				id: \\"__subRoute\\",

				pattern: /^\\\\/subRoute\\\\/?$/,
				params: [],

				required_queries: [],

				load_query: {

				},
				load_artifact: {

				},

				load_component: () => import(\\"./\\")
			}
		}
		\\"\\"__another\\"\\": {
				id: \\"__another\\",

				pattern: /^\\\\/another\\\\/?$/,
				params: [],

				required_queries: [],

				load_query: {

				},
				load_artifact: {

				},

				load_component: () => import(\\"./\\")
			}
		}
		\\"\\"__subRoute__nested\\"\\": {
				id: \\"__subRoute__nested\\",

				pattern: /^\\\\/subRoute\\\\/nested\\\\/?$/,
				params: [],

				required_queries: [],

				load_query: {

				},
				load_artifact: {

				},

				load_component: () => import(\\"./\\")
			}
		}"
	`)
})

function mockView(deps: string[]) {
	return `export default ({ ${deps.join(', ')} }) => <div>hello</div>`
}

function mockQuery(name: string) {
	return `
query ${name} {
	id
}
	`
}
