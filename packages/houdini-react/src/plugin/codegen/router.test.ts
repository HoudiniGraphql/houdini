import { fs } from 'houdini'
import { test, expect } from 'vitest'

import { test_config } from '../config'
import { load_manifest } from './manifest'
import { format_router_manifest } from './router'

const importStatement = (where: string, as: string) => `import ${as} from '${where}'`

const exportDefaultStatement = (as: string) => `export default ${as}`

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
					'+page.gql': mockQuery('FinalQuery', true),
					'+page.tsx': mockView(['FinalQuery']),
				},
			},
			another: {
				'+layout.tsx': mockView(['RootQuery']),
				'+page.gql': mockQuery('MyQuery'),
				'+layout.gql': mockQuery('MyLayoutQuery', true),
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
						pages: {
					\\"__\\": {
						id: \\"__\\",
						pattern: /^\\\\/$/,
						params: [],

					
						documents: {
							RootQuery: {
										artifact: () => import(\\"../../../artifacts/RootQuery\\"),
										loading: false
									}
						},

						component: () => import(\\"../entries/__\\")
					},

					\\"____id__\\": {
						id: \\"____id__\\",
						pattern: /^\\\\/([^/]+?)\\\\/?$/,
						params: [{\\"name\\":\\"id\\",\\"optional\\":false,\\"rest\\":false,\\"chained\\":false}],

					
						documents: {
							SubQuery: {
										artifact: () => import(\\"../../../artifacts/SubQuery\\"),
										loading: false
									},
							RootQuery: {
										artifact: () => import(\\"../../../artifacts/RootQuery\\"),
										loading: false
									}
						},

						component: () => import(\\"../entries/____id__\\")
					},

					\\"__another\\": {
						id: \\"__another\\",
						pattern: /^\\\\/another\\\\/?$/,
						params: [],

					
						documents: {
							MyQuery: {
										artifact: () => import(\\"../../../artifacts/MyQuery\\"),
										loading: false
									},
							MyLayoutQuery: {
										artifact: () => import(\\"../../../artifacts/MyLayoutQuery\\"),
										loading: true
									},
							RootQuery: {
										artifact: () => import(\\"../../../artifacts/RootQuery\\"),
										loading: false
									}
						},

						component: () => import(\\"../entries/__another\\")
					},

					\\"____id____nested\\": {
						id: \\"____id____nested\\",
						pattern: /^\\\\/([^/]+?)\\\\/nested\\\\/?$/,
						params: [{\\"name\\":\\"id\\",\\"optional\\":false,\\"rest\\":false,\\"chained\\":false}],

					
						documents: {
							FinalQuery: {
										artifact: () => import(\\"../../../artifacts/FinalQuery\\"),
										loading: true
									},
							RootQuery: {
										artifact: () => import(\\"../../../artifacts/RootQuery\\"),
										loading: false
									}
						},

						component: () => import(\\"../entries/____id____nested\\")
					},
				},

				layouts: {
					\\"__\\": {
						id: \\"__\\",

						queries: [],
					},
					\\"____id__\\": {
						id: \\"____id__\\",

						queries: [\\"RootQuery\\"],
					},
					\\"__another\\": {
						id: \\"__another\\",

						queries: [\\"RootQuery\\"],
					}
				}
			}"
		`)
})

test('loading state at root', async function () {
	const config = await test_config()

	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			'+layout.tsx': 'export default ({children}) => <div>{children}</div>',
			'+layout.gql': mockQuery('RootQuery', true),
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
						pages: {
					\\"__\\": {
						id: \\"__\\",
						pattern: /^\\\\/$/,
						params: [],

					
						documents: {
							RootQuery: {
										artifact: () => import(\\"../../../artifacts/RootQuery\\"),
										loading: true
									}
						},

						component: () => import(\\"../entries/__\\")
					},

					\\"____id__\\": {
						id: \\"____id__\\",
						pattern: /^\\\\/([^/]+?)\\\\/?$/,
						params: [{\\"name\\":\\"id\\",\\"optional\\":false,\\"rest\\":false,\\"chained\\":false}],

					
						documents: {
							SubQuery: {
										artifact: () => import(\\"../../../artifacts/SubQuery\\"),
										loading: false
									},
							RootQuery: {
										artifact: () => import(\\"../../../artifacts/RootQuery\\"),
										loading: true
									}
						},

						component: () => import(\\"../entries/____id__\\")
					},

					\\"__another\\": {
						id: \\"__another\\",
						pattern: /^\\\\/another\\\\/?$/,
						params: [],

					
						documents: {
							MyQuery: {
										artifact: () => import(\\"../../../artifacts/MyQuery\\"),
										loading: false
									},
							MyLayoutQuery: {
										artifact: () => import(\\"../../../artifacts/MyLayoutQuery\\"),
										loading: false
									},
							RootQuery: {
										artifact: () => import(\\"../../../artifacts/RootQuery\\"),
										loading: true
									}
						},

						component: () => import(\\"../entries/__another\\")
					},

					\\"____id____nested\\": {
						id: \\"____id____nested\\",
						pattern: /^\\\\/([^/]+?)\\\\/nested\\\\/?$/,
						params: [{\\"name\\":\\"id\\",\\"optional\\":false,\\"rest\\":false,\\"chained\\":false}],

					
						documents: {
							FinalQuery: {
										artifact: () => import(\\"../../../artifacts/FinalQuery\\"),
										loading: false
									},
							RootQuery: {
										artifact: () => import(\\"../../../artifacts/RootQuery\\"),
										loading: true
									}
						},

						component: () => import(\\"../entries/____id____nested\\")
					},
				},

				layouts: {
					\\"__\\": {
						id: \\"__\\",

						queries: [],
					},
					\\"____id__\\": {
						id: \\"____id__\\",

						queries: [\\"RootQuery\\"],
					},
					\\"__another\\": {
						id: \\"__another\\",

						queries: [\\"RootQuery\\"],
					}
				}
			}"
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
