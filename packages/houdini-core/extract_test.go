package main

import (
	"strings"
	"testing"
)

// trim is a helper function to remove extra whitespace from both ends of a string.
// This helps when comparing multiline strings.
func trim(s string) string {
	return strings.TrimSpace(s)
}

// TestExtractGraphQLStrings iterates over a set of test cases including edge cases.
func TestExtractGraphQLStrings(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []string
	}{
		{
			name: "Single GraphQL with whitespace",
			input: `
				const [__, create] = useMutation(
					graphql(` + "`" + `
						mutation OptimisticKeyTestCreateMutation($name: String!, $birthDate: DateTime!) {
							addUser(
								snapshot: "OptimisticKeyTest"
								name: $name
								birthDate: $birthDate
								delay: 400
							) {
								id @optimisticKey
								...OptimisticKeyTest_insert @mask_disable @prepend
							}
						}
					` + "`" + `)
				);
			`,
			expected: []string{
				`
						mutation OptimisticKeyTestCreateMutation($name: String!, $birthDate: DateTime!) {
							addUser(
								snapshot: "OptimisticKeyTest"
								name: $name
								birthDate: $birthDate
								delay: 400
							) {
								id @optimisticKey
								...OptimisticKeyTest_insert @mask_disable @prepend
							}
						}
				`,
			},
		},
		{
			name: "Multiple GraphQL calls",
			input: `
				const [__, create1] = useMutation(
					graphql(` + "`" + `
						query One {
							fieldA
						}
					` + "`" + `)
				);
				const [__, create2] = useMutation(
					graphql(` + "`" + `
						mutation Two($id: ID!) {
							doSomething(id: $id)
						}
					` + "`" + `)
				);
			`,
			expected: []string{
				`
						query One {
							fieldA
						}
				`,
				`
						mutation Two($id: ID!) {
							doSomething(id: $id)
						}
				`,
			},
		},
		{
			name:     "No GraphQL call",
			input:    `const a = "no graphql here";`,
			expected: []string{},
		},
		{
			name:     "GraphQL call without extra whitespace",
			input:    `graphql(` + "`query{test}`" + `)`,
			expected: []string{"query{test}"},
		},
		{
			name:     "GraphQL call in inline code",
			input:    `if (true) { graphql(` + "`mutation{doSomething}`" + `); }`,
			expected: []string{"mutation{doSomething}"},
		},
		{
			name:     "GraphQL call with extra closing parenthesis",
			input:    `someFunction(graphql(` + "`query{test}`" + `));`,
			expected: []string{"query{test}"},
		},
		{
			name:     "GraphQL call with inline content and no spaces",
			input:    `const x = graphql(` + "`query{user{id,name}}`" + `);`,
			expected: []string{"query{user{id,name}}"},
		},
		{
			name: "GraphQL with embedded escaped backticks (single pair)",
			// In JavaScript, to include a literal backtick inside a template literal,
			// it must be escaped as \`. The extraction function should unescape it.
			input:    `graphql(` + "`query { field(arg: \"This is a \\`backtick\\` test\") }`" + `)`,
			expected: []string{"query { field(arg: \"This is a `backtick` test\") }"},
		},
		{
			name:  "GraphQL with multiple embedded escaped backticks",
			input: `const q = graphql(` + "`mutation { update(arg: \"first \\`one\\`, second \\`two\\`\") }`" + `);`,
			expected: []string{
				`mutation { update(arg: "first ` + "`one`" + `, second ` + "`two`" + `") }`,
			},
		},
		{
			name:     "Empty GraphQL content",
			input:    `graphql(` + "``" + `)`,
			expected: []string{""},
		},
		{
			name: "GraphQL with non-escaped backslashes",
			// A backslash not preceding a backtick should remain unchanged.
			input:    `graphql(` + "`query { field(arg: \"This has a \\\\n newline\") }`" + `)`,
			expected: []string{`query { field(arg: "This has a \\n newline") }`},
		},
		{
			name: "GraphQL with multiple adjacent escaped backticks",
			// Two adjacent \` sequences should become two literal backticks.
			input:    `graphql(` + "`query { field(arg: \"Double: \\`\\`\") }`" + `)`,
			expected: []string{"query { field(arg: \"Double: ``\") }"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			results, err := extractGraphQLStrings(tc.input)
			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			if len(results) != len(tc.expected) {
				t.Errorf("Test %q: expected %d match(es), got %d", tc.name, len(tc.expected), len(results))
				return
			}

			// Compare each expected string to the corresponding result after trimming.
			for i, expectedStr := range tc.expected {
				if trim(results[i]) != trim(expectedStr) {
					t.Errorf("Test %q, match %d - expected:\n%q\ngot:\n%q", tc.name, i, trim(expectedStr), trim(results[i]))
				}
			}
		})
	}
}
