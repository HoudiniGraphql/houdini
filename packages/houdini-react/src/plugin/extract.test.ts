import { test, expect } from 'vitest'

import { test_config } from './config'
import { extractDocuments } from './extract'

test('extracts queries out of graphql templates', async () => {
	const config = await test_config()

	const extracted = await extractDocuments({
		config,
		filepath: 'myQuery.tsx',
		content: `
            type Props = {
                user: graphql<\`{
                    ... on User @componentField(field: "Avatar") {
                    firstName
                    }
                }\`>
            }

            export default function UserInfo({ user }: Props) {
                return (
                    <div>
                        {user.firstName}
                    </div>
                )
            }
        `,
	})

	expect(extracted).toMatchInlineSnapshot(`
		[
		    "fragment __componentField__User_Avatar on User @componentField(field: \\"Avatar\\") {\\n  firstName\\n}"
		]
	`)
})

test('require name if non-inline fragment is present', async () => {
	const config = await test_config()

	const extracted = extractDocuments({
		config,
		filepath: 'myQuery.tsx',
		content: `
            type Props = {
                user: graphql<\`{
                    viewer { id }
                    ... on User @componentField(field: "Avatar") {
                        firstName
                    }
                }\`>
            }

            export default function UserInfo({ user }: Props) {
                return (
                    <div>
                        {user.firstName}
                    </div>
                )
            }
        `,
	})

	await expect(extracted).rejects.toBeTruthy()
})

test('extracts multiple queries out of graphql templates', async () => {
	const config = await test_config()

	const extracted = await extractDocuments({
		config,
		filepath: 'myQuery.tsx',
		content: `
            type Props = {
                user: graphql<\`{
                    ... on User @componentField(field: "Avatar") {
                        firstName
                    }
                    ... on AnotherType @componentField(field: "Avatar") {
                        firstName
                    }
                }\`>
            }

            export default function UserInfo({ user }: Props) {
                return (
                    <div>
                        {user.firstName}
                    </div>
                )
            }
        `,
	})

	expect(extracted).toMatchInlineSnapshot(`
		[
		    "fragment __componentField__User_Avatar on User @componentField(field: \\"Avatar\\") {\\n  firstName\\n}",
		    "fragment __componentField__AnotherType_Avatar on AnotherType @componentField(field: \\"Avatar\\") {\\n  firstName\\n}"
		]
	`)
})
