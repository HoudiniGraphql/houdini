package typescript

import (
	"context"
	"fmt"
	"strings"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins"
)

func ConvertToTypeScriptType(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	config plugins.ProjectConfig,
	kind, typeName, typeModifiers string,
) (string, error) {
	var baseType string
	switch kind {
	case "SCALAR":
		baseType = ConvertScalarType(config, typeName)
	case "ENUM":
		baseType = fmt.Sprintf("ValueOf<typeof %s>", typeName)
	case "INPUT":
		baseType = typeName
	default:
		baseType = "any"
	}

	// Apply type modifiers (lists and nullability)
	return ApplyTypeModifiers(baseType, typeModifiers), nil
}

func ApplyTypeModifiers(baseType, modifiers string) string {
	if modifiers == "" {
		return baseType + " | null | undefined"
	}

	// Parse the type modifiers to build the correct TypeScript type
	// The modifiers string represents the GraphQL type structure
	// Examples:
	// "!" = non-null scalar
	// "!]!" = non-null list of non-null items: [String!]!
	// "]" = nullable list of nullable items: [String]
	// "]!" = non-null list of nullable items: [String]!
	// "!]" = nullable list of non-null items: [String!]

	result := baseType

	// Count brackets to determine list nesting
	listDepth := strings.Count(modifiers, "]")

	// Apply list wrappers from innermost to outermost
	for i := 0; i < listDepth; i++ {
		// Find the position of the current ']' bracket (from left to right)
		bracketPos := strings.Index(modifiers, "]")
		if bracketPos == -1 {
			break
		}

		// Check if the element before ']' is '!' (non-null elements)
		elementsNonNull := bracketPos > 0 && modifiers[bracketPos-1] == '!'

		if elementsNonNull {
			// Elements are non-null
			result = fmt.Sprintf("(%s)[]", result)
		} else {
			// Elements can be null
			result = fmt.Sprintf("(%s | null | undefined)[]", result)
		}

		// Remove the processed part for next iteration
		modifiers = modifiers[bracketPos+1:]
	}

	// Check if the final type (or list) is nullable
	if !strings.HasSuffix(modifiers, "!") {
		result = result + " | null | undefined"
	}

	return result
}

func IsOptionalField(typeModifiers string) bool {
	// A field is optional if it's nullable (doesn't end with '!')
	return !strings.HasSuffix(typeModifiers, "!")
}

func ConvertScalarType(config plugins.ProjectConfig, typeName string) string {
	return convertScalarTypeWithVisited(config, typeName, make(map[string]bool))
}

func convertScalarTypeWithVisited(config plugins.ProjectConfig, typeName string, visited map[string]bool) string {
	// Check for cycles to prevent infinite recursion
	if visited[typeName] {
		return "any" // Fallback for circular references
	}

	// Mark this type as visited
	visited[typeName] = true

	// First check if this is a runtime scalar
	if runtimeType, exists := config.RuntimeScalars[typeName]; exists {
		// Handle empty runtime scalar mapping
		if runtimeType == "" {
			return "any"
		}
		// Recursively convert the runtime scalar's equivalent type
		return convertScalarTypeWithVisited(config, runtimeType, visited)
	}

	// Then check built-in GraphQL scalars
	switch typeName {
	case "String", "ID":
		return "string"
	case "Int", "Float":
		return "number"
	case "Boolean":
		return "boolean"
	default:
		// Check if this is a regular custom scalar
		if scalarConfig, exists := config.Scalars[typeName]; exists {
			// Use the configured type for the scalar
			return scalarConfig.Type
		}
		// Unknown scalar, fallback to any
		return "any"
	}
}
