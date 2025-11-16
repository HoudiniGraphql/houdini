package typescript_test

import (
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents/artifacts/typescript"
	"code.houdinigraphql.com/plugins"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestApplyTypeModifiers(t *testing.T) {
	tests := []struct {
		name      string
		baseType  string
		modifiers string
		expected  string
	}{
		// Scalar types
		{
			name:      "nullable scalar",
			baseType:  "string",
			modifiers: "",
			expected:  "string | null | undefined",
		},
		{
			name:      "non-null scalar",
			baseType:  "string",
			modifiers: "!",
			expected:  "string",
		},

		// Single-level arrays
		{
			name:      "nullable list of nullable items: [String]",
			baseType:  "string",
			modifiers: "]",
			expected:  "(string | null)[] | null | undefined",
		},
		{
			name:      "non-null list of nullable items: [String]!",
			baseType:  "string",
			modifiers: "]!",
			expected:  "(string | null)[]",
		},
		{
			name:      "nullable list of non-null items: [String!]",
			baseType:  "string",
			modifiers: "!]",
			expected:  "(string)[] | null | undefined",
		},
		{
			name:      "non-null list of non-null items: [String!]!",
			baseType:  "string",
			modifiers: "!]!",
			expected:  "(string)[]",
		},

		// Nested arrays (two levels)
		{
			name:      "nullable list of nullable lists of nullable items: [[String]]",
			baseType:  "string",
			modifiers: "]]",
			expected:  "((string | null)[] | null)[] | null | undefined",
		},
		{
			name:      "non-null list of non-null lists of non-null items: [[String!]!]!",
			baseType:  "string",
			modifiers: "!]!]!",
			expected:  "((string)[])[]",
		},
		{
			name:      "nullable list of non-null lists of nullable items: [[String]!]",
			baseType:  "string",
			modifiers: "]!]",
			expected:  "((string | null)[])[] | null | undefined",
		},
		{
			name:      "non-null list of nullable lists of non-null items: [[String!]]!",
			baseType:  "string",
			modifiers: "!]]!",
			expected:  "((string)[] | null)[]",
		},

		// Complex nested scenarios
		{
			name:      "three-level nested arrays: [[[String!]!]!]!",
			baseType:  "string",
			modifiers: "!]!]!]!",
			expected:  "(((string)[])[])[]",
		},

		// Different base types
		{
			name:      "number array",
			baseType:  "number",
			modifiers: "!]!",
			expected:  "(number)[]",
		},
		{
			name:      "boolean nullable array",
			baseType:  "boolean",
			modifiers: "]",
			expected:  "(boolean | null)[] | null | undefined",
		},
		{
			name:      "custom type array",
			baseType:  "User",
			modifiers: "!]",
			expected:  "(User)[] | null | undefined",
		},
		{
			name:      "enum type array",
			baseType:  "ValueOf<typeof MyEnum>",
			modifiers: "]!",
			expected:  "(ValueOf<typeof MyEnum> | null)[]",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := typescript.ApplyTypeModifiers(tt.baseType, tt.modifiers, true) // Input type
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestConvertScalarType(t *testing.T) {
	// Create a basic config for testing
	config := plugins.ProjectConfig{}

	tests := []struct {
		name     string
		typeName string
		expected string
	}{
		{
			name:     "String scalar",
			typeName: "String",
			expected: "string",
		},
		{
			name:     "ID scalar",
			typeName: "ID",
			expected: "string",
		},
		{
			name:     "Int scalar",
			typeName: "Int",
			expected: "number",
		},
		{
			name:     "Float scalar",
			typeName: "Float",
			expected: "number",
		},
		{
			name:     "Boolean scalar",
			typeName: "Boolean",
			expected: "boolean",
		},
		{
			name:     "unknown scalar",
			typeName: "DateTime",
			expected: "any",
		},
		{
			name:     "custom scalar",
			typeName: "UUID",
			expected: "any",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := typescript.ConvertScalarType(config, tt.typeName, false)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestConvertToTypeScriptType(t *testing.T) {
	// Create a test database pool
	db, err := plugins.NewTestPool[config.PluginConfig]()
	require.NoError(t, err)
	defer db.Close()

	// Set up basic project config
	projectConfig := plugins.ProjectConfig{}
	db.SetProjectConfig(projectConfig)

	tests := []struct {
		name          string
		kind          string
		typeName      string
		typeModifiers string
		expected      string
	}{
		// Scalar types
		{
			name:          "nullable String scalar",
			kind:          "SCALAR",
			typeName:      "String",
			typeModifiers: "",
			expected:      "string | null",
		},
		{
			name:          "non-null String scalar",
			kind:          "SCALAR",
			typeName:      "String",
			typeModifiers: "!",
			expected:      "string",
		},
		{
			name:          "nullable ID scalar",
			kind:          "SCALAR",
			typeName:      "ID",
			typeModifiers: "",
			expected:      "string | null",
		},
		{
			name:          "non-null Int scalar",
			kind:          "SCALAR",
			typeName:      "Int",
			typeModifiers: "!",
			expected:      "number",
		},
		{
			name:          "nullable Float scalar",
			kind:          "SCALAR",
			typeName:      "Float",
			typeModifiers: "",
			expected:      "number | null",
		},
		{
			name:          "non-null Boolean scalar",
			kind:          "SCALAR",
			typeName:      "Boolean",
			typeModifiers: "!",
			expected:      "boolean",
		},
		{
			name:          "unknown scalar",
			kind:          "SCALAR",
			typeName:      "DateTime",
			typeModifiers: "!",
			expected:      "any",
		},

		// Enum types
		{
			name:          "nullable enum",
			kind:          "ENUM",
			typeName:      "Status",
			typeModifiers: "",
			expected:      "Status$options | null",
		},
		{
			name:          "non-null enum",
			kind:          "ENUM",
			typeName:      "UserRole",
			typeModifiers: "!",
			expected:      "UserRole$options",
		},

		// Input types
		{
			name:          "nullable input type",
			kind:          "INPUT",
			typeName:      "UserInput",
			typeModifiers: "",
			expected:      "UserInput | null",
		},
		{
			name:          "non-null input type",
			kind:          "INPUT",
			typeName:      "CreateUserInput",
			typeModifiers: "!",
			expected:      "CreateUserInput",
		},

		// Unknown types
		{
			name:          "unknown type kind",
			kind:          "OBJECT",
			typeName:      "User",
			typeModifiers: "!",
			expected:      "any",
		},

		// Array types with scalars
		{
			name:          "non-null array of non-null strings",
			kind:          "SCALAR",
			typeName:      "String",
			typeModifiers: "!]!",
			expected:      "(string)[]",
		},
		{
			name:          "nullable array of nullable numbers",
			kind:          "SCALAR",
			typeName:      "Int",
			typeModifiers: "]",
			expected:      "(number | null)[] | null",
		},

		// Array types with enums
		{
			name:          "non-null array of nullable enums",
			kind:          "ENUM",
			typeName:      "Color",
			typeModifiers: "]!",
			expected:      "(Color$options | null)[]",
		},

		// Array types with input types
		{
			name:          "nullable array of non-null input types",
			kind:          "INPUT",
			typeName:      "FilterInput",
			typeModifiers: "!]",
			expected:      "(FilterInput)[] | null",
		},

		// Nested arrays
		{
			name:          "nested array of strings",
			kind:          "SCALAR",
			typeName:      "String",
			typeModifiers: "!]!]!",
			expected:      "((string)[])[]",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := typescript.ConvertToTypeScriptType(
				projectConfig,
				tt.kind,
				tt.typeName,
				tt.typeModifiers,
				false, // isInput = false for these tests
			)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestApplyTypeModifiers_EdgeCases(t *testing.T) {
	tests := []struct {
		name      string
		baseType  string
		modifiers string
		expected  string
	}{
		{
			name:      "empty base type with modifiers",
			baseType:  "",
			modifiers: "!",
			expected:  "",
		},
		{
			name:      "whitespace in base type",
			baseType:  "string | number",
			modifiers: "!",
			expected:  "string | number",
		},
		{
			name:      "complex base type with parentheses",
			baseType:  "(string | number)",
			modifiers: "]!",
			expected:  "((string | number) | null)[]",
		},
		{
			name:      "very deeply nested arrays",
			baseType:  "string",
			modifiers: "!]!]!]!]!",
			expected:  "((((string)[])[])[])[]",
		},
		{
			name:      "mixed nullability in deep nesting",
			baseType:  "number",
			modifiers: "]!]!]",
			expected:  "(((number | null)[])[])[] | null | undefined",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := typescript.ApplyTypeModifiers(tt.baseType, tt.modifiers, true) // Input type
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestApplyTypeModifiers_RealWorldScenarios(t *testing.T) {
	// Test cases based on common GraphQL schema patterns
	tests := []struct {
		name      string
		baseType  string
		modifiers string
		expected  string
		graphql   string // The GraphQL type this represents
	}{
		{
			name:      "required field",
			baseType:  "string",
			modifiers: "!",
			expected:  "string",
			graphql:   "String!",
		},
		{
			name:      "optional field",
			baseType:  "string",
			modifiers: "",
			expected:  "string | null | undefined",
			graphql:   "String",
		},
		{
			name:      "list of required strings",
			baseType:  "string",
			modifiers: "!]!",
			expected:  "(string)[]",
			graphql:   "[String!]!",
		},
		{
			name:      "optional list of optional strings",
			baseType:  "string",
			modifiers: "]",
			expected:  "(string | null)[] | null | undefined",
			graphql:   "[String]",
		},
		{
			name:      "required list of optional strings",
			baseType:  "string",
			modifiers: "]!",
			expected:  "(string | null)[]",
			graphql:   "[String]!",
		},
		{
			name:      "optional list of required strings",
			baseType:  "string",
			modifiers: "!]",
			expected:  "(string)[] | null | undefined",
			graphql:   "[String!]",
		},
		{
			name:      "pagination connection edges",
			baseType:  "Edge",
			modifiers: "]",
			expected:  "(Edge | null)[] | null | undefined",
			graphql:   "[Edge]",
		},
		{
			name:      "enum array for filters",
			baseType:  "ValueOf<typeof Status>",
			modifiers: "!]",
			expected:  "(ValueOf<typeof Status>)[] | null | undefined",
			graphql:   "[Status!]",
		},
		{
			name:      "nested input for complex filters",
			baseType:  "UserFilterInput",
			modifiers: "!]!]!",
			expected:  "((UserFilterInput)[])[]",
			graphql:   "[[UserFilterInput!]!]!",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := typescript.ApplyTypeModifiers(tt.baseType, tt.modifiers, true) // Input type
			assert.Equal(t, tt.expected, result, "GraphQL type: %s", tt.graphql)
		})
	}
}

func TestApplyTypeModifiers_OutputTypes(t *testing.T) {
	// Test cases for output types (no | undefined)
	tests := []struct {
		name      string
		baseType  string
		modifiers string
		expected  string
	}{
		{
			name:      "nullable scalar output",
			baseType:  "string",
			modifiers: "",
			expected:  "string | null",
		},
		{
			name:      "non-null scalar output",
			baseType:  "string",
			modifiers: "!",
			expected:  "string",
		},
		{
			name:      "nullable array of nullable items output",
			baseType:  "string",
			modifiers: "]",
			expected:  "(string | null)[] | null",
		},
		{
			name:      "non-null array of non-null items output",
			baseType:  "string",
			modifiers: "!]!",
			expected:  "(string)[]",
		},
		{
			name:      "nullable array of non-null items output",
			baseType:  "string",
			modifiers: "!]",
			expected:  "(string)[] | null",
		},
		{
			name:      "non-null array of nullable items output",
			baseType:  "string",
			modifiers: "]!",
			expected:  "(string | null)[]",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := typescript.ApplyTypeModifiers(tt.baseType, tt.modifiers, false) // Output type
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestApplyTypeModifiers_InputArrayElements(t *testing.T) {
	// Test cases specifically for the rule that array elements should never have | undefined
	tests := []struct {
		name      string
		baseType  string
		modifiers string
		expected  string
		note      string
	}{
		{
			name:      "nullable array of nullable IDs - correct behavior",
			baseType:  "string | number",
			modifiers: "]",
			expected:  "(string | number | null)[] | null | undefined",
			note:      "Array elements can be null but never undefined",
		},
		{
			name:      "deeply nested arrays - no undefined in elements",
			baseType:  "string",
			modifiers: "]]",
			expected:  "((string | null)[] | null)[] | null | undefined",
			note:      "Only outermost type gets | undefined",
		},
		{
			name:      "three-level nesting - undefined only at root",
			baseType:  "string",
			modifiers: "]]]",
			expected:  "(((string | null)[] | null)[] | null)[] | null | undefined",
			note:      "All array elements use | null, only root uses | undefined",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := typescript.ApplyTypeModifiers(tt.baseType, tt.modifiers, true) // Input type
			assert.Equal(t, tt.expected, result, "Note: %s", tt.note)
		})
	}
}

func TestConvertScalarType_WithRuntimeScalars(t *testing.T) {
	// Test with runtime scalars configuration
	config := plugins.ProjectConfig{
		RuntimeScalars: map[string]string{
			"DateTime":        "String",
			"UUID":            "ID",
			"UserFromSession": "ID",
			"JSON":            "String",
			"ChainedScalar":   "DateTime", // This should resolve to String via DateTime -> String
		},
		Scalars: map[string]plugins.ScalarConfig{
			"CustomDate": {
				Type: "Date",
			},
			"Money": {
				Type: "number",
			},
		},
	}

	tests := []struct {
		name     string
		typeName string
		expected string
	}{
		{
			name:     "built-in String",
			typeName: "String",
			expected: "string",
		},
		{
			name:     "built-in Int",
			typeName: "Int",
			expected: "number",
		},
		{
			name:     "built-in ID",
			typeName: "ID",
			expected: "string",
		},
		{
			name:     "runtime scalar DateTime -> String",
			typeName: "DateTime",
			expected: "string",
		},
		{
			name:     "runtime scalar UUID -> ID",
			typeName: "UUID",
			expected: "string",
		},
		{
			name:     "runtime scalar UserFromSession -> ID",
			typeName: "UserFromSession",
			expected: "string",
		},
		{
			name:     "runtime scalar JSON -> String",
			typeName: "JSON",
			expected: "string",
		},
		{
			name:     "chained runtime scalar ChainedScalar -> DateTime -> String",
			typeName: "ChainedScalar",
			expected: "string",
		},
		{
			name:     "regular custom scalar with type config",
			typeName: "CustomDate",
			expected: "Date",
		},
		{
			name:     "regular custom scalar Money",
			typeName: "Money",
			expected: "number",
		},
		{
			name:     "unknown scalar",
			typeName: "UnknownScalar",
			expected: "any",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := typescript.ConvertScalarType(config, tt.typeName, false)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestConvertToTypeScriptType_WithRuntimeScalars(t *testing.T) {
	// Create a test database pool
	db, err := plugins.NewTestPool[config.PluginConfig]()
	require.NoError(t, err)
	defer db.Close()

	// Set up project config with runtime scalars
	projectConfig := plugins.ProjectConfig{
		RuntimeScalars: map[string]string{
			"DateTime":        "String",
			"UserFromSession": "ID",
			"JSON":            "String",
		},
		Scalars: map[string]plugins.ScalarConfig{
			"Money": {
				Type: "number",
			},
		},
	}
	db.SetProjectConfig(projectConfig)

	tests := []struct {
		name          string
		kind          string
		typeName      string
		typeModifiers string
		expected      string
	}{
		{
			name:          "runtime scalar DateTime as nullable",
			kind:          "SCALAR",
			typeName:      "DateTime",
			typeModifiers: "",
			expected:      "string | null",
		},
		{
			name:          "runtime scalar DateTime as non-null",
			kind:          "SCALAR",
			typeName:      "DateTime",
			typeModifiers: "!",
			expected:      "string",
		},
		{
			name:          "runtime scalar UserFromSession as non-null",
			kind:          "SCALAR",
			typeName:      "UserFromSession",
			typeModifiers: "!",
			expected:      "string",
		},
		{
			name:          "runtime scalar in array: [DateTime!]!",
			kind:          "SCALAR",
			typeName:      "DateTime",
			typeModifiers: "!]!",
			expected:      "(string)[]",
		},
		{
			name:          "runtime scalar in nullable array: [UserFromSession]",
			kind:          "SCALAR",
			typeName:      "UserFromSession",
			typeModifiers: "]",
			expected:      "(string | null)[] | null",
		},
		{
			name:          "regular custom scalar Money",
			kind:          "SCALAR",
			typeName:      "Money",
			typeModifiers: "!",
			expected:      "number",
		},
		{
			name:          "built-in scalar still works",
			kind:          "SCALAR",
			typeName:      "String",
			typeModifiers: "!",
			expected:      "string",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := typescript.ConvertToTypeScriptType(
				projectConfig,
				tt.kind,
				tt.typeName,
				tt.typeModifiers,
				false, // isInput = false for these tests
			)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestConvertScalarType_EdgeCases(t *testing.T) {
	tests := []struct {
		name     string
		config   plugins.ProjectConfig
		typeName string
		expected string
	}{
		{
			name: "circular runtime scalar reference",
			config: plugins.ProjectConfig{
				RuntimeScalars: map[string]string{
					"A": "B",
					"B": "A", // This would cause infinite recursion if not handled
				},
			},
			typeName: "A",
			expected: "any", // Should fallback to any to prevent infinite recursion
		},
		{
			name: "self-referencing runtime scalar",
			config: plugins.ProjectConfig{
				RuntimeScalars: map[string]string{
					"SelfRef": "SelfRef",
				},
			},
			typeName: "SelfRef",
			expected: "any", // Should fallback to any
		},
		{
			name: "runtime scalar pointing to non-existent type",
			config: plugins.ProjectConfig{
				RuntimeScalars: map[string]string{
					"DateTime": "NonExistentType",
				},
			},
			typeName: "DateTime",
			expected: "any", // Should fallback to any
		},
		{
			name: "runtime scalar with empty mapping",
			config: plugins.ProjectConfig{
				RuntimeScalars: map[string]string{
					"Empty": "",
				},
			},
			typeName: "Empty",
			expected: "any", // Empty string should fallback to any
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := typescript.ConvertScalarType(tt.config, tt.typeName, false)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestIsOptionalField(t *testing.T) {
	tests := []struct {
		name          string
		typeModifiers string
		expected      bool
	}{
		{
			name:          "nullable scalar",
			typeModifiers: "",
			expected:      true,
		},
		{
			name:          "non-null scalar",
			typeModifiers: "!",
			expected:      false,
		},
		{
			name:          "nullable array",
			typeModifiers: "]",
			expected:      true,
		},
		{
			name:          "non-null array",
			typeModifiers: "]!",
			expected:      false,
		},
		{
			name:          "nullable array of non-null items",
			typeModifiers: "!]",
			expected:      true,
		},
		{
			name:          "non-null array of non-null items",
			typeModifiers: "!]!",
			expected:      false,
		},
		{
			name:          "nested nullable array",
			typeModifiers: "]]",
			expected:      true,
		},
		{
			name:          "nested non-null array",
			typeModifiers: "]]!",
			expected:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := typescript.IsOptionalField(tt.typeModifiers)
			assert.Equal(t, tt.expected, result)
		})
	}
}
