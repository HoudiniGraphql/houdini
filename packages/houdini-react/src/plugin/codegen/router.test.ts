import { fs, load_manifest } from 'houdini'
import { test, expect } from 'vitest'

import { test_config } from '../config'
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
					'+page.gql': mockQuery('FinalQuery', { loading: true, variables: ['foo'] }),
					'+page.tsx': mockView(['FinalQuery']),
				},
			},
			another: {
				'+layout.tsx': mockView(['RootQuery']),
				'+page.gql': mockQuery('MyQuery'),
				'+layout.gql': mockQuery('MyLayoutQuery', { loading: true }),
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
					\\"_\\": {
						id: \\"_\\",
						pattern: /^\\\\/$/,
						params: [],

					
						documents: {
							RootQuery: {
										artifact: () => import(\\"../../../artifacts/RootQuery\\"),
										loading: false,
										variables: []
									}
						},

						component: () => import(\\"../units/entries/_\\")
					},

					\\"__id_\\": {
						id: \\"__id_\\",
						pattern: /^\\\\/([^/]+?)\\\\/?$/,
						params: [{\\"name\\":\\"id\\",\\"optional\\":false,\\"rest\\":false,\\"chained\\":false}],

					
						documents: {
							SubQuery: {
										artifact: () => import(\\"../../../artifacts/SubQuery\\"),
										loading: false,
										variables: []
									},
							RootQuery: {
										artifact: () => import(\\"../../../artifacts/RootQuery\\"),
										loading: false,
										variables: []
									}
						},

						component: () => import(\\"../units/entries/__id_\\")
					},

					\\"_another\\": {
						id: \\"_another\\",
						pattern: /^\\\\/another\\\\/?$/,
						params: [],

					
						documents: {
							MyQuery: {
										artifact: () => import(\\"../../../artifacts/MyQuery\\"),
										loading: false,
										variables: []
									},
							MyLayoutQuery: {
										artifact: () => import(\\"../../../artifacts/MyLayoutQuery\\"),
										loading: true,
										variables: []
									},
							RootQuery: {
										artifact: () => import(\\"../../../artifacts/RootQuery\\"),
										loading: false,
										variables: []
									}
						},

						component: () => import(\\"../units/entries/_another\\")
					},

					\\"__id__nested\\": {
						id: \\"__id__nested\\",
						pattern: /^\\\\/([^/]+?)\\\\/nested\\\\/?$/,
						params: [{\\"name\\":\\"id\\",\\"optional\\":false,\\"rest\\":false,\\"chained\\":false}],

					
						documents: {
							FinalQuery: {
										artifact: () => import(\\"../../../artifacts/FinalQuery\\"),
										loading: true,
										variables: [\\"foo\\"]
									},
							RootQuery: {
										artifact: () => import(\\"../../../artifacts/RootQuery\\"),
										loading: false,
										variables: []
									}
						},

						component: () => import(\\"../units/entries/__id__nested\\")
					},
				},

				layouts: {
					\\"_\\": {
						id: \\"_\\",

						queries: [],
					},
					\\"__id_\\": {
						id: \\"__id_\\",

						queries: [\\"RootQuery\\"],
					},
					\\"_another\\": {
						id: \\"_another\\",

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
			'+layout.gql': mockQuery('RootQuery', { loading: true }),
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
					\\"_\\": {
						id: \\"_\\",
						pattern: /^\\\\/$/,
						params: [],

					
						documents: {
							RootQuery: {
										artifact: () => import(\\"../../../artifacts/RootQuery\\"),
										loading: true,
										variables: []
									}
						},

						component: () => import(\\"../units/entries/_\\")
					},

					\\"__id_\\": {
						id: \\"__id_\\",
						pattern: /^\\\\/([^/]+?)\\\\/?$/,
						params: [{\\"name\\":\\"id\\",\\"optional\\":false,\\"rest\\":false,\\"chained\\":false}],

					
						documents: {
							SubQuery: {
										artifact: () => import(\\"../../../artifacts/SubQuery\\"),
										loading: false,
										variables: []
									},
							RootQuery: {
										artifact: () => import(\\"../../../artifacts/RootQuery\\"),
										loading: true,
										variables: []
									}
						},

						component: () => import(\\"../units/entries/__id_\\")
					},

					\\"_another\\": {
						id: \\"_another\\",
						pattern: /^\\\\/another\\\\/?$/,
						params: [],

					
						documents: {
							MyQuery: {
										artifact: () => import(\\"../../../artifacts/MyQuery\\"),
										loading: false,
										variables: []
									},
							MyLayoutQuery: {
										artifact: () => import(\\"../../../artifacts/MyLayoutQuery\\"),
										loading: false,
										variables: []
									},
							RootQuery: {
										artifact: () => import(\\"../../../artifacts/RootQuery\\"),
										loading: true,
										variables: []
									}
						},

						component: () => import(\\"../units/entries/_another\\")
					},

					\\"__id__nested\\": {
						id: \\"__id__nested\\",
						pattern: /^\\\\/([^/]+?)\\\\/nested\\\\/?$/,
						params: [{\\"name\\":\\"id\\",\\"optional\\":false,\\"rest\\":false,\\"chained\\":false}],

					
						documents: {
							FinalQuery: {
										artifact: () => import(\\"../../../artifacts/FinalQuery\\"),
										loading: false,
										variables: []
									},
							RootQuery: {
										artifact: () => import(\\"../../../artifacts/RootQuery\\"),
										loading: true,
										variables: []
									}
						},

						component: () => import(\\"../units/entries/__id__nested\\")
					},
				},

				layouts: {
					\\"_\\": {
						id: \\"_\\",

						queries: [],
					},
					\\"__id_\\": {
						id: \\"__id_\\",

						queries: [\\"RootQuery\\"],
					},
					\\"_another\\": {
						id: \\"_another\\",

						queries: [\\"RootQuery\\"],
					}
				}
			}"
		`)
})

function mockView(deps: string[]) {
	return `export default ({ ${deps.join(', ')} }) => <div>hello</div>`
}

function mockQuery(
	name: string,
	{ loading, variables }: { loading?: boolean; variables?: string[] } = {}
) {
	return `
query ${name} ${!variables ? '' : `(${variables.map((name) => `$${name}: Int`).join(', ')})`}${
		loading ? '@loading' : ''
	} {
	id
}
	`
}
