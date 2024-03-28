import { test, expect, describe } from 'vitest'

import { fs } from '..'
import { testConfig, clearMock } from '../../test'
import { load_manifest, extractQueries } from './manifest'

test('empty routes dir generates empty manifest', async function () {
	const config = testConfig()

	// create the mock filesystem
	await fs.mock({})

	await expect(
		load_manifest({
			config,
		})
	).resolves.to.toMatchInlineSnapshot(`
		{
		    "component_fields": {},
		    "pages": {},
		    "layouts": {},
		    "page_queries": {},
		    "layout_queries": {},
		    "artifacts": [],
		    "local_schema": false,
		    "local_yoga": false
		}
	`)
})

test('route groups', async function () {
	const config = testConfig()

	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			'+layout.tsx': mockView([]),
			'(subRoute)': {
				'+layout.tsx': mockView(['RootQuery']),
				'+layout.gql': mockQuery('RootQuery'),
				nested: {
					'+page.gql': mockQuery('FinalQuery', true),
					'+page.tsx': mockView(['FinalQuery']),
				},
			},
		},
	})

	expect(
		await load_manifest({
			config,
		})
	).toMatchInlineSnapshot(`
		{
		    "component_fields": {},
		    "pages": {
		        "__subRoute__nested": {
		            "id": "__subRoute__nested",
		            "queries": [
		                "FinalQuery"
		            ],
		            "url": "/(subRoute)/nested",
		            "layouts": [
		                "_",
		                "__subRoute_"
		            ],
		            "path": "src/routes/(subRoute)/nested/+page.tsx",
		            "query_options": [
		                "RootQuery",
		                "FinalQuery"
		            ],
		            "params": {}
		        }
		    },
		    "layouts": {
		        "_": {
		            "id": "_",
		            "queries": [],
		            "url": "/",
		            "layouts": [],
		            "path": "src/routes/+layout.tsx",
		            "query_options": [],
		            "params": {}
		        },
		        "__subRoute_": {
		            "id": "__subRoute_",
		            "queries": [
		                "RootQuery"
		            ],
		            "url": "/(subRoute)/",
		            "layouts": [
		                "_"
		            ],
		            "path": "src/routes/(subRoute)/+layout.tsx",
		            "query_options": [
		                "RootQuery"
		            ],
		            "params": {}
		        }
		    },
		    "page_queries": {
		        "__subRoute__nested": {
		            "path": "(subRoute)/nested/+page.gql",
		            "name": "FinalQuery",
		            "url": "/(subRoute)/nested/",
		            "loading": true,
		            "variables": {}
		        }
		    },
		    "layout_queries": {
		        "__subRoute_": {
		            "path": "(subRoute)/+layout.gql",
		            "name": "RootQuery",
		            "url": "/(subRoute)/",
		            "loading": false,
		            "variables": {}
		        }
		    },
		    "artifacts": [],
		    "local_schema": false,
		    "local_yoga": false
		}
	`)
})

