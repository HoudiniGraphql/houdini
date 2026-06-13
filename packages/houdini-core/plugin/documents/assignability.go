package documents

import (
	"strings"

	"code.houdinigraphql.com/packages/houdini-core/plugin/schema"
)

// Type modifiers are stored as strings read inner→outer: a leading '!' marks the
// base type non-null, and every ']' opens a list level whose own non-null flag is
// the '!' immediately following it. For example:
//
//	type     | modifiers
//	---------+----------
//	ID       | ``
//	ID!      | `!`
//	[ID]     | `]`
//	[ID]!    | `]!`
//	[ID!]    | `!]`
//	[ID!]!   | `!]!`
//	[[ID]!]  | `]!]`
//
// typeRef decodes that encoding into one node per level, outermost first, so the
// assignability rules below can walk the type the way the spec describes them.
type typeRef struct {
	nonNull bool
	isList  bool
	inner   *typeRef // nil for the base type
}

func parseTypeRef(modifiers string) *typeRef {
	ref := &typeRef{}
	i := 0
	if i < len(modifiers) && modifiers[i] == '!' {
		ref.nonNull = true
		i++
	}
	for ; i < len(modifiers); i++ {
		if modifiers[i] != ']' {
			continue
		}
		wrapper := &typeRef{isList: true, inner: ref}
		if i+1 < len(modifiers) && modifiers[i+1] == '!' {
			wrapper.nonNull = true
			i++
		}
		ref = wrapper
	}
	return ref
}

// typeCompatible reports whether a value of the variable's shape can flow into
// the location's shape, assuming the base types already match. It implements the
// spec's AreTypesCompatible: at every level a non-null variable satisfies a
// nullable location but not the other way around, and list depths must line up.
//
//	variable | location | compatible
//	---------+----------+-----------
//	         |          | true
//	!        |          | true
//	!        | !        | true
//	         | !        | false
//	]        | ]        | true
//	]!       | ]        | true
//	!]       | ]        | true
//	!]!      | ]        | true
//	]        | ]!       | false
//	]!       | ]!       | true
//	!]       | ]!       | false
//	!]!      | ]!       | true
//	]        | !]       | false
//	]!       | !]       | false
//	!]       | !]       | true
//	!]!      | !]       | true
//	]        | !]!      | false
//	]!       | !]!      | false
//	!]       | !]!      | false
//	!]!      | !]!      | true
func typeCompatible(variable, location *typeRef) bool {
	for {
		if location.nonNull && !variable.nonNull {
			return false
		}
		if location.isList != variable.isList {
			return false
		}
		if !location.isList {
			return true
		}
		variable, location = variable.inner, location.inner
	}
}

// variableTypeCompatible implements the spec's IsVariableUsageAllowed: a nullable
// variable can fill a non-null location if the variable declares a non-null
// default value, but only at the outermost level.
func variableTypeCompatible(variable, location *typeRef, hasNonNullDefault bool) bool {
	if location.nonNull && !variable.nonNull {
		if !hasNonNullDefault {
			return false
		}
		unwrapped := *location
		unwrapped.nonNull = false
		location = &unwrapped
	}
	return typeCompatible(variable, location)
}

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

	switch value.Kind {
	case "Variable":
		// undefined variables are reported by ValidateUndefinedVariables
		if !value.VariableDefined {
			return true
		}
		if value.VariableType != value.ExpectedType {
			return false
		}
		return variableTypeCompatible(
			parseTypeRef(value.VariableModifiers),
			parseTypeRef(value.ExpectedModifiers),
			value.VariableHasNonNullDefault,
		)

	case "Null":
		return !strings.HasSuffix(value.ExpectedModifiers, "!")

	case "List":
		return parseTypeRef(value.ExpectedModifiers).isList

	case "Object":
		// single-value coercion lets an object literal fill a list location of
		// any depth, so only the base type matters
		return value.ExpectedTypeKind == "INPUT" ||
			value.ExpectedType == schema.ArgumentSpecificationType

	case "Enum":
		return value.ExpectedTypeKind == "ENUM" && value.EnumValueOK

	default:
		// scalar literals: Int, Float, String, Block, Boolean
		literal := value.Kind
		if literal == "Block" {
			literal = "String"
		}

		switch value.ExpectedTypeKind {
		case "SCALAR":
			switch value.ExpectedType {
			case "Int":
				return literal == "Int"
			case "Float":
				// the spec coerces integer literals to Float
				return literal == "Int" || literal == "Float"
			case "String":
				return literal == "String"
			case "Boolean":
				return literal == "Boolean"
			case "ID":
				// the spec coerces both strings and integers to ID
				return literal == "String" || literal == "Int"
			default:
				// custom scalars accept whatever their config allows
				return value.ScalarInputOK
			}
		case "ENUM", "INPUT":
			return false
		default:
			// output types used as inputs are reported by
			// ValidateOutputTypeAsInput; unknown types by other rules
			return true
		}
	}
}
