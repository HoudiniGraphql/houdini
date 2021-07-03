import { testConfig } from 'houdini-common'
import { RequestContext } from './network'
import { QueryArtifact } from './types'

describe('marshal inputs', function () {
	// a mock request context
	const ctx = new RequestContext({
		page: { host: '', path: '', params: null, query: null },
		context: null,
		session: null,
		fetch: ((() => {}) as unknown) as (input: RequestInfo, init?: RequestInit) => Promise<any>,
	})

	const localConfig = testConfig({
		schema: `
            scalar DateTime
            
            input NestedDate { 
				name: String
                date: DateTime!
                nested: NestedDate!
            }

            type TodoItem { 
                text: String!
                createdAt: DateTime! 
            }	

			type Query { 
				users(date: NestedDate, booleanValue: Boolean): String
			}
        `,
		scalars: {
			DateTime: {
				type: 'Date',
				unmarshal(val: number): Date {
					const date = new Date(0)
					date.setMilliseconds(val)

					return date
				},
				marshal(date: Date): number {
					return date.getTime()
				},
			},
		},
	})

	// the test artifact
	const artifact: QueryArtifact = {
		name: 'AllItems',
		kind: 'HoudiniQuery',
		hash: 'hash',
		raw: 'does not matter',
		selection: {},
		rootType: 'Query',
		input: {
			fields: {
				date: 'NestedDate',
				booleanValue: 'Boolean',
			},
			types: {
				NestedDate: {
					date: 'DateTime',
					nested: 'NestedDate',
				},
			},
		},
	}

	test('lists of objects', function () {
		// some dates to check against
		const date1 = new Date(0)
		const date2 = new Date(1)
		const date3 = new Date(2)

		// compute the inputs
		const inputs = ctx.computeInput({
			config: localConfig,
			mode: 'kit',
			artifact,
			variableFunction() {
				return {
					date: [
						{
							date: date1,
							nested: {
								date: date2,
								nested: {
									date: date3,
								},
							},
						},
					],
				}
			},
		})

		// make sure we got the expected value
		expect(inputs).toEqual({
			date: [
				{
					date: date1.getTime(),
					nested: {
						date: date2.getTime(),
						nested: {
							date: date3.getTime(),
						},
					},
				},
			],
		})
	})

	test('root fields', function () {
		// compute the inputs
		const inputs = ctx.computeInput({
			config: localConfig,
			mode: 'kit',
			artifact,
			variableFunction() {
				return {
					booleanValue: true,
				}
			},
		})

		// make sure we got the expected value
		expect(inputs).toEqual({
			booleanValue: true,
		})
	})

	test('non-custom scalar fields of objects', function () {
		// compute the inputs
		const inputs = ctx.computeInput({
			config: localConfig,
			mode: 'kit',
			artifact,
			variableFunction() {
				return {
					date: {
						name: 'hello',
					},
				}
			},
		})

		// make sure we got the expected value
		expect(inputs).toEqual({
			date: {
				name: 'hello',
			},
		})
	})

	test('non-custom scalar fields of lists', function () {
		// compute the inputs
		const inputs = ctx.computeInput({
			config: localConfig,
			mode: 'kit',
			artifact,
			variableFunction() {
				return {
					date: [
						{
							name: 'hello',
						},
					],
				}
			},
		})

		// make sure we got the expected value
		expect(inputs).toEqual({
			date: [
				{
					name: 'hello',
				},
			],
		})
	})
})
