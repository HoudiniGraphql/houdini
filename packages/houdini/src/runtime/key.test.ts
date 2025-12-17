import * as graphql from 'graphql'
import { test, expect, describe } from 'vitest'

import fieldKey from '../../codegen/generators/artifacts/fieldKey'
import { testConfig } from '../../test'
import { computeKey } from './key'

const config = testConfig()

// we need to make sure that the imperative API behaves similarly to the
// artifact generator
describe('evaluateKey', function () {
	const table = [
		{
			title: 'int',
			args: { intValue: 1 },
			field: 'field',
			expected: `field(intValue: 1)`,
		},
		{
			title: 'boolean',
			args: { boolValue: true },
			field: 'field',
			expected: `field(boolValue: true)`,
		},
		{
			title: 'float',
			args: { floatValue: 1.2 },
			field: 'field',
			expected: `field(floatValue: 1.2)`,
		},
		{
			title: 'id',
			args: { idValue: '123' },
			field: 'field',
			expected: `field(idValue: "123")`,
		},
		{
			title: 'complex values',
			args: { where: { name: [{ _eq: 'SidneyA' }, { _eq: 'SidneyB' }] } },
			field: 'field',
			expected: `field(where: {
                name: [{ _eq: "SidneyA" } , { _eq: "SidneyB" } ]
            })`,
		},
		{
			title: 'multiple',
			args: { intValue: 1, stringValue: 'a' },
			field: 'field',
			expected: `field(intValue: 1, stringValue: "a")`,
		},
		{
			title: 'multiple - args out of order',
			args: { stringValue: 'a', intValue: 1 },
			field: 'field',
			expected: `field(intValue: 1, stringValue: "a")`,
		},
		{
			title: 'multiple - field args out of order',
			args: { stringValue: 'a', intValue: 1 },
			field: 'field',
			expected: `field(stringValue: "a", intValue: 1)`,
		},
	]

	for (const row of table) {
		test(row.title, function () {
			// figure out the key we would have printed during codegen
			const field = graphql
				.parse(`{ ${row.expected} }`)
				.definitions.find<graphql.OperationDefinitionNode>(
					(def): def is graphql.OperationDefinitionNode =>
						def.kind === 'OperationDefinition' && def.operation === 'query'
				)!.selectionSet.selections[0] as graphql.FieldNode

			// make sure we matched expectations
			expect(computeKey(row)).toEqual(fieldKey(config, field))
		})
	}
})
