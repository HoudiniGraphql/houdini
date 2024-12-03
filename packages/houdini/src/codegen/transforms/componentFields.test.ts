import { expect, test } from 'vitest'

import type { Document } from '../../lib'
import { pipelineTest, testConfig } from '../../test'

test('componentFields are replaced by their fragment', async function () {
	const target = [
		`fragment UserAvatar on User @componentField(field: "Avatar", prop: "user") {
			firstName
		}`,
		`query UserInfo { user { Avatar } }`,
	]

	return await pipelineTest(testConfig(), target, true, function (docs: Document[]) {
		expect(docs[1].artifact?.raw).toMatchInlineSnapshot(`
			"query UserInfo {
			  user {
			    ...UserAvatar
			    id
			  }
			}

			fragment UserAvatar on User {
			  firstName
			  id
			  __typename
			}"
		`)
	})()
})

test('componentField arguments turn into fragment arguments', async function () {
	const target = [
		`fragment UserAvatar on User @componentField(field: "Avatar", prop: "user") @arguments(size: { type: "Int" }) {
			name(arg: $size)
		}`,
		`query UserInfo {
			user {
				Avatar(size:10)
			}
		}`,
	]

	return await pipelineTest(testConfig(), target, true, function (docs: Document[]) {
		expect(docs[1].artifact?.raw).toMatchInlineSnapshot(`
			"query UserInfo {
			  user {
			    ...UserAvatar_10Qnro
			    id
			  }
			}

			fragment UserAvatar_10Qnro on User {
			  name(arg: 10)
			  id
			  __typename
			}"
		`)
	})()
})
