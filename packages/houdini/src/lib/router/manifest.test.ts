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
		    "pages": {},
		    "layouts": {},
		    "page_queries": {},
		    "layout_queries": {}
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
		    "pages": {
		        "_0_3subRoute_4_0nested": {
		            "id": "_0_3subRoute_4_0nested",
		            "queries": [
		                "FinalQuery"
		            ],
		            "url": "/(subRoute)/nested",
		            "layouts": [
		                "_0",
		                "_0_3subRoute_4"
		            ],
		            "path": "src/routes/(subRoute)/nested/+page.tsx",
		            "query_options": [
		                "RootQuery",
		                "FinalQuery"
		            ]
		        }
		    },
		    "layouts": {
		        "_0": {
		            "id": "_0",
		            "queries": [],
		            "url": "/",
		            "layouts": [],
		            "path": "src/routes/+layout.tsx",
		            "query_options": []
		        },
		        "_0_3subRoute_4": {
		            "id": "_0_3subRoute_4",
		            "queries": [
		                "RootQuery"
		            ],
		            "url": "/(subRoute)/",
		            "layouts": [
		                "_0"
		            ],
		            "path": "src/routes/(subRoute)/+layout.tsx",
		            "query_options": [
		                "RootQuery"
		            ]
		        }
		    },
		    "page_queries": {
		        "_0_3subRoute_4_0nested": {
		            "path": "(subRoute)/nested/+page.gql",
		            "name": "FinalQuery",
		            "url": "/(subRoute)/nested/",
		            "loading": true
		        }
		    },
		    "layout_queries": {
		        "_0_3subRoute_4": {
		            "path": "(subRoute)/+layout.gql",
		            "name": "RootQuery",
		            "url": "/(subRoute)/",
		            "loading": false
		        }
		    }
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
		    "pages": {
		        "_0": {
		            "id": "_0",
		            "queries": [
		                "RootQuery"
		            ],
		            "url": "/",
		            "layouts": [
		                "_0"
		            ],
		            "path": "src/routes/+page.tsx",
		            "query_options": [
		                "RootQuery"
		            ]
		        },
		        "_0subRoute": {
		            "id": "_0subRoute",
		            "queries": [
		                "SubQuery",
		                "RootQuery"
		            ],
		            "url": "/subRoute",
		            "layouts": [
		                "_0",
		                "_0subRoute"
		            ],
		            "path": "src/routes/subRoute/+page.jsx",
		            "query_options": [
		                "RootQuery",
		                "SubQuery"
		            ]
		        },
		        "_0another": {
		            "id": "_0another",
		            "queries": [
		                "MyQuery",
		                "MyLayoutQuery"
		            ],
		            "url": "/another",
		            "layouts": [
		                "_0",
		                "_0another"
		            ],
		            "path": "src/routes/another/+page.tsx",
		            "query_options": [
		                "RootQuery",
		                "MyLayoutQuery",
		                "MyQuery"
		            ]
		        },
		        "_0subRoute_0nested": {
		            "id": "_0subRoute_0nested",
		            "queries": [
		                "FinalQuery"
		            ],
		            "url": "/subRoute/nested",
		            "layouts": [
		                "_0",
		                "_0subRoute"
		            ],
		            "path": "src/routes/subRoute/nested/+page.tsx",
		            "query_options": [
		                "RootQuery",
		                "SubQuery",
		                "FinalQuery"
		            ]
		        }
		    },
		    "layouts": {
		        "_0": {
		            "id": "_0",
		            "queries": [],
		            "url": "/",
		            "layouts": [],
		            "path": "src/routes/+layout.tsx",
		            "query_options": [
		                "RootQuery"
		            ]
		        },
		        "_0another": {
		            "id": "_0another",
		            "queries": [
		                "RootQuery"
		            ],
		            "url": "/another/",
		            "layouts": [
		                "_0"
		            ],
		            "path": "src/routes/another/+layout.tsx",
		            "query_options": [
		                "RootQuery",
		                "MyLayoutQuery"
		            ]
		        },
		        "_0subRoute": {
		            "id": "_0subRoute",
		            "queries": [
		                "RootQuery"
		            ],
		            "url": "/subRoute/",
		            "layouts": [
		                "_0"
		            ],
		            "path": "src/routes/subRoute/+layout.tsx",
		            "query_options": [
		                "RootQuery",
		                "SubQuery"
		            ]
		        }
		    },
		    "page_queries": {
		        "_0another": {
		            "path": "another/+page.gql",
		            "name": "MyQuery",
		            "url": "/another/",
		            "loading": false
		        },
		        "_0subRoute_0nested": {
		            "path": "subRoute/nested/+page.gql",
		            "name": "FinalQuery",
		            "url": "/subRoute/nested/",
		            "loading": true
		        }
		    },
		    "layout_queries": {
		        "_0": {
		            "path": "+layout.gql",
		            "name": "RootQuery",
		            "url": "/",
		            "loading": true
		        },
		        "_0another": {
		            "path": "another/+layout.gql",
		            "name": "MyLayoutQuery",
		            "url": "/another/",
		            "loading": false
		        },
		        "_0subRoute": {
		            "path": "subRoute/+layout.gql",
		            "name": "SubQuery",
		            "url": "/subRoute/",
		            "loading": false
		        }
		    }
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
