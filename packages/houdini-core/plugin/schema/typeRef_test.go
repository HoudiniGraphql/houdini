package schema_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-core/plugin/schema"
)

func TestParseTypeRef(t *testing.T) {
	for _, tc := range []struct {
		modifiers string
		expected  string
	}{
		{"", "T"},
		{"!", "T!"},
		{"]", "[T]"},
		{"]!", "[T]!"},
		{"!]", "[T!]"},
		{"!]!", "[T!]!"},
		{"]]", "[[T]]"},
		{"]!]", "[[T]!]"},
		{"!]!]!", "[[T!]!]!"},
	} {
		t.Run(tc.expected, func(t *testing.T) {
			require.Equal(t, tc.expected, printTypeRef(schema.ParseTypeRef(tc.modifiers)))
		})
	}
}

// printTypeRef renders a TypeRef back to GraphQL syntax with a T base type so
// the parse tests read naturally
func printTypeRef(ref *schema.TypeRef) string {
	if ref == nil {
		return "T"
	}
	result := "T"
	if !ref.IsList {
		if ref.NonNull {
			result += "!"
		}
		return result
	}
	result = "[" + printTypeRef(ref.Inner) + "]"
	if ref.NonNull {
		result += "!"
	}
	return result
}

func TestVariableTypeCompatible(t *testing.T) {
	// the full truth table for variable usage without default values
	for _, tc := range []struct {
		variable string
		location string
		ok       bool
	}{
		// single values
		{"", "", true},
		{"!", "", true},
		{"!", "!", true},
		{"", "!", false},

		// lists
		{"]", "]", true},
		{"]!", "]", true},
		{"!]", "]", true},
		{"!]!", "]", true},

		{"]", "]!", false},
		{"]!", "]!", true},
		{"!]", "]!", false},
		{"!]!", "]!", true},

		{"]", "!]", false},
		{"]!", "!]", false},
		{"!]", "!]", true},
		{"!]!", "!]", true},

		{"]", "!]!", false},
		{"]!", "!]!", false},
		{"!]", "!]!", false},
		{"!]!", "!]!", true},

		// list depth must match exactly
		{"", "]", false},
		{"]", "", false},
		{"]]", "]", false},
		{"]", "]]", false},
	} {
		name := printTypeRef(schema.ParseTypeRef(tc.variable)) + " -> " + printTypeRef(
			schema.ParseTypeRef(tc.location),
		)
		t.Run(name, func(t *testing.T) {
			require.Equal(
				t,
				tc.ok,
				schema.VariableTypeCompatible(
					schema.ParseTypeRef(tc.variable),
					schema.ParseTypeRef(tc.location),
					false,
				),
			)
		})
	}
}

func TestVariableTypeCompatibleWithDefault(t *testing.T) {
	// a non-null default forgives a nullable variable at the outermost level only
	for _, tc := range []struct {
		variable string
		location string
		ok       bool
	}{
		{"", "!", true},
		{"]", "]!", true},
		// the default does not forgive inner levels
		{"]", "!]!", false},
		{"!]", "!]!", true},
		// base types still have to line up in depth
		{"", "]", false},
	} {
		name := printTypeRef(schema.ParseTypeRef(tc.variable)) + " -> " + printTypeRef(
			schema.ParseTypeRef(tc.location),
		) + " (default)"
		t.Run(name, func(t *testing.T) {
			require.Equal(
				t,
				tc.ok,
				schema.VariableTypeCompatible(
					schema.ParseTypeRef(tc.variable),
					schema.ParseTypeRef(tc.location),
					true,
				),
			)
		})
	}
}

func TestLiteralKindAssignable(t *testing.T) {
	for _, tc := range []struct {
		typeName   string
		kind       string
		assignable bool
		known      bool
	}{
		{"Int", "Int", true, true},
		{"Int", "Float", false, true},
		{"Float", "Int", true, true},
		{"Float", "Float", true, true},
		{"String", "String", true, true},
		{"String", "Block", true, true},
		{"String", "Int", false, true},
		{"Boolean", "Boolean", true, true},
		{"Boolean", "String", false, true},
		{"ID", "String", true, true},
		{"ID", "Int", true, true},
		{"ID", "Boolean", false, true},
		{"Date", "String", false, false},
		{"Role", "Enum", false, false},
	} {
		t.Run(tc.typeName+" <- "+tc.kind, func(t *testing.T) {
			assignable, known := schema.LiteralKindAssignable(tc.typeName, tc.kind)
			require.Equal(t, tc.known, known)
			if known {
				require.Equal(t, tc.assignable, assignable)
			}
		})
	}
}
