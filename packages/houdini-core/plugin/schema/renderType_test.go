package schema

import "testing"

func TestRenderGraphQLType(t *testing.T) {
	// type_modifiers are inner->outer: "]" wraps a list, "!" adds non-null. The renderer
	// must handle arbitrary nesting (list of lists of lists, with non-null at any depth).
	cases := []struct {
		base     string
		modifier string
		want     string
	}{
		{"String", "", "String"},
		{"String", "!", "String!"},
		{"String", "]", "[String]"},
		{"String", "]!", "[String]!"},
		{"String", "!]!", "[String!]!"},
		{"String", "]]", "[[String]]"},
		{"String", "]]]", "[[[String]]]"},
		{"String", "!]!]!", "[[String!]!]!"},
		{"String", "!]]]!", "[[[String!]]]!"},
	}
	for _, tc := range cases {
		if got := renderGraphQLType(tc.base, tc.modifier); got != tc.want {
			t.Errorf("renderGraphQLType(%q, %q) = %q, want %q", tc.base, tc.modifier, got, tc.want)
		}
	}
}
