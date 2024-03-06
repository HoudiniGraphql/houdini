import { describe, expect, test } from 'vitest'

import type { Row } from '../../test'
import { pipelineTest, testConfig } from '../../test'

// since generation will catch a lot of these errors for us, the goal of these tests is to make sure
// errors are caught __before__ we get to the generation stage. This means that our failure tests
// need to look for multiple errors thrown at once

const table: Row[] = [
	{
		title: 'allows non-overlapping types',
		pass: true,
		documents: [
			`fragment MyFragmentOne on User @componentField(field: "Avatar", prop: "user") {
				firstName
			}`,
		],
	},
	{
		title: "two componentFields can't overlap",
		pass: false,
		documents: [
			`fragment MyFragmentOne on User  @componentField(field: "Avatar", prop: "user") {
				firstName
			}`,
			`fragment MyFragmentTwo on User  @componentField(field: "Avatar", prop: "user") {
				firstName
			}`,
		],
		nb_of_fail: 1,
	},
	{
		title: "componentFields can't overlap with type fields",
		pass: false,
		nb_of_fail: 1,
		documents: [
			`fragment MyFragmentOne on User  @componentField(field: "firstName", prop: "user") {
				firstName
			}`,
			`fragment MyFragmentTwo on User  @componentField(field: "firstName", prop: "user") {
				firstName
			}`,
		],
	},
	{
		title: 'componentField on fragmentDefinition needs a prop',
		pass: false,
		documents: [
			`fragment MyFragmentOne on User  @componentField(field: "firstName") {
				firstName
			}`,
			`fragment MyFragmentTwo on User  @componentField(field: "firstName") {
				firstName
			}`,
		],
	},
	{
		title: 'componentFields on abstract types',
		pass: false,
		documents: [
			`fragment MyFragmentOne on Friend  @componentField(field: "firstName", prop: "user") {
				firstName
			}`,
			`fragment MyFragmentTwo on Friend  @componentField(field: "anotherName", prop: "user") {
				firstName
			}`,
		],
	},
]

describe('componentField tests', function () {
	// run the tests
	for (const { title, pass, documents, check, partial_config, nb_of_fail } of table) {
		test(
			title,
			pipelineTest(
				testConfig(partial_config),
				documents,
				pass,
				pass
					? undefined
					: check ||
							function (e: Error | Error[]) {
								const nb_of_fail_to_use = nb_of_fail || 2

								// We want to check that all errors are grouped into 1 throw
								// having an array with at least 2 errors
								expect(e).toHaveLength(nb_of_fail_to_use)
							}
			)
		)
	}
})
