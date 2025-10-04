import * as graphql from 'graphql'
import { test, expect, describe } from 'vitest'

import { computeKey } from './key'
import type { PaginateModes } from './types'

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
			expect(computeKey(row)).toEqual(fieldKey(field))
		})
	}
})

// we need to generate a static key that we can use to index this field in the cache.
// this needs to be a unique hash driven by the field's attribute and arguments
// returns the key for a specific field
function fieldKey(field: graphql.FieldNode): string {
	// we're going to hash a field by creating a json object and adding it
	// to the attribute name
	const attributeName = field.alias?.value || field.name.value

	// field might not have a location so print and re-parse before we look at serialized values
	const printed = graphql.print(field)
	const secondParse = (
		graphql.parse(`{${printed}}`).definitions[0] as graphql.OperationDefinitionNode
	).selectionSet.selections[0] as graphql.FieldNode

	// if the field is paginated, we need to strip away any args
	let paginateMode: PaginateModes = 'Infinite'
	const paginatedDirective = field.directives?.find(
		(directive) => directive.name.value === 'paginate'
	)
	if (paginatedDirective) {
		const paginateModeArg = paginatedDirective?.arguments?.find(
			(arg) => arg.name.value === 'mode'
		)
		if (paginateModeArg && paginateModeArg.value.kind === 'EnumValue') {
			paginateMode = paginateModeArg.value.value as PaginateModes
		}
	}

	// if we are in SinglePageMode, don't strip away any args
	const paginationArgs =
		paginateMode === 'SinglePage' ? [] : ['first', 'after', 'last', 'before', 'limit', 'offset']

	const argObj = (secondParse.arguments || []).reduce<{ [key: string]: string }>((acc, arg) => {
		// the query already contains a serialized version of the argument so just pull it out of the
		// document string
		const start = arg.value.loc?.start
		const end = arg.value.loc?.end

		// if the field is paginated, ignore the pagination args in the key
		if (paginatedDirective && paginationArgs.includes(arg.name.value)) {
			return acc
		}

		// if the argument is not in the query, life doesn't make sense
		if (!start || !end) {
			return acc
		}

		return {
			...acc,
			[arg.name.value]: printed.substring(start - 1, end - 1),
		}
	}, {})

	const args = Object.keys(argObj)
	args.sort()

	let key =
		Object.values(argObj).length > 0
			? `${attributeName}(${args.map((key) => `${key}: ${argObj[key]}`).join(', ')})`
			: attributeName

	// if the field is paginated, key it differently so other documents can ask for the non paginated value without conflict
	if (paginatedDirective) {
		key = key + '::paginated'
	}

	return key
}
