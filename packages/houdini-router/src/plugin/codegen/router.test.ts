import { fs } from 'houdini'
import { test, expect } from 'vitest'

import { test_config } from '../config'
import { load_manifest } from './manifest'
import { format_router_manifest } from './router'

const importStatement = (where: string, as: string) => `import ${as} from '${where}'`

const exportDefaultStatement = (as: string) => `export default ${as}`

const exportStarStatement = (where: string) => `export * from '${where}'`

test('happy path', async function () {
	const config = await test_config()

	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			'+layout.tsx': 'export default ({children}) => <div>{children}</div>',
			'+layout.gql': mockQuery('RootQuery'),
			'+page.tsx': mockView(['RootQuery']),
			'[id]': {
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

	expect(format_router_manifest({ config, manifest, exportDefaultStatement, importStatement }))
		.toMatchInlineSnapshot(`
			"export default {
				\\"__\\": {
					id: \\"__\\",
					pattern: /^\\\\/$/,
					params: [],

					required_queries: [],
					
					
					queries: {
						RootQuery: () => import(\\"../../../artifacts/RootQuery\\")
					},

					component: () => import(\\"../bundles/pages/__/component\\")
				},

				\\"__[id]\\": {
					id: \\"__[id]\\",
					pattern: /^\\\\/([^/]+?)\\\\/?$/,
					params: [{\\"name\\":\\"id\\",\\"optional\\":false,\\"rest\\":false,\\"chained\\":false}],

					required_queries: [],
					
					
					queries: {
						SubQuery: () => import(\\"../../../artifacts/SubQuery\\"),
						RootQuery: () => import(\\"../../../artifacts/RootQuery\\")
					},

					component: () => import(\\"../bundles/pages/__[id]/component\\")
				},

				\\"__another\\": {
					id: \\"__another\\",
					pattern: /^\\\\/another\\\\/?$/,
					params: [],

					required_queries: [],
					
					
					queries: {
						MyQuery: () => import(\\"../../../artifacts/MyQuery\\"),
						MyLayoutQuery: () => import(\\"../../../artifacts/MyLayoutQuery\\")
					},

					component: () => import(\\"../bundles/pages/__another/component\\")
				},

				\\"__[id]__nested\\": {
					id: \\"__[id]__nested\\",
					pattern: /^\\\\/([^/]+?)\\\\/nested\\\\/?$/,
					params: [{\\"name\\":\\"id\\",\\"optional\\":false,\\"rest\\":false,\\"chained\\":false}],

					required_queries: [],
					
					
					queries: {
						FinalQuery: () => import(\\"../../../artifacts/FinalQuery\\")
					},

					component: () => import(\\"../bundles/pages/__[id]__nested/component\\")
				},
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
