package main

import (
	"strings"
	"testing"

	"github.com/spf13/afero"
)

func TestProcessFile(t *testing.T) {
	tests := []struct {
		name                    string
		content                 string
		expected                []string
		expectedComponentFields []expectedComponentField
	}{
		{
			name: "Single GraphQL with whitespace",
			content: `
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
			content: `
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
			content:  `const a = "no graphql here";`,
			expected: []string{},
		},
		{
			name:     "GraphQL call without extra whitespace",
			content:  "graphql(`query{test}`)",
			expected: []string{"query{test}"},
		},
		{
			name:     "GraphQL call in inline code",
			content:  "if (true) { graphql(`mutation{doSomething}`); }",
			expected: []string{"mutation{doSomething}"},
		},
		{
			name:     "GraphQL call with extra closing parenthesis",
			content:  "someFunction(graphql(`query{test}`));",
			expected: []string{"query{test}"},
		},
		{
			name:     "GraphQL call with inline content and no spaces",
			content:  "const x = graphql(`query{user{id,name}}`);",
			expected: []string{"query{user{id,name}}"},
		},
		{
			name:     "GraphQL with embedded escaped backticks (single pair)",
			content:  `graphql(` + "`query { field(arg: \"This is a \\`backtick\\` test\") }`" + `)`,
			expected: []string{"query { field(arg: \"This is a `backtick` test\") }"},
		},
		{
			name:    "GraphQL with multiple embedded escaped backticks",
			content: `const q = graphql(` + "`mutation { update(arg: \"first \\`one\\`, second \\`two\\`\") }`" + `);`,
			expected: []string{
				`mutation { update(arg: "first ` + "`one`" + `, second ` + "`two`" + `") }`,
			},
		},
		{
			name:     "Empty GraphQL content",
			content:  `graphql(` + "``" + `)`,
			expected: []string{""},
		},
		{
			name:     "GraphQL with non-escaped backslashes",
			content:  `graphql(` + "`query { field(arg: \"This has a \\\\n newline\") }`" + `)`,
			expected: []string{`query { field(arg: "This has a \\n newline") }`},
		},
		{
			name:     "GraphQL with multiple adjacent escaped backticks",
			content:  `graphql(` + "`query { field(arg: \"Double: \\`\\`\") }`" + `)`,
			expected: []string{"query { field(arg: \"Double: ``\") }"},
		},
		{
			name:    "Small query (file smaller than chunk)",
			content: "graphql(`query AllUsers { users { id } }`)",
			expected: []string{
				"query AllUsers { users { id } }",
			},
		},
		{
			name: "Large query (file larger than chunk)",
			content: func() string {
				q := "query LargeQuery { " + strings.Repeat("x", 5000) + " }"
				return "graphql(`" + q + "`)"
			}(),
			expected: []string{
				"query LargeQuery { " + strings.Repeat("x", 5000) + " }",
			},
		},
		{
			name: "Spanning boundary query",
			content: func() string {
				prefix := strings.Repeat("A", 4080)
				queryBody := "query Spanning { users { id } }"
				firstPart := queryBody[:7]
				secondPart := queryBody[7:]
				return prefix + "graphql(`" + firstPart + secondPart + "`)"
			}(),
			expected: []string{
				"query Spanning { users { id } }",
			},
		}, {
			name: "One complete query and one spanning boundary",
			content: func() string {
				// firstQuery is fully contained in the first chunk.
				firstQuery := "graphql(`query Query1 { a }`)"
				// Compute a filler so that the second query starts at offset 4085.
				filler := strings.Repeat("X", 4085-len(firstQuery))
				// secondQuery will start in the first chunk and extend into the next.
				secondQuery := "graphql(`query Query2 { b }`)"
				return firstQuery + filler + secondQuery
			}(),
			expected: []string{
				"query Query1 { a }",
				"query Query2 { b }",
			},
		},
		{
			name: "Component field as type parameter",
			content: `
type Props = {
	user: GraphQL<` + "`" + `{
        ... on User
			@componentField(field: "CF_A_UserAvatar")
			@arguments(size: { type: "Int" })
		{
            avatarURL(size: $size)
        }
    }` + "`" + `>
}

export default function CF_A_UserAvatar({ user }: Props) {
	return (
		<>
			<img src={user?.avatarURL} width={100} />
		</>
	)
}
			`,
			expectedComponentFields: []expectedComponentField{
				{
					Prop: "user",
					Query: `{
        ... on User
			@componentField(field: "CF_A_UserAvatar")
			@arguments(size: { type: "Int" })
		{
            avatarURL(size: $size)
        }
    }`,
				},
			},
		},
		{
			name: "Component field spanning buffer",
			content: func() string {
				// Create a filler so that the start of the component field appears near the end of the first chunk.
				// Our chunkSize is 4096 so using 4080 bytes here means that the component field will begin
				// in the first chunk and finish in the next.
				filler := strings.Repeat("A", 4080)
				// Define the component field block.
				// Note that we use string concatenation to insert a literal backtick.
				block := `
		type Props = {
			user: GraphQL<` + "`" + `{
				... on User
					@componentField(field: "CF_Spanning")
					@arguments(size: { type: "Int" })
				{
					avatarURL(size: $size)
				}
			}` + "`" + `>
		}
		`
				return filler + block
			}(),
			expectedComponentFields: []expectedComponentField{
				{
					Prop: "user",
					Query: `{
				... on User
					@componentField(field: "CF_Spanning")
					@arguments(size: { type: "Int" })
				{
					avatarURL(size: $size)
				}
			}`,
				},
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Create an in-memory filesystem.
			fs := afero.NewMemMapFs()
			filePath := "/testfile.txt"
			if err := afero.WriteFile(fs, filePath, []byte(tc.content), 0644); err != nil {
				t.Fatalf("failed to write file: %v", err)
			}

			resultsCh := make(chan DiscoveredDocument, 10)
			go func() {
				if err := processFile(fs, filePath, resultsCh); err != nil {
					t.Errorf("processFile returned error: %v", err)
				}
				close(resultsCh)
			}()

			var docs []DiscoveredDocument
			for doc := range resultsCh {
				docs = append(docs, doc)
			}

			if len(tc.expected) > 0 {
				if len(docs) != len(tc.expected) {
					t.Fatalf("expected %d document(s), got %+v", len(tc.expected), docs)
				}

				for i, exp := range tc.expected {
					if docs[i].Content != exp {
						t.Errorf("document %d: expected %q, got %q", i, exp, docs[i].Content)
					}
				}
			}

			if len(tc.expectedComponentFields) > 0 {
				for i, exp := range tc.expectedComponentFields {
					if len(docs) <= i {
						t.Fatalf("not enough documents were found. Needed at least %d, got %d", i+1, len(docs))
					}
					if docs[i].Content != exp.Query {
						t.Errorf("document %d: expected %q, got %q", i, exp, docs[i].Content)
					}
					if docs[i].Prop != exp.Prop {
						t.Errorf("document %d: expected %q, got %q", i, exp, docs[i].Content)
					}
				}

			}

			if err := fs.Remove(filePath); err != nil {
				t.Errorf("failed to remove file: %v", err)
			}
		})
	}
}

type expectedComponentField struct {
	Prop  string
	Query string
}
