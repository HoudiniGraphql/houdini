package documents

import (
	"strings"

	"code.houdinigraphql.com/packages/houdini-core/plugin/schema"
)

// argumentValueCheck carries everything needed to decide whether a single
// argument value row is assignable to its expected type.
type argumentValueCheck struct {
	// Kind is the literal kind recorded at extraction: Int, Float, String,
	// Block, Boolean, Null, Enum, List, Object, or Variable
	Kind              string
	ExpectedType      string
	ExpectedModifiers string
	// ExpectedTypeKind is types.kind for the expected base type ('' if unknown)
	ExpectedTypeKind string
	// ScalarInputOK is true when the expected type is a custom scalar whose
	// configured input_types include this literal kind
	ScalarInputOK bool
	// EnumValueOK is true when the raw value matches one of the expected
	// enum's values
	EnumValueOK bool

	VariableDefined           bool
	VariableType              string
	VariableModifiers         string
	VariableHasNonNullDefault bool
}

// validArgumentValue reports whether the value is assignable to its expected
// type per the spec's "Values of Correct Type" rule plus input coercion: a
// non-list value is accepted at a list location (single-value coercion), and a
// literal's own non-nullness satisfies any '!' wrappers, so for literals only
// the base types need to be compared.
func validArgumentValue(value argumentValueCheck) bool {
	// values passed to @with and @arguments are typed against the synthetic
	// __ArgumentSpecification type; the fragmentArguments plugin checks them
	// against the fragment's declared argument types
	if value.ExpectedType == schema.ArgumentSpecificationType {
		return true
	}

	// @when/@when_not arguments match against list filters, not schema types —
	// there is nothing to validate them against
	if value.ExpectedType == whenPassthroughType {
		return true
	}

	switch value.Kind {
	case "Variable":
		// undefined variables are reported by ValidateUndefinedVariables
		if !value.VariableDefined {
			return true
		}
		if value.VariableType != value.ExpectedType {
			return false
		}
		return schema.VariableTypeCompatible(
			schema.ParseTypeRef(value.VariableModifiers),
			schema.ParseTypeRef(value.ExpectedModifiers),
			value.VariableHasNonNullDefault,
		)

	case "Null":
		return !strings.HasSuffix(value.ExpectedModifiers, "!")

	case "List":
		return schema.ParseTypeRef(value.ExpectedModifiers).IsList

	case "Object":
		// single-value coercion lets an object literal fill a list location of
		// any depth, so only the base type matters
		return value.ExpectedTypeKind == "INPUT"

	case "Enum":
		return value.ExpectedTypeKind == "ENUM" && value.EnumValueOK

	default:
		// scalar literals: Int, Float, String, Block, Boolean
		switch value.ExpectedTypeKind {
		case "SCALAR":
			if assignable, known := schema.LiteralKindAssignable(value.ExpectedType, value.Kind); known {
				return assignable
			}
			// custom scalars accept whatever their config allows
			return value.ScalarInputOK
		case "ENUM", "INPUT":
			return false
		default:
			// output types used as inputs are reported by
			// ValidateOutputTypeAsInput; unknown types by other rules
			return true
		}
	}
}
