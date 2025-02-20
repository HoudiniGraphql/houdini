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
	// If the type is non-null, the value must be non-nil.
	if t.NonNull {
		if val == nil {
			return false, nil
		}
		// Remove the non-null requirement for nested validation.
		tCopy := *t
		tCopy.NonNull = false
		return validateValue(&tCopy, val)
	}

	// For nullable types, a nil value (GraphQL null) is valid.
	if val == nil {
		return true, nil
	}

	// Handle list types.
	if t.Elem != nil {
		// The value must be a list.
		if val.Kind != ast.ListValue {
			return false, nil
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

	// For named types, determine the expected AST value kind.
	expectedKind, err := expectedKindForNamedType(t.NamedType)
	if err != nil {
		return false, err
	}
	return val.Kind == expectedKind, nil
}

// expectedKindForNamedType maps a GraphQL named type (e.g. "Int", "String", "Boolean")
// to its expected AST value kind.
func expectedKindForNamedType(name string) (ast.ValueKind, error) {
	switch name {
	case "Int":
		return ast.IntValue, nil
	case "String":
		return ast.StringValue, nil
	case "Boolean":
		return ast.BooleanValue, nil
	default:
		return ast.StringValue, fmt.Errorf("unknown named type: %s", name)
	}
}