test('nested route structure happy path', async function () {
	const config = testConfig()

	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			'+layout.tsx': 'export default ({children}) => <div>{children}</div>',
			'+layout.gql': mockQuery('RootQuery', true),
			'+page.tsx': mockView(['RootQuery']),
			subRoute: {
				'+layout.tsx': mockView(['RootQuery']),
				'+layout.gql': mockQuery('SubQuery'),
				'+page.jsx': mockView(['SubQuery', 'RootQuery']),
				nested: {
					'+page.gql': mockQuery('FinalQuery', true),
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

	await expect(
		load_manifest({
			config,
		})
	).resolves.toMatchInlineSnapshot(`
		{
		    "component_fields": {},
		    "pages": {
		        "_": {
		            "id": "_",
		            "queries": [
		                "RootQuery"
		            ],
		            "url": "/",
		            "layouts": [
		                "_"
		            ],
		            "path": "src/routes/+page.tsx",
		            "query_options": [
		                "RootQuery"
		            ],
		            "params": {}
		        },
		        "_subRoute": {
		            "id": "_subRoute",
		            "queries": [
		                "SubQuery",
		                "RootQuery"
		            ],
		            "url": "/subRoute",
		            "layouts": [
		                "_",
		                "_subRoute"
		            ],
		            "path": "src/routes/subRoute/+page.jsx",
		            "query_options": [
		                "RootQuery",
		                "SubQuery"
		            ],
		            "params": {}
		        },
		        "_another": {
		            "id": "_another",
		            "queries": [
		                "MyQuery",
		                "MyLayoutQuery"
		            ],
		            "url": "/another",
		            "layouts": [
		                "_",
		                "_another"
		            ],
		            "path": "src/routes/another/+page.tsx",
		            "query_options": [
		                "RootQuery",
		                "MyLayoutQuery",
		                "MyQuery"
		            ],
		            "params": {}
		        },
		        "_subRoute_nested": {
		            "id": "_subRoute_nested",
		            "queries": [
		                "FinalQuery"
		            ],
		            "url": "/subRoute/nested",
		            "layouts": [
		                "_",
		                "_subRoute"
		            ],
		            "path": "src/routes/subRoute/nested/+page.tsx",
		            "query_options": [
		                "RootQuery",
		                "SubQuery",
		                "FinalQuery"
		            ],
		            "params": {}
		        }
		    },
		    "layouts": {
		        "_": {
		            "id": "_",
		            "queries": [],
		            "url": "/",
		            "layouts": [],
		            "path": "src/routes/+layout.tsx",
		            "query_options": [
		                "RootQuery"
		            ],
		            "params": {}
		        },
		        "_another": {
		            "id": "_another",
		            "queries": [
		                "RootQuery"
		            ],
		            "url": "/another/",
		            "layouts": [
		                "_"
		            ],
		            "path": "src/routes/another/+layout.tsx",
		            "query_options": [
		                "RootQuery",
		                "MyLayoutQuery"
		            ],
		            "params": {}
		        },
		        "_subRoute": {
		            "id": "_subRoute",
		            "queries": [
		                "RootQuery"
		            ],
		            "url": "/subRoute/",
		            "layouts": [
		                "_"
		            ],
		            "path": "src/routes/subRoute/+layout.tsx",
		            "query_options": [
		                "RootQuery",
		                "SubQuery"
		            ],
		            "params": {}
		        }
		    },
		    "page_queries": {
		        "_another": {
		            "path": "another/+page.gql",
		            "name": "MyQuery",
		            "url": "/another/",
		            "loading": false,
		            "variables": {}
		        },
		        "_subRoute_nested": {
		            "path": "subRoute/nested/+page.gql",
		            "name": "FinalQuery",
		            "url": "/subRoute/nested/",
		            "loading": true,
		            "variables": {}
		        }
		    },
		    "layout_queries": {
		        "_": {
		            "path": "+layout.gql",
		            "name": "RootQuery",
		            "url": "/",
		            "loading": true,
		            "variables": {}
		        },
		        "_another": {
		            "path": "another/+layout.gql",
		            "name": "MyLayoutQuery",
		            "url": "/another/",
		            "loading": false,
		            "variables": {}
		        },
		        "_subRoute": {
		            "path": "subRoute/+layout.gql",
		            "name": "SubQuery",
		            "url": "/subRoute/",
		            "loading": false,
		            "variables": {}
		        }
		    },
		    "artifacts": [],
		    "local_schema": false,
		    "local_yoga": false
		}
	`)
})

test('local schema', async function () {
	const config = testConfig()

	// create the mock filesystem
	await fs.mock({
		[config.projectRoot]: {
			'src/api': {
				'+schema.js': `
					export default 'foo'
				`,
			},
		},
	})

	await expect(
		load_manifest({
			config,
		})
	).resolves.toMatchInlineSnapshot(`
		{
		    "component_fields": {},
		    "pages": {},
		    "layouts": {},
		    "page_queries": {},
		    "layout_queries": {},
		    "artifacts": [],
		    "local_schema": true,
		    "local_yoga": false
		}
	`)
})

test('local yoga', async function () {
	const config = testConfig()

	// create the mock filesystem
	await fs.mock({
		[config.projectRoot]: {
			'src/api': {
				'+yoga.js': `
					export default 'foo'
				`,
			},
		},
	})

	await expect(
		load_manifest({
			config,
		})
	).resolves.toMatchInlineSnapshot(`
		{
		    "component_fields": {},
		    "pages": {},
		    "layouts": {},
		    "page_queries": {},
		    "layout_queries": {},
		    "artifacts": [],
		    "local_schema": false,
		    "local_yoga": true
		}
	`)
})

test('extract route params', async function () {
	const config = testConfig()

	// create the mock filesystem
	await fs.mock({
		[config.routesDir]: {
			'[id]': {
				'+page.tsx': mockView(['MyQuery']),
				'+layout.gql': `
					query MyQuery($id: ID!) {
						node(id: $id) {
							__typename
						}
					}
				`,
			},
		},
	})

	await expect(
		load_manifest({
			config,
		})
	).resolves.toMatchInlineSnapshot(`
		{
		    "component_fields": {},
		    "pages": {
		        "__id_": {
		            "id": "__id_",
		            "queries": [
		                "MyQuery"
		            ],
		            "url": "/[id]",
		            "layouts": [],
		            "path": "src/routes/[id]/+page.tsx",
		            "query_options": [
		                "MyQuery"
		            ],
		            "params": {
		                "id": {
		                    "wrappers": [
		                        "NonNull"
		                    ],
		                    "type": "ID"
		                }
		            }
		        }
		    },
		    "layouts": {},
		    "page_queries": {},
		    "layout_queries": {
		        "__id_": {
		            "path": "[id]/+layout.gql",
		            "name": "MyQuery",
		            "url": "/[id]/",
		            "loading": false,
		            "variables": {
		                "id": {
		                    "wrappers": [
		                        "NonNull"
		                    ],
		                    "type": "ID"
		                }
		            }
		        }
		    },
		    "artifacts": [],
		    "local_schema": false,
		    "local_yoga": false
		}
	`)
})

describe('validate filesystem', async () => {
	const config = testConfig()

	const testCases: {
		name: string
		filesystem: any
		pass: boolean
	}[] = [
		{
			name: 'page queries must be defined in the same directory as the page view',
			pass: true,
			filesystem: {
				[config.routesDir]: {
					'+page.gql': mockQuery('RootQuery'),
					'+page.tsx': mockView(['RootQuery']),
				},
			},
		},
		{
			name: 'page query defined in a different directory above the page view',
			pass: false,
			filesystem: {
				[config.routesDir]: {
					['subRoute']: {
						'+page.tsx': mockView(['RootQuery']),
					},
					'+page.gql': mockQuery('RootQuery'),
				},
			},
		},
		{
			name: 'page query defined in a different directory below the page view',
			pass: false,
			filesystem: {
				[config.routesDir]: {
					['subRoute']: {
						'+page.tsx': mockView(['RootQuery']),
						['subSubRoute']: {
							'+page.gql': mockQuery('RootQuery'),
						},
					},
				},
			},
		},
		{
			name: 'queries defined in layouts work in local directory',
			pass: true,
			filesystem: {
				[config.routesDir]: {
					['subRoute']: {
						'+layout.gql': mockQuery('RootQuery'),
						'+page.tsx': mockView(['RootQuery']),
					},
				},
			},
		},
		{
			name: 'queries defined in layouts work in far child directory',
			pass: true,
			filesystem: {
				[config.routesDir]: {
					['subRoute']: {
						'+layout.gql': mockQuery('RootQuery'),
						['subSubRoute']: {
							['subSubSubRoute']: {
								'+page.tsx': mockView(['RootQuery']),
							},
						},
					},
				},
			},
		},
		{
			name: 'queries defined in layouts do not work in parent directory',
			pass: false,
			filesystem: {
				[config.routesDir]: {
					['subRoute']: {
						'+page.tsx': mockView(['RootQuery']),
						['subSubRoute']: {
							'+layout.gql': mockQuery('RootQuery'),
						},
					},
				},
			},
		},
	]

	for (const testCase of testCases) {
		test(testCase.name, async () => {
			await fs.mock(testCase.filesystem)

			const result = load_manifest({
				config,
			})

			if (testCase.pass) {
				await expect(result).resolves.toBeTruthy()
			} else {
				await expect(result).rejects.toBeTruthy()
			}

			clearMock()
		})
	}
})

describe('extractQueries', async () => {
	const testCases: {
		name: string
		source: string
		expected: string[]
	}[] = [
		{
			name: 'Basic functional component',
			source: `
      import React from 'react';

      interface Props {
        name: string;
        age: number;
      }

      const MyComponent: React.FC<Props> = ({ name, age }) => {
        return (
          <div>
            <p>Name: {name}</p>
            <p>Age: {age}</p>
          </div>
        );
      };

      export default MyComponent;
    `,
			expected: ['name', 'age'],
		},
		{
			name: 'Functional component with arrow function',
			source: `
      import React from 'react';

      interface Props {
        title: string;
        content: string;
      }

      const MyComponent = ({ title, content }: Props) => (
        <div>
          <h1>{title}</h1>
          <p>{content}</p>
        </div>
      );

      export default MyComponent;
    `,
			expected: ['title', 'content'],
		},
		{
			name: '$handle',
			source: `
      import React from 'react';

      interface Props {
        title: string;
        content: string;
      }

      const MyComponent = ({ title$handle }: Props) => (
        <div>
          <h1>{title}</h1>
          <p>{content}</p>
        </div>
      );

      export default MyComponent;
    `,
			expected: ['title'],
		},
		{
			name: 'Functional component with function expression',
			source: `
      import React from 'react';

      interface Props {
        firstName: string;
        lastName: string;
      }

      const MyComponent: React.FC<Props> = function({ firstName, lastName }) {
        return (
          <div>
            <p>First Name: {firstName}</p>
            <p>Last Name: {lastName}</p>
          </div>
        );
      };

      export default MyComponent;
    `,
			expected: ['firstName', 'lastName'],
		},
		{
			name: 'Inline functional component with function expression',
			source: `
      import React from 'react';

      interface Props {
        firstName: string;
        lastName: string;
      }

      export default function({ firstName, lastName }) {
        return (
          <div>
            <p>First Name: {firstName}</p>
            <p>Last Name: {lastName}</p>
          </div>
        );
      };;
    `,
			expected: ['firstName', 'lastName'],
		},
	]

	for (const testCase of testCases) {
		test(testCase.name, async () => {
			const props = await extractQueries(testCase.source)
			expect(props).toEqual(testCase.expected)
		})
	}
})

function mockView(deps: string[]) {
	return `export default ({ ${deps.join(', ')} }) => <div>hello</div>`
}

function mockQuery(name: string, loading?: boolean) {
	return `
query ${name} ${loading ? '@loading' : ''}{
	id
}
	`
}
