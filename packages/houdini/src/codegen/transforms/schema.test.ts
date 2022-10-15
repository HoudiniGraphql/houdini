import { describe, test } from 'vitest'

import { pipelineTest, testConfig } from '../../test'

describe('schema transform', function () {
	// we'll test the schema additions by pushing some documents through
	// and make sure they don't error
	const table = [
		{
			title: 'list directive',
			documents: [
				`
					fragment Foo on User {

						friends @list(name:"Friends") {
							id
						}
					}
				`,
			],
			pass: true,
		},
		{
			title: 'prepend directive',
			documents: [
				`
					mutation Update {
						updateUser {
							...A @prepend
						}
					}
				`,
				`
					fragment A on User {
						id
					}
				`,
			],
			pass: true,
		},
		{
			title: 'append directive',
			documents: [
				`
					mutation Update {
						updateUser {
							...A @prepend
						}
					}
				`,
				`
					fragment A on User {
						id
					}
				`,
			],
			pass: true,
		},
		{
			title: 'prepend directive - when arg',
			documents: [
				`
					mutation Update {
						updateUser {
							...A @prepend(when: { value: "value" })
						}
					}
				`,
				`
					fragment A on User {
						id
					}
				`,
			],
			pass: true,
		},
		{
			title: 'when directive',
			documents: [
				`
					mutation Update {
						updateUser {
							...A @when(argument: "value", value: "value")
						}
					}
				`,
				`
					fragment A on User {
						id
					}
				`,
			],
			pass: true,
		},
		{
			title: 'when_not directive',
			documents: [
				`
					mutation Update {
						updateUser {
							...A @when_not(argument: "value", value: "value")
						}
					}
				`,
				`
					fragment A on User {
						id
					}
				`,
			],
			pass: true,
		},
		{
			title: 'append directive - when arg',
			documents: [
				`
					mutation Update {
						updateUser {
							...A @append(when: { value: "value" })
						}
					}
				`,
				`
					fragment A on User {
						id
					}
				`,
			],
			pass: true,
		},
	]

	for (const row of table) {
		test(row.title, pipelineTest(testConfig(), row.documents, row.pass))
	}
})
