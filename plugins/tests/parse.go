package tests

import (
	"fmt"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

func transformValue(val *ast.Value) *ExpectedArgumentValue {
	if val == nil {
		return nil
	}
	var kind string
	switch val.Kind {
	case ast.Variable:
		kind = "Variable"
	case ast.IntValue:
		kind = "Int"
	case ast.FloatValue:
		kind = "Float"
	case ast.StringValue:
		kind = "String"
	case ast.BooleanValue:
		kind = "Boolean"
	case ast.EnumValue:
		kind = "Enum"
	case ast.ListValue:
		kind = "List"
	case ast.ObjectValue:
		kind = "Object"
	case ast.NullValue:
		kind = "Null"
	}

	ev := &ExpectedArgumentValue{
		Kind: kind,
		Raw:  val.Raw,
	}
	// If the value is an object, process its children.
	if val.Kind == ast.ObjectValue && val.Children != nil {
		for _, child := range val.Children {
			ev.Children = append(ev.Children, ExpectedArgumentValueChildren{
				Name:  child.Name,
				Value: transformValue(child.Value),
			})
		}
	}
	return ev
}

// transformDirective converts an ast.Directive to an ExpectedDirective.
func transformDirective(d *ast.Directive) ExpectedDirective {
	ed := ExpectedDirective{
		Name: d.Name,
	}
	for _, arg := range d.Arguments {
		ed.Arguments = append(ed.Arguments, ExpectedDirectiveArgument{
			Name:  arg.Name,
			Value: transformValue(arg.Value),
		})
	}
	return ed
}

// getTypeModifiers returns a string representation of the type modifiers.
func getTypeModifiers(t *ast.Type) string {
	modifiers := ""
	if t.NonNull {
		modifiers += "!"
	}
	if t.Elem != nil {
		// Prepend list notation for the element type.
		modifiers = "[]" + getTypeModifiers(t.Elem)
	}
	return modifiers
}

// transformVariable converts an ast.VariableDefinition into an ExpectedOperationVariable.
func transformVariable(v *ast.VariableDefinition) ExpectedOperationVariable {
	var defaultValue *ExpectedArgumentValue
	if v.DefaultValue != nil {
		defaultValue = transformValue(v.DefaultValue)
	}
	edv := ExpectedOperationVariable{
		Document:      0, // placeholder; adjust if you need to track a document id
		Name:          v.Variable,
		Type:          v.Type.NamedType,
		TypeModifiers: getTypeModifiers(v.Type),
		DefaultValue:  defaultValue,
	}
	for _, d := range v.Directives {
		edv.Directives = append(edv.Directives, transformDirective(d))
	}
	return edv
}

// transformSelection converts an ast.Selection into an ExpectedSelection.
// The pathIndex is incremented for each selection as an example.
func transformSelection(selection ast.Selection, pathIndex *int) ExpectedSelection {
	*pathIndex++
	switch sel := selection.(type) {
	case *ast.Field:
		es := ExpectedSelection{
			FieldName: sel.Name,
			Kind:      "field",
			PathIndex: *pathIndex,
		}
		if sel.Alias != "" {
			es.Alias = &sel.Alias
		}
		for _, arg := range sel.Arguments {
			es.Arguments = append(es.Arguments, ExpectedArgument{
				Name:  arg.Name,
				Value: transformValue(arg.Value),
			})
		}
		for _, d := range sel.Directives {
			es.Directives = append(es.Directives, transformDirective(d))
		}
		for _, child := range sel.SelectionSet {
			es.Children = append(es.Children, transformSelection(child, pathIndex))
		}
		return es
	case *ast.FragmentSpread:
		// For a fragment spread, use the fragment's name.
		return ExpectedSelection{
			FieldName: sel.Name,
			Kind:      "fragment",
			PathIndex: *pathIndex,
		}
	case *ast.InlineFragment:
		es := ExpectedSelection{
			Kind:      "inline_fragment",
			PathIndex: *pathIndex,
		}
		// Inline fragments might have a type condition.
		// You could extend ExpectedSelection to include that if needed.
		for _, d := range sel.Directives {
			es.Directives = append(es.Directives, transformDirective(d))
		}
		for _, child := range sel.SelectionSet {
			es.Children = append(es.Children, transformSelection(child, pathIndex))
		}
		return es
	default:
		return ExpectedSelection{}
	}
}

// ExpectedDoc parses a GraphQL query string and returns a slice of ExpectedDocument.
func ExpectedDoc(query string) ExpectedDocument {
	source := &ast.Source{
		Input: query,
	}
	doc, err := parser.ParseQuery(source)
	if err != nil {
		fmt.Println(err)
		return ExpectedDocument{}
	}

	// Process operations.
	for _, op := range doc.Operations {
		edoc := ExpectedDocument{
			Name:        op.Name,
			RawDocument: 0, // placeholder
			Kind:        string(op.Operation),
		}
		for _, v := range op.VariableDefinitions {
			edoc.Variables = append(edoc.Variables, transformVariable(v))
		}
		for _, d := range op.Directives {
			edoc.Directives = append(edoc.Directives, transformDirective(d))
		}
		pathIndex := 0
		for _, sel := range op.SelectionSet {
			edoc.Selections = append(edoc.Selections, transformSelection(sel, &pathIndex))
		}

		return edoc
	}
	// Process fragment definitions.
	for _, frag := range doc.Fragments {
		var typeCond *string
		if frag.TypeCondition != "" {
			typeCond = &frag.TypeCondition
		}
		edoc := ExpectedDocument{
			Name:          frag.Name,
			RawDocument:   0,
			Kind:          "fragment",
			TypeCondition: typeCond,
		}
		for _, d := range frag.Directives {
			edoc.Directives = append(edoc.Directives, transformDirective(d))
		}
		pathIndex := 0
		for _, sel := range frag.SelectionSet {
			edoc.Selections = append(edoc.Selections, transformSelection(sel, &pathIndex))
		}
		return edoc
	}
	return ExpectedDocument{}
}
