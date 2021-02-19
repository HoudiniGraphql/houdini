// local imports
import '../../../../jest.setup'
import { pipelineTest } from '../testUtils'

describe('schema transform', function () {
	// we'll test the schema additions by pushing some documents through
	// and make sure they dont error
	const table = [
		{
			title: 'connection directive',
			documents: [
				`
					fragment Foo on User {

						friends @connection(name:"Friends") {
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
							...A @prepend(when: { argument: "value", value: "value" })
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
							...A @append(when: { argument: "value", value: "value" })
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
		pipelineTest(row.title, row.documents, row.pass, null)
	}
})
