import { test, describe, expect } from 'vitest'

import * as fs from '../common/fs'
import { extractLoadFunction } from './extractLoadFunction'
import { testConfig } from './tests'

describe('extractLoadFunction', function () {
	const table: {
		title: string
		source: string
		expected: { exports: string[]; houdini_load?: string[] }
		artifacts?: Record<string, string>
	}[] = [
		{
			title: 'load single inline value',
			source: `
                import { graphql } from '$houdini'

                export const houdini_load = graphql\`
                    query Foo {
                        viewer { 
                            id
                        }
                    }
                \`
            `,
			expected: {
				exports: ['houdini_load'],
				houdini_load: ['Foo'],
			},
		},
		{
			title: 'load single inline identifier',
			source: `
                import { graphql } from '$houdini'

                const store = graphql\`
                    query Foo {
                        viewer { 
                            id
                        }
                    }
                \`

                export const houdini_load = store
            `,
			expected: {
				exports: ['houdini_load'],
				houdini_load: ['Foo'],
			},
		},
		{
			title: 'load single global factory identifier',
			source: `
                import { MyQueryStore } from '$houdini'

                const store = MyQueryStore()

                export const houdini_load = store
            `,
			artifacts: {
				MyQuery: 'query MyQuery { viewer { id } }',
			},
			expected: {
				exports: ['houdini_load'],
				houdini_load: ['MyQuery'],
			},
		},
		{
			title: 'load single default factory identifier',
			source: `
                import { MyQueryStore } from '$houdini/stores/MyQuery'

                const store = MyQueryStore()

                export const houdini_load = store
            `,
			artifacts: {
				MyQuery: 'query MyQuery { viewer { id } }',
			},
			expected: {
				exports: ['houdini_load'],
				houdini_load: ['MyQuery'],
			},
		},
		{
			title: 'load single global import',
			source: `
                import { GQL_Hello } from '$houdini'

                export const houdini_load = GQL_Hello
            `,
			artifacts: {
				Hello: 'query Hello { viewer { id } }',
			},
			expected: {
				exports: ['houdini_load'],
				houdini_load: [`Hello`],
			},
		},
		{
			title: 'load list with inline value',
			source: `
                import { graphql } from '$houdini'

                export const houdini_load = [graphql\`query Hello { viewer { id } }\`]
            `,
			expected: {
				exports: ['houdini_load'],
				houdini_load: ['Hello'],
			},
		},
		{
			title: 'load list with inline identifier',
			source: `
                import { graphql } from '$houdini'

                const store = graphql\`query Hello { viewer { id } }\`

                export const houdini_load = [store]
            `,
			expected: {
				exports: ['houdini_load'],
				houdini_load: ['Hello'],
			},
		},
		{
			title: 'load list with global import',
			source: `
                import { GQL_Hello } from '$houdini'

                export const houdini_load = [GQL_Hello]
            `,
			artifacts: {
				Hello: 'query Hello { viewer { id } }',
			},
			expected: {
				exports: ['houdini_load'],
				houdini_load: ['Hello'],
			},
		},
		{
			title: 'load list global factory identifier',
			source: `
                import { MyQueryStore } from '$houdini'

                const store = MyQueryStore()

                export const houdini_load = [store]
            `,
			artifacts: {
				MyQuery: 'query MyQuery { viewer { id } }',
			},
			expected: {
				exports: ['houdini_load'],
				houdini_load: ['MyQuery'],
			},
		},
		{
			title: 'load list default factory identifier',
			source: `
                import { MyQueryStore } from '$houdini/stores/MyQuery'

                const store = MyQueryStore()

                export const houdini_load = [store]
            `,
			artifacts: {
				MyQuery: 'query MyQuery { viewer { id } }',
			},
			expected: {
				exports: ['houdini_load'],
				houdini_load: ['MyQuery'],
			},
		},
		{
			title: 'exported function',
			source: `
                export function afterLoad() {

                }

            `,
			expected: {
				exports: ['afterLoad'],
			},
		},
		{
			title: 'exported const',
			source: `
                export const afterLoad = () => {

                }
            `,
			expected: {
				exports: ['afterLoad'],
			},
		},
		{
			title: 'exported let',
			source: `
                export let afterLoad = () => {

                }
            `,
			expected: {
				exports: ['afterLoad'],
			},
		},
		{
			title: 'multiple exports',
			source: `
                export let afterLoad = () => {

                }

                export function beforeLoad() {
                    
                }
            `,
			expected: {
				exports: ['afterLoad', 'beforeLoad'],
			},
		},
	]

	const config = testConfig()

	for (const row of table) {
		test(row.title, async function () {
			const targetPath = 'src/routes/foo'
			await fs.writeFile(targetPath, row.source)

			const artifacts = Object.fromEntries(
				Object.entries(row.artifacts ?? {}).map(([key, value]) => [key, { raw: value }])
			)

			const extracted = await extractLoadFunction(config, targetPath, artifacts)

			expect(extracted.exports).toEqual(row.expected.exports)
			expect(extracted.houdini_load?.map((operation) => operation.name!.value)).toEqual(
				row.expected.houdini_load ?? []
			)
		})
	}
})
