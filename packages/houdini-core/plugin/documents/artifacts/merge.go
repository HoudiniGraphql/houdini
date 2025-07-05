package artifacts

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"sort"

	"code.houdinigraphql.com/packages/houdini-core/plugin/schema"
	"code.houdinigraphql.com/plugins"
)

func FlattenSelection(
	ctx context.Context,
	collectedDocuments *CollectedDocuments,
	name string,
	defaultMask bool,
	sortKeys bool,
) ([]*CollectedSelection, error) {
	// lookup original document
	doc, ok := collectedDocuments.Selections[name]
	if !ok {
		return nil, fmt.Errorf("document not found: %s", name)
	}

	// build on fresh clones of the root selections
	fields := newFieldCollection(
		doc.Name,
		collectedDocuments,
		defaultMask,
		doc.TypeCondition,
		sortKeys,
	)
	for _, orig := range doc.Selections {
		clone := orig.Clone(true)
		fields.Add(clone, false, doc.Selections)
	}
	return fields.ToSelectionSet(), nil
}

func newFieldCollection(
	name string,
	docs *CollectedDocuments,
	defaultMask bool,
	parentType string,
	sortKeys bool,
) *fieldCollection {
	return &fieldCollection{
		DocumentName:       name,
		SortKeys:           sortKeys,
		ParentType:         parentType,
		CollectedDocuments: docs,
		DefaultMask:        defaultMask,
		Fields:             map[string]*fieldCollectionField{},
		InlineFragments:    map[string]*fieldCollectionField{},
		FragmentSpreads:    map[string]*fieldCollectionField{},
	}
}

type fieldCollectionField struct {
	Visible    bool
	Field      *CollectedSelection
	Selection  *fieldCollection
	Directives []*CollectedDirective
}

type fieldCollection struct {
	DocumentName       string
	SortKeys           bool
	ParentType         string
	CollectedDocuments *CollectedDocuments
	DefaultMask        bool

	Fields          map[string]*fieldCollectionField
	InlineFragments map[string]*fieldCollectionField
	FragmentSpreads map[string]*fieldCollectionField
}

func (c *fieldCollection) Size() int {
	return len(c.Fields) + len(c.InlineFragments) + len(c.FragmentSpreads)
}

func (c *fieldCollection) Add(
	selection *CollectedSelection,
	external bool,
	visibilityMask []*CollectedSelection,
) error {
	// we need to figur eout if we want to include the selection in the final result
	hidden := external

	// look to see if masking was explicitly enabled
	for _, directive := range selection.Directives {
		if directive.Name == schema.EnableMaskDirective {
			hidden = true
			break
		}
		if directive.Name == schema.DisableMaskDirective {
			hidden = false
			break
		}
	}

	// process the selection
	switch selection.Kind {
	case "field":
		// lets see if the field shows up in the visibilityMask
		for _, field := range visibilityMask {
			if field.Alias != nil && *field.Alias == selection.FieldName {
				// if the field is in the visibility mask then we should not hide it
				hidden = false
				break
			}
		}

		// if we've seen the field before then we need to make sure some metadata
		// overlaps correctly
		if sel, ok := c.Fields[selection.FieldName]; ok {
			if !sel.Visible && !hidden {
				sel.Visible = true
			}

			// only append directives we haven't seen yet
			for _, dir := range selection.Directives {
				if !containsDirective(sel.Field.Directives, dir) {
					sel.Directives = append(sel.Field.Directives, dir)
				}
			}
		} else {
			// if we haven't seen the field before we need to add a place for the selection
			c.Fields[*selection.Alias] = &fieldCollectionField{
				Field:      selection,
				Directives: slices.Clone(selection.Directives),
				Selection: newFieldCollection(
					c.DocumentName,
					c.CollectedDocuments,
					c.DefaultMask,
					selection.FieldType,
					c.SortKeys,
				),
				Visible: !hidden,
			}
		}

		for _, subSel := range selection.Children {
			mask := visibilityMask
			if visibilityMask != nil {
				for _, field := range visibilityMask {
					if field.Alias != nil && *field.Alias == subSel.FieldName {
						mask = field.Children
						hidden = false
					}
				}
			}

			err := c.Fields[*selection.Alias].Selection.Add(subSel, hidden, mask)
			if err != nil {
				return nil
			}
		}

		// we also want to make sure that the field is present in any inline fragments we've seen
		for _, frag := range c.InlineFragments {
			frag.Selection.Add(c.Fields[*selection.Alias].Field, hidden, visibilityMask)
		}

		// we're done
		return nil

	case "inline_fragment":
		// if the inline fragment doesn't have a type condition then just add every field
		if selection.FieldName == "" || selection.FieldName == c.ParentType {
			for _, sel := range selection.Children {
				c.Add(sel, hidden, visibilityMask)
			}
			return nil
		}

		// if the inline fragment has a type condition then it changes the parent type
		return c.WalkInlineFragment(selection, hidden, visibilityMask)

	case "fragment":
		// add the fragment spread
		c.FragmentSpreads[selection.FieldName] = &fieldCollectionField{
			Field:   selection,
			Visible: !hidden,
		}

		// and most include the fragment's sub selection
		definition, ok := c.CollectedDocuments.Selections[selection.FieldName]
		if !ok {
			return plugins.WrapError(errors.New("fragment not found"))
		}

		_, abstractParent := c.CollectedDocuments.PossibleTypes[c.ParentType]
		// if the selections parent type is the same as the fragment type condition then
		// we should just add every field directly
		if definition.TypeCondition == c.ParentType || !abstractParent {
			for _, sel := range definition.Selections {
				err := c.Add(sel, true, visibilityMask)
				if err != nil {
					return err
				}
			}

			// we're done
			return nil
		}

		// the fragment spread represents a new parent type so treat it like a hidden inline fragment
		inlineFragment := &CollectedSelection{
			Kind:      "inline_fragment",
			FieldName: definition.TypeCondition,
			FieldType: definition.TypeCondition,
			Children:  definition.Selections,
			Visible:   !hidden,
		}

		return c.Add(inlineFragment, true, visibilityMask)
	}

	// its a field we don't recognize, we're done
	return nil
}

