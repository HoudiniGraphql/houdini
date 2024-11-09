import { describe, it, expect } from 'vitest'

import { extractGraphQLDocumentName, extractGraphQLStrings } from './documents'

describe('extractGraphQLStrings', () => {
	it('should extract simple double-quoted strings', () => {
		const input = 'graphql("query { user { name } }")'
		expect(extractGraphQLStrings(input)).toEqual(['query { user { name } }'])
	})

	it('should extract simple single-quoted strings', () => {
		const input = "graphql('query { user { name } }')"
		expect(extractGraphQLStrings(input)).toEqual(['query { user { name } }'])
	})

	it('should extract backtick strings', () => {
		const input = 'graphql(`query { user { name } }`)'
		expect(extractGraphQLStrings(input)).toEqual(['query { user { name } }'])
	})

	it('should handle multiple graphql calls in the same text', () => {
		const input = `
            graphql("query1 { field1 }");
            graphql('query2 { field2 }');
            graphql(\`query3 { field3 }\`);
        `
		expect(extractGraphQLStrings(input)).toEqual([
			'query1 { field1 }',
			'query2 { field2 }',
			'query3 { field3 }',
		])
	})

	it('should handle escaped quotes in double-quoted strings', () => {
		const input = 'graphql("query { user(name: \\"John\\") { id } }")'
		expect(extractGraphQLStrings(input)).toEqual(['query { user(name: "John") { id } }'])
	})

	it('should handle escaped quotes in single-quoted strings', () => {
		const input = "graphql('query { user(name: \\'John\\') { id } }')"
		expect(extractGraphQLStrings(input)).toEqual(["query { user(name: 'John') { id } }"])
	})

	it('should handle escaped backticks in backtick strings', () => {
		const input = 'graphql(`query { field(name: \\`test\\`) { id } }`)'
		expect(extractGraphQLStrings(input)).toEqual(['query { field(name: `test`) { id } }'])
	})

	it('should handle nested parentheses', () => {
		const input = 'graphql(someFunction("param"), "query { field }")'
		expect(extractGraphQLStrings(input)).toEqual(['param', 'query { field }'])
	})

	it('should handle conditional expressions', () => {
		const input = 'graphql(isDev ? "query1" : "query2")'
		expect(extractGraphQLStrings(input)).toEqual(['query1', 'query2'])
	})

	it('should handle multiline queries', () => {
		const input = `
            graphql(\`
                query UserQuery {
                    user(id: "123") {
                        name
                        email
                        posts {
                            title
                        }
                    }
                }
            \`)
        `
		expect(extractGraphQLStrings(input)).toEqual([
			`query UserQuery {
                    user(id: "123") {
                        name
                        email
                        posts {
                            title
                        }
                    }
                }`,
		])
	})

	it('should handle empty strings', () => {
		const input = 'graphql("")'
		expect(extractGraphQLStrings(input)).toEqual([''])
	})

	it('should return empty array for text without graphql calls', () => {
		const input = 'const query = "query { user { name } }";'
		expect(extractGraphQLStrings(input)).toEqual([])
	})

	it('should handle malformed graphql calls gracefully', () => {
		const input = 'graphql("unclosed string'
		expect(extractGraphQLStrings(input)).toEqual([])
	})

	it('should handle multiple nested function calls', () => {
		const input = 'graphql(getQuery("user", `nested`), formatQuery(\'test\'))'
		expect(extractGraphQLStrings(input)).toEqual(['user', 'nested', 'test'])
	})

	it('should handle string concatenation', () => {
		const input = 'graphql("query " + "fragment" + `template`)'
		expect(extractGraphQLStrings(input)).toEqual(['query', 'fragment', 'template'])
	})
})

describe('extractGraphQLDocumentName', () => {
	it('should extract query names', () => {
		const cases = [
			{
				input: 'query UserProfile { user { name } }',
				expected: 'UserProfile',
			},
			{
				input: `
                    query GetUserDetails {
                        user(id: "123") {
                            name
                            email
                        }
                    }
                `,
				expected: 'GetUserDetails',
			},
			{
				input: 'query _private_123 { field }',
				expected: '_private_123',
			},
		]

		cases.forEach(({ input, expected }) => {
			expect(extractGraphQLDocumentName(input)).toBe(expected)
		})
	})

	it('should extract mutation names', () => {
		const cases = [
			{
				input: 'mutation UpdateUser { updateUser { success } }',
				expected: 'UpdateUser',
			},
			{
				input: `
                    mutation DeleteAccount {
                        deleteUser(id: "123") {
                            success
                            message
                        }
                    }
                `,
				expected: 'DeleteAccount',
			},
		]

		cases.forEach(({ input, expected }) => {
			expect(extractGraphQLDocumentName(input)).toBe(expected)
		})
	})

	it('should extract subscription names', () => {
		const cases = [
			{
				input: 'subscription UserEvents { userEvents { type } }',
				expected: 'UserEvents',
			},
			{
				input: `
                    subscription MessageNotifications {
                        messages {
                            id
                            content
                        }
                    }
                `,
				expected: 'MessageNotifications',
			},
		]

		cases.forEach(({ input, expected }) => {
			expect(extractGraphQLDocumentName(input)).toBe(expected)
		})
	})

	it('should extract fragment names', () => {
		const cases = [
			{
				input: 'fragment UserFields on User { id name }',
				expected: 'UserFields',
			},
			{
				input: `
                    fragment PostDetails on Post {
                        title
                        content
                        author {
                            name
                        }
                    }
                `,
				expected: 'PostDetails',
			},
		]

		cases.forEach(({ input, expected }) => {
			expect(extractGraphQLDocumentName(input)).toBe(expected)
		})
	})

	it('should handle comments correctly', () => {
		const input = `
            # This is a comment
            query UserProfile { # inline comment
                user { # another comment
                    name # field comment
                }
            }
        `
		expect(extractGraphQLDocumentName(input)).toBe('UserProfile')
	})

	it('should handle whitespace variants', () => {
		const cases = [
			{
				input: 'query     UserProfile{user{name}}',
				expected: 'UserProfile',
			},
			{
				input: `query
                    UserProfile
                    {user{name}}`,
				expected: 'UserProfile',
			},
			{
				input: 'fragment   UserFields    on    User{id}',
				expected: 'UserFields',
			},
		]

		cases.forEach(({ input, expected }) => {
			expect(extractGraphQLDocumentName(input)).toBe(expected)
		})
	})

	it('should return null for unnamed operations', () => {
		const cases = [
			'query { user { name } }',
			'mutation { updateUser { success } }',
			'subscription { userEvents { type } }',
			'{ user { name } }', // shorthand query syntax
		]

		cases.forEach((input) => {
			expect(extractGraphQLDocumentName(input)).toBe(null)
		})
	})

	it('should handle invalid or malformed input gracefully', () => {
		const cases = [
			'',
			' ',
			'not a graphql document',
			'query {', // unclosed
			'fragment UserFields on', // incomplete
			'query 123InvalidName { field }', // invalid name
		]

		cases.forEach((input) => {
			expect(extractGraphQLDocumentName(input)).toBe(null)
		})
	})
})
