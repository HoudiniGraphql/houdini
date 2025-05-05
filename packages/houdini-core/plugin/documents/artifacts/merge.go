package artifacts

import (
	"context"
	"errors"
	"fmt"
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
	// we need to flatten the selection of the document with the matching name
	doc, ok := collectedDocuments.Selections[name]
	if !ok {
		return nil, fmt.Errorf("document not found: %s", name)
	}

	// create a place to collect field
	fields := newFieldCollection(collectedDocuments, defaultMask, doc.TypeCondition, sortKeys)

	for _, selection := range doc.Selections {
		// add the selection to the field collection
		fields.Add(selection, false)
	}

	// transform the result into the flattened selection set
	return fields.ToSelectionSet(), nil
}

func newFieldCollection(
	docs *CollectedDocuments,
	defaultMask bool,
	parentType string,
	sortKeys bool,
) *fieldCollection {
	return &fieldCollection{
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
	Hidden    bool
	Field     *CollectedSelection
	Selection *fieldCollection
}

type fieldCollection struct {
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

func (c *fieldCollection) Add(selection *CollectedSelection, external bool) error {
	// we need to figur eout if we want to include the selection in the final result
	hidden := external || selection.Kind == "fragment"

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

	// track the hidden state of the field
	selection.Hidden = hidden

	// process the selection
	switch selection.Kind {
	case "field":
		// if we haven't seen the field before we need to add a place for the selection
		if sel, ok := c.Fields[selection.FieldName]; ok {
			sel.Hidden = hidden && sel.Hidden
			sel.Field.Hidden = sel.Hidden
			hidden = sel.Hidden
		} else {
			c.Fields[*selection.Alias] = &fieldCollectionField{
				Field: selection.Clone(),
				Selection: newFieldCollection(
					c.CollectedDocuments,
					c.DefaultMask,
					selection.FieldType,
					c.SortKeys,
				),
				Hidden: hidden,
			}
		}

		for _, subSel := range selection.Children {
			err := c.Fields[*selection.Alias].Selection.Add(subSel, hidden)
			if err != nil {
				return nil
			}
		}

		// we also want to make sure that the field is present in any inline fragments we've seen
		for _, frag := range c.InlineFragments {
			frag.Selection.Add(c.Fields[*selection.Alias].Field, hidden)
		}

		// we're done
		return nil

	case "inline_fragment":
		// if the inline fragment doesn't have a type condition then just add every field
		if selection.FieldName == "" {
			for _, sel := range selection.Children {
				c.Add(sel, hidden)
			}
			return nil
		}

		// if the inline fragment has a type condition then it changes the parent type
		return c.WalkInlineFragment(selection, hidden)

	case "fragment":
		// add the fragment spread
		c.FragmentSpreads[selection.FieldName] = &fieldCollectionField{
			Field: selection,
		}

		// and most include the fragment's sub selection
		definition, ok := c.CollectedDocuments.Selections[selection.FieldName]
		if !ok {
			return plugins.WrapError(errors.New("fragment not found"))
		}

		// if the selections parent type is the same as the fragment type condition then
		// we should just add every field directly
		if definition.TypeCondition == c.ParentType {
			for _, sel := range definition.Selections {
				err := c.Add(sel, hidden)
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
		}

		return c.Add(inlineFragment, true)
	}

	// its a field we don't recognize, we're done
	return nil
}

func (c *fieldCollection) CollectFragmentSpreads(
	selections []*CollectedSelection,
) []*CollectedSelection {
	// perform a breadth-first search for fragment spreads
	result := []*CollectedSelection{}
	leftToProcess := selections

	// walk through what's left to process
	for _, selection := range leftToProcess {
		switch selection.Kind {
		case "field":
			continue
		case "fragment":
			result = append(result, selection)
		case "inline_fragment":
			for _, sel := range selection.Children {
				leftToProcess = append(leftToProcess, sel)
			}
		}
	}

	// we're done walking through the selections
	return result
}

func (c *fieldCollection) WalkInlineFragment(selection *CollectedSelection, hidden bool) error {
	// if we haven't seen the inline fragment yet then add it
	if _, ok := c.InlineFragments[selection.FieldName]; !ok {
		c.InlineFragments[selection.FieldName] = &fieldCollectionField{
			Field: selection,
			Selection: newFieldCollection(
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
			c.InlineFragments[selection.FieldName].Selection.Add(child, hidden)
		case "fragment":
			err := c.Add(child, hidden)
			if err != nil {
				return err
			}

		case "inline_fragment":
			c.WalkInlineFragment(child, hidden)
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
					switch child.Kind {
					case "field":
						c.InlineFragments[selection.FieldName].Selection.Add(child, hidden)
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
									c.CollectedDocuments,
									hidden,
									concreteType,
									c.SortKeys,
								),
							}

							// just add one field, we'll do the rest when we copy over the abstract selection into the concrete one
							c.InlineFragments[concreteType].Selection.Add(
								frag.Field.Children[0],
								hidden,
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
					switch child.Kind {
					case "field":
						c.InlineFragments[concreteType].Selection.Add(child, hidden)
					}
				}
			}
		}
	}

	// also if there is a concrete selection already present we want to include that in the inline framgment
	for _, field := range c.Fields {
		c.InlineFragments[selection.FieldName].Selection.Add(field.Field, hidden)
	}

	return nil
}

func (c *fieldCollection) ToSelectionSet() []*CollectedSelection {
	result := []*CollectedSelection{}

	// if we aren't supposed to sort the keys just add everything
	if !c.SortKeys {
		for _, f := range c.Fields {
			local := *f.Field
			field := &local
			if f.Selection != nil {
				field.Children = f.Selection.ToSelectionSet()
			}
			if f.Hidden {
				field.Hidden = true
			}
			result = append(result, field)
		}

		for _, f := range c.InlineFragments {
			field := f.Field
			field.Children = f.Selection.ToSelectionSet()
			result = append(result, field)
		}

		for _, f := range c.FragmentSpreads {
			field := f.Field
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
			if field.Selection != nil {
				field.Field.Children = field.Selection.ToSelectionSet()
			}
			if field.Hidden {
				field.Field.Hidden = true
			}
			result = append(result, field.Field)
		}

		// then inline fragments
		typeConditions := []string{}
		for name := range c.InlineFragments {
			typeConditions = append(typeConditions, name)
		}
		sort.Strings(typeConditions)
		for _, name := range typeConditions {
			field := c.InlineFragments[name].Field
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
			field := c.FragmentSpreads[name].Field
			result = append(result, field)
		}
	}

	return result
}