func (c *fieldCollection) WalkInlineFragment(
	selection *CollectedSelection,
	hidden bool,
	visibilityMask []*CollectedSelection,
) error {
	// if we haven't seen the inline fragment yet then add it
	if _, ok := c.InlineFragments[selection.FieldName]; !ok {
		c.InlineFragments[selection.FieldName] = &fieldCollectionField{
			Field: selection,
			Selection: newFieldCollection(
				c.DocumentName,
				c.CollectedDocuments,
				hidden,
				selection.FieldName,
				c.SortKeys,
			),
		}
	}

	// add every child to the inline fragment
	for _, child := range selection.Children {
		switch child.Kind {
		case "field":
			var mask []*CollectedSelection
			if visibilityMask != nil {
				for _, field := range visibilityMask {
					if field.Alias != nil && *field.Alias == child.FieldName {
						mask = field.Children
					}
				}
			}
			c.InlineFragments[selection.FieldName].Selection.Add(child, hidden, mask)
		case "fragment":
			err := c.InlineFragments[selection.FieldName].Selection.Add(child, true, visibilityMask)
			if err != nil {
				return err
			}

			c.FragmentSpreads[selection.FieldName] = &fieldCollectionField{
				Field: child,
			}

		case "inline_fragment":
			c.WalkInlineFragment(child, hidden, visibilityMask)
		}
	}

	// we want to apply the selection set to every type that could
	// implement the abstract type condition of the inline fragment

	// this means that we need to consider cases where the field name is a concrete type
	if abstractTypes, ok := c.CollectedDocuments.Implementations[selection.FieldName]; ok {
		// if we've seen the abstract type already then we need to add each of the abstract types
		// selectiosn to the inline fragment for the concrete type
		for abstractType := range abstractTypes {
			if frag, ok := c.InlineFragments[abstractType]; ok {
				// add every child field to the concrete inline fragment
				for _, child := range frag.Field.Children {
					var mask []*CollectedSelection
					for _, field := range visibilityMask {
						if field.Alias != nil && *field.Alias == child.FieldName {
							mask = field.Children
						}
					}
					switch child.Kind {
					case "field":
						c.InlineFragments[selection.FieldName].Selection.Add(
							child,
							hidden,
							mask,
						)
					}
				}
			}
		}
	}

	// overlapping abstract types could necessitate concrete inline fragments but we dont want to
	// process fields that we've already added to a concrete <-> abstract overlap so let's track
	// which concrete types we've added because we ran into an abstract type

	// or the field type could itself be an abstract type with concrete types we've already seen
	if concreteTypes, ok := c.CollectedDocuments.PossibleTypes[selection.FieldName]; ok {
		for concreteType := range concreteTypes {
			// we need to look for any inline fragments that have already been applied that point to abstract selections
			// that the concrete type implements and if we find anything the we need to add a concrete selection even if
			// one is not already present
			if abstractTypes, ok := c.CollectedDocuments.Implementations[concreteType]; ok {
				// if we have an inline fragment for the abstract type implemented by the concrete type we need to merge
				// them into one
				for abstractType := range abstractTypes {
					if abstractType == selection.FieldName {
						continue
					}
					if frag, ok := c.InlineFragments[abstractType]; ok {
						// we need a new inline fragment for the concrete type if its doesn't already exist
						_, ok := c.InlineFragments[concreteType]
						if !ok {
							c.InlineFragments[concreteType] = &fieldCollectionField{
								Field: &CollectedSelection{
									Kind:      "inline_fragment",
									FieldName: concreteType,
									Children:  frag.Field.Children,
								},
								Selection: newFieldCollection(
									c.DocumentName,
									c.CollectedDocuments,
									hidden,
									concreteType,
									c.SortKeys,
								),
							}

							// just add one field, we'll do the rest when we copy over the abstract selection into the concrete one
							c.InlineFragments[concreteType].Selection.Add(
								frag.Field.Children[0],
								!frag.Field.Children[0].Visible,
								visibilityMask,
							)
						}
					}
				}
			}

			// if we've seen the concrete type before then we need to add this selection set to
			// the selection for the inline fragment for the concrete type
			if _, ok := c.InlineFragments[concreteType]; ok {
				// add every child field to the concrete inline fragment
				for _, child := range selection.Children {
					var mask []*CollectedSelection
					for _, field := range visibilityMask {
						if field.Alias != nil && *field.Alias == child.FieldName {
							mask = field.Children
						}
					}
					switch child.Kind {
					case "field":
						c.InlineFragments[concreteType].Selection.Add(
							child,
							hidden,
							mask,
						)
					}
				}
			}
		}
	}

	// also if there is a concrete selection already present we want to include that in the inline framgment
	for _, field := range c.Fields {
		var mask []*CollectedSelection
		if visibilityMask != nil {
			for _, field := range visibilityMask {
				if field.Alias != nil && *field.Alias == field.FieldName {
					mask = field.Children
				}
			}
		}
		c.InlineFragments[selection.FieldName].Selection.Add(
			field.Field,
			hidden,
			mask,
		)
	}

	return nil
}

