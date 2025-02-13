package main

import (
	"strings"
	"testing"

	"github.com/spf13/afero"
)

// location holds expected row and column.
type location struct {
	Row int
	Col int
}

// expectedComponentField now also carries expected row/column values.
type expectedComponentField struct {
	Prop           string
	Query          string
	ExpectedRow    int
	ExpectedColumn int
}

func TestProcessFile(t *testing.T) {
	tests := []struct {
		name    string
		content string
		// expected content for GraphQL documents (non‑component)
		expected []string
		// expected starting row/column for each non‑component document
		expectedLocations []location
		// expected component field queries along with the prop and their starting row/column
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
			// Because the query is multi‑line with extra indenting, we are not verifying its offset here.
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
			// Offsets for multi‑line queries are not checked here.
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
			// "graphql(" is 8 characters long; the opening backtick is at index 8 so the content starts at 9.
			expectedLocations: []location{
				{Row: 0, Col: 9},
			},
		},
		{
			name:     "GraphQL call in inline code",
			content:  "if (true) { graphql(`mutation{doSomething}`); }",
			expected: []string{"mutation{doSomething}"},
			// Counting characters: "if (true) { " is 12 characters; then "graphql(" (8 characters) + backtick = 12+8+1 = 21.
			expectedLocations: []location{
				{Row: 0, Col: 21},
			},
		},
		{
			name:     "GraphQL call with extra closing parenthesis",
			content:  "someFunction(graphql(`query{test}`));",
			expected: []string{"query{test}"},
			// "someFunction(" is 13 characters; then "graphql(" (8) + backtick = 13+8+1 = 22.
			expectedLocations: []location{
				{Row: 0, Col: 22},
			},
		},
		{
			name:     "GraphQL call with inline content and no spaces",
			content:  "const x = graphql(`query{user{id,name}}`);",
			expected: []string{"query{user{id,name}}"},
			// "const x = " is 10 characters; then "graphql(" (8) + backtick = 10+8+1 = 19.
			expectedLocations: []location{
				{Row: 0, Col: 19},
			},
		},
		{
			name:     "GraphQL with embedded escaped backticks (single pair)",
			content:  `graphql(` + "`query { field(arg: \"This is a \\`backtick\\` test\") }`" + `)`,
			expected: []string{"query { field(arg: \"This is a `backtick` test\") }"},
			// Again, content starts at index 9.
			expectedLocations: []location{
				{Row: 0, Col: 9},
			},
		},
		{
			name:    "GraphQL with multiple embedded escaped backticks",
			content: `const q = graphql(` + "`mutation { update(arg: \"first \\`one\\`, second \\`two\\`\") }`" + `);`,
			expected: []string{
				`mutation { update(arg: "first ` + "`one`" + `, second ` + "`two`" + `") }`,
			},
			// "const q = " is 10 characters; then "graphql(" (8) + backtick = 10+8+1 = 19.
			expectedLocations: []location{
				{Row: 0, Col: 19},
			},
		},
		{
			name:     "Empty GraphQL content",
			content:  `graphql(` + "``" + `)`,
			expected: []string{""},
			expectedLocations: []location{
				{Row: 0, Col: 9},
			},
		},
		{
			name:     "GraphQL with non-escaped backslashes",
			content:  `graphql(` + "`query { field(arg: \"This has a \\\\n newline\") }`" + `)`,
			expected: []string{`query { field(arg: "This has a \\n newline") }`},
			expectedLocations: []location{
				{Row: 0, Col: 9},
			},
		},
		{
			name:     "GraphQL with multiple adjacent escaped backticks",
			content:  `graphql(` + "`query { field(arg: \"Double: \\`\\`\") }`" + `)`,
			expected: []string{"query { field(arg: \"Double: ``\") }"},
			expectedLocations: []location{
				{Row: 0, Col: 9},
			},
		},
		{
			name:    "Small query (file smaller than chunk)",
			content: "graphql(`query AllUsers { users { id } }`)",
			expected: []string{
				"query AllUsers { users { id } }",
			},
			expectedLocations: []location{
				{Row: 0, Col: 9},
			},
		},
		{
			name: "Large query (file larger than chunk)",
			content: func() string {
				q := "query LargeQuery { " + strings.Repeat("x", 5000) + " }"
				return "graphql(`" + q + "`)"
			}(),
			expected: []string{
				func() string {
					q := "query LargeQuery { " + strings.Repeat("x", 5000) + " }"
					return q
				}(),
			},
			expectedLocations: []location{
				{Row: 0, Col: 9},
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
			// No newline in the file so far; offset = len(prefix) + len("graphql(`") = 4080 + 9 = 4089.
			expectedLocations: []location{
				{Row: 0, Col: 4089},
			},
		},
		{
			name: "One complete query and one spanning boundary",
			content: func() string {
				// firstQuery is fully contained in the first chunk.
				firstQuery := "graphql(`query Query1 { a }`)"
				// Create a filler so that the second query starts at offset 4085.
				filler := strings.Repeat("X", 4085-len(firstQuery))
				// secondQuery will start in the first chunk and extend into the next.
				secondQuery := "graphql(`query Query2 { b }`)"
				return firstQuery + filler + secondQuery
			}(),
			expected: []string{
				"query Query1 { a }",
				"query Query2 { b }",
			},
			// First query:  offset = 9.
			// Second query: firstQuery length + filler = 4085, then add len("graphql(`") (which is 9) → 4094.
			expectedLocations: []location{
				{Row: 0, Col: 9},
				{Row: 0, Col: 4094},
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
					// In this file the first (empty) line is row 0.
					// Row 1: "type Props = {"
					// Row 2: "	user: GraphQL<`{" → the GraphQL content starts immediately after the backtick.
					// Counting characters in row 2 (assuming a tab is 1 char):
					// the line is: "\tuser: GraphQL<`{" so the "{" appears at column 16.
					ExpectedRow:    2,
					ExpectedColumn: 16,
				},
			},
		},
		{
			name: "Component field spanning buffer",
			content: func() string {
				// Create a filler so that the start of the component field appears near the end of the first chunk.
				filler := strings.Repeat("A", 4080)
				// Define the component field block.
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
					ExpectedRow:    2,
					ExpectedColumn: 18,
				},
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Create an in‑memory filesystem.
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

			// Separate discovered documents into non‑component and component fields.
			var normalDocs []DiscoveredDocument
			var compDocs []DiscoveredDocument
			for _, d := range docs {
				if d.Prop == "" {
					normalDocs = append(normalDocs, d)
				} else {
					compDocs = append(compDocs, d)
				}
			}

			// Verify non‑component documents.
			if len(tc.expected) > 0 {
				if len(normalDocs) != len(tc.expected) {
					t.Fatalf("expected %d document(s), got %+v", len(tc.expected), normalDocs)
				}
				for i, exp := range tc.expected {
					if normalDocs[i].Content != exp {
						t.Errorf("document %d: expected content %q, got %q", i, exp, normalDocs[i].Content)
					}
					// If expectedLocations were provided, check row and column.
					if len(tc.expectedLocations) > i {
						expLoc := tc.expectedLocations[i]
						if normalDocs[i].OffsetRow != expLoc.Row || normalDocs[i].OffsetColumn != expLoc.Col {
							t.Errorf("document %d: expected location row %d, col %d, got row %d, col %d",
								i, expLoc.Row, expLoc.Col, normalDocs[i].OffsetRow, normalDocs[i].OffsetColumn)
						}
					}
				}
			} else if len(normalDocs) != 0 {
				t.Errorf("expected no non‑component documents, got %+v", normalDocs)
			}

			// Verify component field documents.
			if len(tc.expectedComponentFields) > 0 {
				if len(compDocs) != len(tc.expectedComponentFields) {
					t.Fatalf("expected %d component field document(s), got %+v", len(tc.expectedComponentFields), compDocs)
				}
				for i, exp := range tc.expectedComponentFields {
					if compDocs[i].Content != exp.Query {
						t.Errorf("component document %d: expected content %q, got %q", i, exp.Query, compDocs[i].Content)
					}
					if compDocs[i].Prop != exp.Prop {
						t.Errorf("component document %d: expected prop %q, got %q", i, exp.Prop, compDocs[i].Prop)
					}
					if compDocs[i].OffsetRow != exp.ExpectedRow || compDocs[i].OffsetColumn != exp.ExpectedColumn {
						t.Errorf("component document %d: expected location row %d, col %d, got row %d, col %d",
							i, exp.ExpectedRow, exp.ExpectedColumn, compDocs[i].OffsetRow, compDocs[i].OffsetColumn)
					}
				}
			} else if len(compDocs) != 0 {
				t.Errorf("expected no component field documents, got %+v", compDocs)
			}

			if err := fs.Remove(filePath); err != nil {
				t.Errorf("failed to remove file: %v", err)
			}
		})
	}
}
