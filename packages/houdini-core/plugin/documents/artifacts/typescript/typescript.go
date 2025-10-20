package typescript

import (
	"fmt"
	"strings"

	"code.houdinigraphql.com/plugins"
)

func ConvertToTypeScriptType(
	config plugins.ProjectConfig,
	kind, typeName, typeModifiers string,
	isInput bool,
) (string, error) {
	baseType := convertScalarType(kind, typeName, config, isInput)
	// Apply type modifiers (lists and nullability)
	return ApplyTypeModifiers(baseType, typeModifiers, isInput), nil
}

// convertScalarType handles the conversion of GraphQL base types to TypeScript base types
// This shared logic is used by both ConvertToTypeScriptType and convertToTypeScriptTypeSimple
func convertScalarType(kind, typeName string, config plugins.ProjectConfig, isInput bool) string {
	switch kind {
	case "SCALAR":
		return ConvertScalarType(config, typeName, isInput)
	case "ENUM":
		return fmt.Sprintf("%s$options", typeName)
	case "INPUT":
		return typeName
	default:
		return "any"
	}
}

func ApplyTypeModifiers(baseType, modifiers string, isInput bool) string {
	if modifiers == "" {
		if isInput {
			return baseType + " | null | undefined"
		} else {
			return baseType + " | null"
		}
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
	for range listDepth {
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
			// Elements can be null (but never undefined, even for input types)
			result = fmt.Sprintf("(%s | null)[]", result)
		}

		// Remove the processed part for next iteration
		modifiers = modifiers[bracketPos+1:]
	}

	// Check if the final type (or list) is nullable
	if !strings.HasSuffix(modifiers, "!") {
		if isInput {
			result = result + " | null | undefined"
		} else {
			result = result + " | null"
		}
	}

	return result
}

func IsOptionalField(typeModifiers string) bool {
	// A field is optional if it's nullable (doesn't end with '!')
	return !strings.HasSuffix(typeModifiers, "!")
}

func ConvertScalarType(config plugins.ProjectConfig, typeName string, isInput bool) string {
	return convertScalarTypeWithVisited(config, typeName, isInput, make(map[string]bool))
}

func convertScalarTypeWithVisited(
	config plugins.ProjectConfig,
	typeName string,
	isInput bool,
	visited map[string]bool,
) string {
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
		return convertScalarTypeWithVisited(config, runtimeType, isInput, visited)
	}

	// Then check built-in GraphQL scalars
	switch typeName {
	case "String":
		return "string"
	case "ID":
		if isInput {
			return "string | number"
		}
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
