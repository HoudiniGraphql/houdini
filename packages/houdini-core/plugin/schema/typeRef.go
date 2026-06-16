package schema

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
// TypeRef decodes that encoding into one node per level, outermost first, so
// assignability rules can walk the type the way the spec describes them.
type TypeRef struct {
	NonNull bool
	IsList  bool
	Inner   *TypeRef // nil for the base type
}

func ParseTypeRef(modifiers string) *TypeRef {
	ref := &TypeRef{}
	i := 0
	if i < len(modifiers) && modifiers[i] == '!' {
		ref.NonNull = true
		i++
	}
	for ; i < len(modifiers); i++ {
		if modifiers[i] != ']' {
			continue
		}
		wrapper := &TypeRef{IsList: true, Inner: ref}
		if i+1 < len(modifiers) && modifiers[i+1] == '!' {
			wrapper.NonNull = true
			i++
		}
		ref = wrapper
	}
	return ref
}

// TypeCompatible reports whether a value of the variable's shape can flow into
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
func TypeCompatible(variable, location *TypeRef) bool {
	for {
		if location.NonNull && !variable.NonNull {
			return false
		}
		if location.IsList != variable.IsList {
			return false
		}
		if !location.IsList {
			return true
		}
		variable, location = variable.Inner, location.Inner
	}
}

// VariableTypeCompatible implements the spec's IsVariableUsageAllowed: a nullable
// variable can fill a non-null location if the variable declares a non-null
// default value, but only at the outermost level.
func VariableTypeCompatible(variable, location *TypeRef, hasNonNullDefault bool) bool {
	if location.NonNull && !variable.NonNull {
		if !hasNonNullDefault {
			return false
		}
		unwrapped := *location
		unwrapped.NonNull = false
		location = &unwrapped
	}
	return TypeCompatible(variable, location)
}

// LiteralKindAssignable reports whether a literal of the given kind (the kinds
// recorded in argument_values: Int, Float, String, Block, Boolean, ...) can
// coerce to the named type, following the spec's input coercion rules. known is
// false when the type isn't a built-in scalar and the answer requires schema
// information (enums, custom scalars, input objects).
func LiteralKindAssignable(typeName, literalKind string) (assignable bool, known bool) {
	if literalKind == "Block" {
		literalKind = "String"
	}
	switch typeName {
	case "Int":
		return literalKind == "Int", true
	case "Float":
		// the spec coerces integer literals to Float
		return literalKind == "Int" || literalKind == "Float", true
	case "String":
		return literalKind == "String", true
	case "Boolean":
		return literalKind == "Boolean", true
	case "ID":
		// the spec coerces both strings and integers to ID
		return literalKind == "String" || literalKind == "Int", true
	default:
		return false, false
	}
}