func (c *fieldCollection) ToSelectionSet() []*CollectedSelection {
	result := []*CollectedSelection{}

	// if we aren't supposed to sort the keys just add everything
	if !c.SortKeys {
		for _, f := range c.Fields {
			local := *f.Field.Clone(false)
			field := &local
			field.Directives = f.Directives
			if f.Selection != nil {
				field.Children = f.Selection.ToSelectionSet()
			}
			if f.Visible {
				field.Visible = true
			}
			result = append(result, field)
		}

		for _, f := range c.InlineFragments {
			field := f.Field.Clone(false)
			field.Children = f.Selection.ToSelectionSet()
			result = append(result, field)
		}

		for _, f := range c.FragmentSpreads {
			field := f.Field
			if f.Visible {
				field.Visible = true
			}
			result = append(result, field)
		}
	} else {
		// we're supposed to sort the keys by (fields, inline fragments, fragments) and then by name
		fieldNames := []string{}
		for name := range c.Fields {
			fieldNames = append(fieldNames, name)
		}
		sort.Strings(fieldNames)
		for _, name := range fieldNames {
			field := c.Fields[name]
			selectionField := field.Field.Clone(false)
			selectionField.Directives = field.Directives
			if field.Selection != nil {
				selectionField.Children = field.Selection.ToSelectionSet()
			}
			if field.Visible {
				selectionField.Visible = true
			}
			result = append(result, selectionField)
		}

		// then inline fragments
		typeConditions := []string{}
		for name := range c.InlineFragments {
			typeConditions = append(typeConditions, name)
		}
		sort.Strings(typeConditions)
		for _, name := range typeConditions {
			field := c.InlineFragments[name].Field.Clone(false)
			field.Children = c.InlineFragments[name].Selection.ToSelectionSet()
			result = append(result, field)
		}

		// and finally fragments
		fragmentNames := []string{}
		for name := range c.FragmentSpreads {
			fragmentNames = append(fragmentNames, name)
		}
		sort.Strings(fragmentNames)
		for _, name := range fragmentNames {
			f := c.FragmentSpreads[name].Field.Clone(false)
			result = append(result, f)
			if c.FragmentSpreads[name].Visible {
				f.Visible = true
			}
		}
	}

	return result
}

// helper to decide if two directives are “equal”
// (you can expand this to also compare argument values, etc.)
func sameDirective(a, b *CollectedDirective) bool {
	if a.Name != b.Name {
		return false
	}
	if len(a.Arguments) != len(b.Arguments) {
		return false
	}
	for i := range a.Arguments {
		ai, bi := a.Arguments[i], b.Arguments[i]
		if ai.Name != bi.Name || ai.Value != bi.Value {
			return false
		}
	}
	return true
}

// returns true if dir is already in the slice
func containsDirective(list []*CollectedDirective, dir *CollectedDirective) bool {
	for _, existing := range list {
		if sameDirective(existing, dir) {
			return true
		}
	}
	return false
}
