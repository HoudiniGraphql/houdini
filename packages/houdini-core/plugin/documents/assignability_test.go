package documents

import (
	"testing"

	"github.com/stretchr/testify/require"
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
			require.Equal(t, tc.expected, printTypeRef(parseTypeRef(tc.modifiers)))
		})
	}
}

// printTypeRef renders a typeRef back to GraphQL syntax with a T base type so
// the parse tests read naturally
func printTypeRef(ref *typeRef) string {
	if ref == nil {
		return "T"
	}
	result := "T"
	if !ref.isList {
		if ref.nonNull {
			result += "!"
		}
		return result
	}
	result = "[" + printTypeRef(ref.inner) + "]"
	if ref.nonNull {
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
		name := printTypeRef(parseTypeRef(tc.variable)) + " -> " + printTypeRef(
			parseTypeRef(tc.location),
		)
		t.Run(name, func(t *testing.T) {
			require.Equal(
				t,
				tc.ok,
				variableTypeCompatible(parseTypeRef(tc.variable), parseTypeRef(tc.location), false),
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
		name := printTypeRef(parseTypeRef(tc.variable)) + " -> " + printTypeRef(
			parseTypeRef(tc.location),
		) + " (default)"
		t.Run(name, func(t *testing.T) {
			require.Equal(
				t,
				tc.ok,
				variableTypeCompatible(parseTypeRef(tc.variable), parseTypeRef(tc.location), true),
			)
		})
	}
}

func TestValidArgumentValue(t *testing.T) {
	for _, tc := range []struct {
		name  string
		check argumentValueCheck
		ok    bool
	}{
		// scalar literals
		{
			"int for Int",
			argumentValueCheck{Kind: "Int", ExpectedType: "Int", ExpectedTypeKind: "SCALAR"},
			true,
		},
		{
			"int for Float",
			argumentValueCheck{Kind: "Int", ExpectedType: "Float", ExpectedTypeKind: "SCALAR"},
			true,
		},
		{
			"float for Int",
			argumentValueCheck{Kind: "Float", ExpectedType: "Int", ExpectedTypeKind: "SCALAR"},
			false,
		},
		{
			"int for ID",
			argumentValueCheck{Kind: "Int", ExpectedType: "ID", ExpectedTypeKind: "SCALAR"},
			true,
		},
		{
			"block string for String",
			argumentValueCheck{Kind: "Block", ExpectedType: "String", ExpectedTypeKind: "SCALAR"},
			true,
		},
		{
			"int for String",
			argumentValueCheck{Kind: "Int", ExpectedType: "String", ExpectedTypeKind: "SCALAR"},
			false,
		},
		{
			"string for Boolean",
			argumentValueCheck{Kind: "String", ExpectedType: "Boolean", ExpectedTypeKind: "SCALAR"},
			false,
		},

		// single-value list coercion: a literal can fill a list location
		{
			"int for [ID!]!",
			argumentValueCheck{
				Kind:              "Int",
				ExpectedType:      "ID",
				ExpectedModifiers: "!]!",
				ExpectedTypeKind:  "SCALAR",
			},
			true,
		},

		// custom scalars
		{
			"configured custom scalar",
			argumentValueCheck{
				Kind:             "String",
				ExpectedType:     "Date",
				ExpectedTypeKind: "SCALAR",
				ScalarInputOK:    true,
			},
			true,
		},
		{
			"unconfigured custom scalar",
			argumentValueCheck{
				Kind:             "String",
				ExpectedType:     "Date",
				ExpectedTypeKind: "SCALAR",
				ScalarInputOK:    false,
			},
			false,
		},

		// enums
		{
			"valid enum value",
			argumentValueCheck{
				Kind:             "Enum",
				ExpectedType:     "Role",
				ExpectedTypeKind: "ENUM",
				EnumValueOK:      true,
			},
			true,
		},
		{
			"unknown enum value",
			argumentValueCheck{
				Kind:             "Enum",
				ExpectedType:     "Role",
				ExpectedTypeKind: "ENUM",
				EnumValueOK:      false,
			},
			false,
		},
		{
			"string for enum",
			argumentValueCheck{Kind: "String", ExpectedType: "Role", ExpectedTypeKind: "ENUM"},
			false,
		},
		{
			"enum for String",
			argumentValueCheck{Kind: "Enum", ExpectedType: "String", ExpectedTypeKind: "SCALAR"},
			false,
		},

		// null
		{
			"null for nullable",
			argumentValueCheck{Kind: "Null", ExpectedType: "ID", ExpectedTypeKind: "SCALAR"},
			true,
		},
		{
			"null for non-null",
			argumentValueCheck{
				Kind:              "Null",
				ExpectedType:      "ID",
				ExpectedModifiers: "!",
				ExpectedTypeKind:  "SCALAR",
			},
			false,
		},
		{
			"null for nullable list of non-null",
			argumentValueCheck{
				Kind:              "Null",
				ExpectedType:      "ID",
				ExpectedModifiers: "!]",
				ExpectedTypeKind:  "SCALAR",
			},
			true,
		},

		// lists
		{
			"list for nullable list",
			argumentValueCheck{
				Kind:              "List",
				ExpectedType:      "String",
				ExpectedModifiers: "]",
				ExpectedTypeKind:  "SCALAR",
			},
			true,
		},
		{
			"list for non-null list",
			argumentValueCheck{
				Kind:              "List",
				ExpectedType:      "ID",
				ExpectedModifiers: "!]!",
				ExpectedTypeKind:  "SCALAR",
			},
			true,
		},
		{
			"list for non-list",
			argumentValueCheck{
				Kind:             "List",
				ExpectedType:     "String",
				ExpectedTypeKind: "SCALAR",
			},
			false,
		},
		{
			"list for non-null scalar",
			argumentValueCheck{
				Kind:              "List",
				ExpectedType:      "String",
				ExpectedModifiers: "!",
				ExpectedTypeKind:  "SCALAR",
			},
			false,
		},

		// objects
		{
			"object for input",
			argumentValueCheck{Kind: "Object", ExpectedType: "Filter", ExpectedTypeKind: "INPUT"},
			true,
		},
		{
			"object for input list",
			argumentValueCheck{
				Kind:              "Object",
				ExpectedType:      "Filter",
				ExpectedModifiers: "]",
				ExpectedTypeKind:  "INPUT",
			},
			true,
		},
		{
			"object for scalar",
			argumentValueCheck{Kind: "Object", ExpectedType: "String", ExpectedTypeKind: "SCALAR"},
			false,
		},

		// variables
		{
			"variable exact match",
			argumentValueCheck{
				Kind:              "Variable",
				ExpectedType:      "ID",
				ExpectedModifiers: "!",
				ExpectedTypeKind:  "SCALAR",
				VariableDefined:   true,
				VariableType:      "ID",
				VariableModifiers: "!",
			},
			true,
		},
		{
			"nullable variable for non-null location",
			argumentValueCheck{
				Kind:              "Variable",
				ExpectedType:      "ID",
				ExpectedModifiers: "!",
				ExpectedTypeKind:  "SCALAR",
				VariableDefined:   true,
				VariableType:      "ID",
			},
			false,
		},
		{
			"nullable variable with default for non-null location",
			argumentValueCheck{
				Kind:                      "Variable",
				ExpectedType:              "ID",
				ExpectedModifiers:         "!",
				ExpectedTypeKind:          "SCALAR",
				VariableDefined:           true,
				VariableType:              "ID",
				VariableHasNonNullDefault: true,
			},
			true,
		},
		{
			"default does not forgive inner nullability",
			argumentValueCheck{
				Kind:                      "Variable",
				ExpectedType:              "ID",
				ExpectedModifiers:         "!]!",
				ExpectedTypeKind:          "SCALAR",
				VariableDefined:           true,
				VariableType:              "ID",
				VariableModifiers:         "]",
				VariableHasNonNullDefault: true,
			},
			false,
		},
		{
			"variable base type mismatch",
			argumentValueCheck{
				Kind:             "Variable",
				ExpectedType:     "ID",
				ExpectedTypeKind: "SCALAR",
				VariableDefined:  true,
				VariableType:     "String",
			},
			false,
		},
		{
			"undefined variables are someone else's problem",
			argumentValueCheck{
				Kind:             "Variable",
				ExpectedType:     "ID",
				ExpectedTypeKind: "SCALAR",
			},
			true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.ok, validArgumentValue(tc.check))
		})
	}
}
