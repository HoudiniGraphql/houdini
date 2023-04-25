import { fs } from 'houdini'
import { clearMock } from 'houdini/test'
import { test, expect, describe } from 'vitest'

import { test_config } from '../config'
import { load_manifest } from './manifest'
import { extractQueries } from './manifest'

test('empty routes dir generates empty manifest', async function () {
	const config = await test_config()

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

test('nested route structure happy path', async function () {
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
				'+page.jsx': mockView(['SubQuery', 'RootQuery']),
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

	await expect(
		load_manifest({
			config,
		})
	).resolves.toMatchInlineSnapshot(`
		{
		    "pages": {
		        "__": {
		            "id": "__",
		            "queries": [
		                "RootQuery"
		            ],
		            "url": "/",
		            "layouts": [
		                "__"
		            ]
		        },
		        "__another": {
		            "id": "__another",
		            "queries": [
		                "MyQuery",
		                "MyLayoutQuery"
		            ],
		            "url": "/another",
		            "layouts": [
		                "__",
		                "__another__"
		            ]
		        },
		        "__subRoute": {
		            "id": "__subRoute",
		            "queries": [
		                "SubQuery",
		                "RootQuery"
		            ],
		            "url": "/subRoute",
		            "layouts": [
		                "__",
		                "__subRoute__"
		            ]
		        },
		        "__subRoute__nested": {
		            "id": "__subRoute__nested",
		            "queries": [
		                "FinalQuery"
		            ],
		            "url": "/subRoute/nested",
		            "layouts": [
		                "__",
		                "__subRoute__"
		            ]
		        }
		    },
		    "layouts": {
		        "__": {
		            "id": "__",
		            "queries": [],
		            "url": "/",
		            "layouts": []
		        },
		        "__another__": {
		            "id": "__another__",
		            "queries": [
		                "RootQuery"
		            ],
		            "url": "/another/",
		            "layouts": [
		                "__"
		            ]
		        },
		        "__subRoute__": {
		            "id": "__subRoute__",
		            "queries": [
		                "RootQuery"
		            ],
		            "url": "/subRoute/",
		            "layouts": [
		                "__"
		            ]
		        }
		    },
		    "page_queries": {
		        "__another__": {
		            "name": "MyQuery",
		            "url": "/another/"
		        },
		        "__subRoute__nested__": {
		            "name": "FinalQuery",
		            "url": "/subRoute/nested/"
		        }
		    },
		    "layout_queries": {
		        "__": {
		            "name": "RootQuery",
		            "url": "/"
		        },
		        "__another__": {
		            "name": "MyLayoutQuery",
		            "url": "/another/"
		        },
		        "__subRoute__": {
		            "name": "SubQuery",
		            "url": "/subRoute/"
		        }
		    }
		}
	`)
})

describe('validate filesystem', async () => {
	const config = await test_config()

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

function mockQuery(name: string) {
	return `
query ${name} {
	id
}
	`
}
