package schema

import (
	"fmt"
	"unicode"

	"github.com/vektah/gqlparser/v2/ast"
)

// ValueMatchesType checks if the given AST value (val) conforms to the GraphQL type described by typeStr.
func ValueMatchesType(typeStr string, val *ast.Value) (bool, error) {
	gqlType, err := parseGraphQLType(typeStr)
	if err != nil {
		return false, err
	}
	return validateValue(gqlType, val)
}

// parseGraphQLType parses a GraphQL type string like "[String!]!" into an *ast.Type.
func parseGraphQLType(s string) (*ast.Type, error) {
	p := &typeParser{s: s}
	typ, err := p.parseType()
	if err != nil {
		return nil, err
	}
	p.skipWhitespace()
	if p.pos != len(p.s) {
		return nil, fmt.Errorf("unexpected trailing characters: %q", s[p.pos:])
	}
	return typ, nil
}

// typeParser is a simple recursive descent parser for GraphQL type strings.
type typeParser struct {
	s   string
	pos int
}

func (p *typeParser) skipWhitespace() {
	for p.pos < len(p.s) && unicode.IsSpace(rune(p.s[p.pos])) {
		p.pos++
	}
}

func (p *typeParser) peek() byte {
	if p.pos < len(p.s) {
		return p.s[p.pos]
	}
	return 0
}

func (p *typeParser) consume(expected byte) error {
	if p.pos < len(p.s) && p.s[p.pos] == expected {
		p.pos++
		return nil
	}
	return fmt.Errorf("expected %q at position %d", expected, p.pos)
}

func (p *typeParser) parseName() (string, error) {
	p.skipWhitespace()
	start := p.pos
	for p.pos < len(p.s) {
		ch := p.s[p.pos]
		if unicode.IsLetter(rune(ch)) || unicode.IsDigit(rune(ch)) || ch == '_' {
			p.pos++
		} else {
			break
		}
	}
	if start == p.pos {
		return "", fmt.Errorf("expected name at position %d", p.pos)
	}
	return p.s[start:p.pos], nil
}

// parseType parses a type according to the grammar:
//
//	Type : NamedType | ListType
//	NamedType : Name '!'?
//	ListType : '[' Type ']' '!'?
func (p *typeParser) parseType() (*ast.Type, error) {
	p.skipWhitespace()
	var t *ast.Type
	if p.peek() == '[' {
		// Parse a list type.
		if err := p.consume('['); err != nil {
			return nil, err
		}
		inner, err := p.parseType()
		if err != nil {
			return nil, err
		}
		p.skipWhitespace()
		if err := p.consume(']'); err != nil {
			return nil, fmt.Errorf("expected ']' at position %d", p.pos)
		}
		t = &ast.Type{
			Elem: inner,
		}
	} else {
		// Parse a named type.
		name, err := p.parseName()
		if err != nil {
			return nil, err
		}
		t = &ast.Type{
			NamedType: name,
		}
	}
	p.skipWhitespace()
	// Check for non-null marker.
	if p.peek() == '!' {
		if err := p.consume('!'); err != nil {
			return nil, err
		}
		t.NonNull = true
	}
	return t, nil
}

// validateValue recursively validates an AST value against a parsed GraphQL type.
// It handles non-null, list, and named types.
func validateValue(t *ast.Type, val *ast.Value) (bool, error) {
	isNull := val == nil || val.Kind == ast.NullValue

	// If the type is non-null, the value must be non-null.
	if t.NonNull {
		if isNull {
			return false, nil
		}
		// Remove the non-null requirement for nested validation.
		tCopy := *t
		tCopy.NonNull = false
		return validateValue(&tCopy, val)
	}

	// For nullable types, a null value is valid.
	if isNull {
		return true, nil
	}

	// Handle list types.
	if t.Elem != nil {
		// a single value is coerced to a one-element list
		if val.Kind != ast.ListValue {
			return validateValue(t.Elem, val)
		}
		// Recursively validate each element of the list.
		for _, child := range val.Children {
			valid, err := validateValue(t.Elem, child.Value)
			if err != nil {
				return false, err
			}
			if !valid {
				return false, nil
			}
		}
		return true, nil
	}

	return valueKindMatches(t.NamedType, val.Kind), nil
}

// valueKindMatches reports whether a literal of the given AST kind can coerce
// to the named type, following the spec's input coercion rules
func valueKindMatches(name string, kind ast.ValueKind) bool {
	switch name {
	case "Int":
		return kind == ast.IntValue
	case "Float":
		// the spec coerces integer literals to Float
		return kind == ast.IntValue || kind == ast.FloatValue
	case "String":
		return kind == ast.StringValue || kind == ast.BlockValue
	case "Boolean":
		return kind == ast.BooleanValue
	case "ID":
		// the spec coerces both strings and integers to ID
		return kind == ast.StringValue || kind == ast.IntValue
	default:
		// enums, custom scalars, and input objects can't be checked from the
		// type name alone so trust the value
		return true
	}
}
