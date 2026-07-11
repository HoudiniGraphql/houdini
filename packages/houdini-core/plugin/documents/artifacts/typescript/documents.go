package typescript

import (
	"context"
	"fmt"
	"slices"
	"sort"
	"strings"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents/collected"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/graphql"
)

// DocumentContext holds document-specific state that was previously stored in global variables
// and embeds context.Context to serve as both context and document state
type DocumentContext struct {
	HasLoading    bool
	SortKeys      bool
	ProjectConfig plugins.ProjectConfig
	EnumTypes     map[string]bool
	InputTypes    map[string]bool
	ScalarImports map[string]bool // full import statement → true
}

// spreadDisablesMasking returns true when a fragment spread's fields should be
// inlined into the surrounding type. @mask_disable and @mask_enable on the spread
// take priority, otherwise we fall back to the project's defaultFragmentMasking
func spreadDisablesMasking(projectConfig plugins.ProjectConfig, spread *collected.Selection) bool {
	for _, directive := range spread.Directives {
		if directive.Name == graphql.DisableMaskDirective {
			return true
		}
		if directive.Name == graphql.EnableMaskDirective {
			return false
		}
	}
	return !projectConfig.DefaultFragmentMasking
}

// spreadIsConditional returns true when the spread carries @include or @skip,
// meaning the fields it inlines might be missing from the response
func spreadIsConditional(spread *collected.Selection) bool {
	for _, directive := range spread.Directives {
		if directive.Name == graphql.IncludeDirective || directive.Name == graphql.SkipDirective {
			return true
		}
	}
	return false
}

// expandMaskedSpreads replaces fragment spreads that disable masking with the
// selections of the fragment definition. the spread node itself is kept so the
// " $fragments" marker is still generated. only spreads whose type condition is
// satisfied by every object of parentType are expanded — anything narrower needs
// a discriminated union to describe accurately so we leave those masked.
//
// the second return value marks the fields that were inlined through a spread
// guarded by @include or @skip — those might be missing from the response so
// they have to be typed as optional
func expandMaskedSpreads(
	ctx *DocumentContext,
	collectedDocs *collected.Documents,
	selections []*collected.Selection,
	parentType string,
) ([]*collected.Selection, map[*collected.Selection]bool) {
	result := make([]*collected.Selection, 0, len(selections))
	optionalFields := map[*collected.Selection]bool{}
	seenFields := map[string]*collected.Selection{}
	fieldIndex := map[string]int{}
	mergedFields := map[string]bool{}
	seenSpreads := map[string]bool{}
	seenFragments := map[string]bool{}

	// satisfied returns true when every object of parentType matches the condition
	satisfied := func(condition string) bool {
		return condition == "" || condition == parentType ||
			collectedDocs.PossibleTypes[condition][parentType]
	}

	var walk func(sels []*collected.Selection, expanded bool, conditional bool)
	walk = func(sels []*collected.Selection, expanded bool, conditional bool) {
		for _, sel := range sels {
			switch sel.Kind {
			case "fragment":
				// keep the spread for the " $fragments" marker, once per fragment
				// (merged duplicate fields can carry the same spread through
				// several paths and the marker object can't repeat a key)
				if !seenSpreads[sel.FieldName] {
					seenSpreads[sel.FieldName] = true
					result = append(result, sel)
				}

				if !spreadDisablesMasking(ctx.ProjectConfig, sel) {
					continue
				}
				// guard against revisiting a fragment (the spec forbids cycles but
				// we don't want a malformed document to hang the generator)
				if seenFragments[sel.FieldName] {
					continue
				}
				seenFragments[sel.FieldName] = true

				definition, ok := collectedDocs.Selections[sel.FieldName]
				if !ok || !satisfied(definition.TypeCondition) {
					continue
				}

				walk(definition.Selections, true, conditional || spreadIsConditional(sel))

			case "inline_fragment":
				// inline fragments pulled out of an expanded definition can't be
				// passed through (the flat object type has no way to express them)
				// so we inline the ones that always match and drop the rest
				if !expanded {
					result = append(result, sel)
				} else if satisfied(sel.FieldName) {
					walk(sel.Children, true, conditional)
				}

			case "field":
				// fields can reach us twice (selected directly and through an
				// unmasked fragment) but the type can only list them once
				name := sel.FieldName
				if sel.Alias != nil {
					name = *sel.Alias
				}
				if kept, ok := seenFields[name]; ok {
					// a duplicate occurrence still contributes its sub-selection:
					// two unmasked fragments can select the same field with
					// different children and the type has to describe the union of
					// both. an explicit occurrence also makes a field the pipeline
					// auto-added (internal, hidden from the type) part of the type.
					// the kept node is shared with the collected documents so it's
					// cloned the first time it changes
					makesVisible := kept.Internal && !sel.Internal
					if len(sel.Children) > 0 || makesVisible {
						if !mergedFields[name] {
							clone := kept.Clone(false)
							clone.Children = slices.Clone(kept.Children)
							if optionalFields[kept] {
								delete(optionalFields, kept)
								optionalFields[clone] = true
							}
							result[fieldIndex[name]] = clone
							seenFields[name] = clone
							mergedFields[name] = true
							kept = clone
						}
						kept.Children = append(kept.Children, sel.Children...)
						if makesVisible {
							kept.Internal = false
						}
					}
					// an occurrence that is always present wins over a conditional one
					if !conditional {
						delete(optionalFields, kept)
					}
					continue
				}
				seenFields[name] = sel
				fieldIndex[name] = len(result)
				if conditional {
					optionalFields[sel] = true
				}

				result = append(result, sel)

			default:
				result = append(result, sel)
			}
		}
	}
	walk(selections, false, false)

	return result, optionalFields
}

func GenerateDocumentTypeDefs(
	projectConfig plugins.ProjectConfig,
	rootTypes *RootTypeNames,
	collectedDefinitions *collected.Documents,
	doc *collected.Document,
	unmaskedSelection []*collected.Selection,
	sortKeys bool,
) (string, []string, error) {
	// Calculate root type name once per document
	rootTypeName := getRootTypeName(doc, rootTypes)

	// Generate TypeScript type definitions for this document
	typeDef, imports, err := generateDocumentTypeDef(
		projectConfig,
		rootTypeName,
		doc,
		collectedDefinitions,
		unmaskedSelection,
		sortKeys,
	)
	if err != nil {
		return "", nil, err
	}

	return typeDef, imports, nil
}

func generateDocumentTypeDef(
	projectConfig plugins.ProjectConfig,
	rootTypeName string,
	doc *collected.Document,
	collectedDocs *collected.Documents,
	unmaskedSelection []*collected.Selection,
	sortKeys bool,
) (string, []string, error) {
	// Create document context to pass state instead of using global variables
	docCtx := DocumentContext{
		ProjectConfig: projectConfig,
		SortKeys:      sortKeys,
		EnumTypes:     make(map[string]bool),
		InputTypes:    make(map[string]bool),
		ScalarImports: make(map[string]bool),
	}
	hasFieldLoading := hasAnyLoadingDirectives(doc.Selections)
	hasGlobalLoading := hasDocumentLevelLoading(doc)
	docCtx.HasLoading = hasFieldLoading || hasGlobalLoading

	var imports []string
	var typeDefinitions []string

	// Generate type definitions first to collect dependencies
	if doc.Kind == "fragment" {
		typeDefinitions = append(typeDefinitions, generateFragmentTypes(
			&docCtx,
			rootTypeName,
			doc,
			collectedDocs,
		)...)

		// For fragments, we'll handle the artifact import specially in the output generation
	} else {
		// Generate operation types
		typeDefinitions = append(typeDefinitions, generateOperationTypes(
			&docCtx,
			rootTypeName,
			doc,
			collectedDocs,
			unmaskedSelection,
		)...)
	}

	// the first thing we have to do is add the imports
	if docCtx.HasLoading {
		imports = append(imports, `import type { LoadingType } from "houdini/runtime";`)
	}
	if len(docCtx.EnumTypes) > 0 {
		var enumTypes []string
		for enumType := range docCtx.EnumTypes {
			enumTypes = append(enumTypes, enumType+"$options")
		}
		imports = append(
			imports,
			fmt.Sprintf(
				`import type { %s } from "$houdini/graphql/enums";`,
				strings.Join(enumTypes, ", "),
			),
		)
	}
	if len(docCtx.InputTypes) > 0 {
		var inputTypes []string
		for inputType := range docCtx.InputTypes {
			inputTypes = append(inputTypes, inputType)
		}
		imports = append(
			imports,
			fmt.Sprintf(
				`import type { %s } from "$houdini/graphql/inputs";`,
				strings.Join(inputTypes, ", "),
			),
		)
	}
	if len(docCtx.ScalarImports) > 0 {
		var scalarImports []string
		for importStmt := range docCtx.ScalarImports {
			scalarImports = append(scalarImports, importStmt)
		}
		sort.Strings(scalarImports)
		imports = append(imports, scalarImports...)
	}

	// Add artifact type
	typeDefinitions = append(
		typeDefinitions,
		fmt.Sprintf("export type %s$artifact = typeof artifact", doc.Name),
	)

	var result strings.Builder

	// For operations, normal order
	for i, typeDef := range typeDefinitions {
		result.WriteString(typeDef)
		if i < len(typeDefinitions)-1 {
			result.WriteString("\n\n")
		}
	}

	return result.String(), imports, nil
}

func generateFragmentTypes(
	ctx *DocumentContext,
	rootTypeName string,
	doc *collected.Document,
	collectedDocs *collected.Documents,
) []string {
	var types []string

	// gather the document-level directive flags in a single pass. @plural marks the
	// fragment as list-shaped (spread on a list field, consumed as an array); a
	// document-level @loading shapes the value while it loads.
	pluralFragment := false
	documentLoading := false
	for _, directive := range doc.Directives {
		switch directive.Name {
		case graphql.PluralDirective:
			pluralFragment = true
		case graphql.LoadingDirective:
			documentLoading = true
		}
	}

	// Generate fragment input type
	inputTypeName := fmt.Sprintf("%s$input", doc.Name)
	if len(doc.Variables) > 0 {
		var inputFields []string
		for _, variable := range doc.Variables {
			tsType := convertLeafType(
				ctx,
				variable.Type,
				&variable.TypeModifiers,
				collectedDocs,
			)
			optional := ""
			if !strings.HasSuffix(variable.TypeModifiers, "!") {
				optional = "?"
			}
			inputFields = append(
				inputFields,
				fmt.Sprintf("\t%s%s: %s;", variable.Name, optional, tsType),
			)
		}
		inputType := fmt.Sprintf(
			"export type %s = {\n%s\n};",
			inputTypeName,
			strings.Join(inputFields, "\n"),
		)
		types = append(types, inputType)
	} else {
		types = append(types, fmt.Sprintf("export type %s = never;", inputTypeName))
	}

	// Generate main fragment type. @plural fragments are spread on a list field and
	// consumed as an array, so the reference type is wrapped in ReadonlyArray (the
	// $data type below stays the single-item shape).
	dataTypeName := fmt.Sprintf("%s$data", doc.Name)
	// The " $fragments" marker is a phantom brand that a pending (LoadingType) reference is
	// NOT assignable to, so a loading reference can't be passed to a fragment that can't
	// render it. The brand's single property is a human-readable message keyed by the
	// fragment name, so it shows up in the type error both when a loading reference is
	// passed (no properties in common with the brand) and when the spread is missing
	// (... is missing ... required in { Fragment: <brand> }). A fragment that can render
	// during a loading frame — i.e. it carries @loading anywhere, on its definition OR on a
	// field — also accepts a pending reference; only a fragment with no @loading at all
	// rejects one.
	fragmentMarker := fmt.Sprintf(
		`{ readonly "expected a %s fragment spread"?: never }`,
		doc.Name,
	)
	if documentLoading || hasAnyLoadingDirectives(doc.Selections) {
		fragmentMarker = fmt.Sprintf(
			`{ readonly "expected a %s fragment spread"?: never } | LoadingType`,
			doc.Name,
		)
	}
	referenceShape := fmt.Sprintf(`{
	readonly "shape"?: %s;
	readonly " $fragments": {
		"%s": %s;
	};
}`, dataTypeName, doc.Name, fragmentMarker)
	if pluralFragment {
		referenceShape = fmt.Sprintf("ReadonlyArray<%s>", referenceShape)
	}
	mainType := fmt.Sprintf("export type %s = %s;", doc.Name, referenceShape)
	types = append(types, mainType)

	// Generate fragment data type (with single indentation for fragments). The loading
	// variant is generated when the fragment has field-level @loading OR a definition-level
	// @loading (`fragment X on Y @loading`); the latter cascades into every field, and
	// composes with any field-level marks rather than being cancelled by them.
	if hasAnyLoadingDirectives(doc.Selections) || documentLoading {
		// Generate union type with normal and loading states
		normalType, _ := generateSelectionType(
			ctx,
			doc.Selections,
			true,
			0,
			rootTypeName,
			collectedDocs,
			false,
		)
		hasGlobalLoading := documentLoading
		loadingType, _ := generateLoadingStateType(
			ctx,
			doc.Selections,
			0,
			rootTypeName,
			hasGlobalLoading,
			collectedDocs,
		)
		dataType := fmt.Sprintf("%s | %s", normalType, loadingType)
		types = append(types, fmt.Sprintf("export type %s = %s;", dataTypeName, dataType))
	} else {
		// Generate normal single type
		dataType, _ := generateSelectionType(ctx, doc.Selections, true, 0, rootTypeName, collectedDocs, false)
		types = append(types, fmt.Sprintf("export type %s = %s;", dataTypeName, dataType))
	}

	return types
}

func generateOperationTypes(
	ctx *DocumentContext,
	rootTypeName string,
	doc *collected.Document,
	collectedDocs *collected.Documents,
	unmaskedSelection []*collected.Selection,
) []string {
	var types []string

	// Generate main operation type first
	inputTypeName := fmt.Sprintf("%s$input", doc.Name)
	resultTypeName := fmt.Sprintf("%s$result", doc.Name)
	optimisticTypeName := fmt.Sprintf("%s$optimistic", doc.Name)

	resultTypeRef := resultTypeName
	if doc.Kind != "mutation" {
		resultTypeRef = fmt.Sprintf("%s | undefined", resultTypeName)
	}

	// Generate main type - input field is optional when there are no variables
	var inputField string
	if len(doc.Variables) > 0 {
		inputField = fmt.Sprintf(`	readonly "input": %s;`, inputTypeName)
	} else {
		inputField = fmt.Sprintf(`	readonly "input"?: %s;`, inputTypeName)
	}

	mainType := fmt.Sprintf(`export type %s = {
%s
	readonly "result": %s;
};`, doc.Name, inputField, resultTypeRef)
	types = append(types, mainType)

	// Generate result type
	if ctx.HasLoading {
		// Generate union type with normal and loading states
		normalType, _ := generateSelectionType(
			ctx,
			doc.Selections,
			true,
			0,
			rootTypeName,
			collectedDocs,
			false,
		)
		// Document-level @loading turns on the global loading shape (every field
		// present as a placeholder). Field-level @loading directives layer on top to
		// configure individual fields (e.g. @loading(count:) on a list); they must not
		// switch the document out of global mode and drop the unmarked fields.
		hasGlobalLoading := hasDocumentLevelLoading(doc)
		loadingType, _ := generateLoadingStateType(
			ctx,
			doc.Selections,
			0,
			rootTypeName,
			hasGlobalLoading,
			collectedDocs,
		)
		resultType := fmt.Sprintf("%s | %s", normalType, loadingType)
		types = append(types, fmt.Sprintf("export type %s = %s;", resultTypeName, resultType))
	} else {
		// Generate normal single type
		resultType, _ := generateSelectionType(ctx, doc.Selections, true, 0, rootTypeName, collectedDocs, false)
		types = append(types, fmt.Sprintf("export type %s = %s;", resultTypeName, resultType))
	}

	// Generate input type - always generate, but set to null | undefined if no variables
	if len(doc.Variables) > 0 {
		var inputFields []string
		for _, variable := range doc.Variables {
			tsType := convertLeafType(
				ctx,
				variable.Type,
				&variable.TypeModifiers,
				collectedDocs,
			)
			optional := ""
			if !strings.HasSuffix(variable.TypeModifiers, "!") {
				optional = "?"
			}
			inputFields = append(
				inputFields,
				fmt.Sprintf("\t%s%s: %s;", variable.Name, optional, tsType),
			)
		}
		inputType := fmt.Sprintf(
			"export type %s = {\n%s\n};",
			inputTypeName,
			strings.Join(inputFields, "\n"),
		)
		types = append(types, inputType)
	} else {
		// No variables - input type is null | undefined
		inputType := fmt.Sprintf("export type %s = null | undefined;", inputTypeName)
		types = append(types, inputType)
	}

	// Generate optimistic type for mutations
	if doc.Kind == "mutation" {
		optimisticType, _ := generateOptimisticType(
			ctx,
			doc.Selections,
			true,
			0,
			rootTypeName,
			collectedDocs,
		)
		types = append(
			types,
			fmt.Sprintf("export type %s = %s;", optimisticTypeName, optimisticType),
		)
	}

	// Generate $unmasked type: the fully-resolved server payload with all fragment
	// fields inlined and no " $fragments" mask annotations. Used by createMock so
	// test data can be written as plain JSON matching what the network would return.
	// unmaskedSelection comes from FlattenSelection(defaultMask=false) so all fragment
	// fields are already merged in deterministic order — no manual sort needed.
	unmaskedTypeName := fmt.Sprintf("%s$unmasked", doc.Name)
	unmaskedType, _ := generateSelectionType(ctx, unmaskedSelection, true, 0, rootTypeName, collectedDocs, true)
	types = append(types, fmt.Sprintf("export type %s = %s;", unmaskedTypeName, unmaskedType))

	return types
}

func generateSelectionType(
	ctx *DocumentContext,
	selections []*collected.Selection,
	readonly bool,
	indentLevel int,
	parentType string,
	collectedDocs *collected.Documents,
	unmasked bool,
) (string, error) {
	if len(selections) == 0 {
		return "{}", nil
	}

	// inline the fields of any fragment spread that disables masking
	selections, optionalFields := expandMaskedSpreads(ctx, collectedDocs, selections, parentType)

	var fields []string
	var fragmentFields []string

	// First pass: determine which fields will actually be visible
	// We need to do this in two passes to avoid circular dependency between
	// explicitFieldCount and shouldSkipKeyField logic

	var visibleSelections []*collected.Selection
	explicitFieldCount := 0
	fragmentCount := 0

	// Count fragments first
	for _, sel := range selections {
		if sel.Kind == "fragment" {
			fragmentCount++
		}
	}

	// Fragment loading logic is now handled in the visibility determination below

	// Count explicit fields that would be visible (excluding internal/auto-added fields)
	for _, sel := range selections {
		if sel.Kind == "fragment" {
			// In unmasked mode, fragment spread markers are skipped entirely — the
			// fields they contributed are already inlined in the flattened selection.
			if !unmasked {
				visibleSelections = append(visibleSelections, sel)
			}
			continue
		}

		// Skip internal fields (automatically added fields like __typename) unless
		// generating the $unmasked type, where all server-visible fields are included.
		if sel.Internal && !unmasked {
			continue
		}

		visibleSelections = append(visibleSelections, sel)
		if sel.FieldName != "__typename" {
			explicitFieldCount++
		}
	}

	// onlyFragments logic is now handled in the first pass when determining visibility

	// Second pass: generate types for visible selections
	for _, selection := range visibleSelections {

		// Check if this field has inline fragments (interface/union type)
		hasInlineFragments := false
		for _, child := range selection.Children {
			if child.Kind == "inline_fragment" {
				hasInlineFragments = true
				break
			}
		}

		// Check if this field has @loading directive (for future use)
		hasLoadingDirective := false
		for _, directive := range selection.Directives {
			if directive.Name == graphql.LoadingDirective {
				hasLoadingDirective = true
				break
			}
		}
		_ = hasLoadingDirective // Mark as used

		fieldName := selection.FieldName
		if selection.Alias != nil {
			fieldName = *selection.Alias
		}

		// Handle fragment spreads
		if selection.Kind == "fragment" {
			// Use the FieldName as the fragment name if FragmentRef is not available
			fragmentName := selection.FieldName
			if selection.FragmentRef != nil {
				fragmentName = *selection.FragmentRef
			}
			fragmentIndent := strings.Repeat("\t", indentLevel+2)
			fragmentFields = append(
				fragmentFields,
				fmt.Sprintf("%s%s: {};", fragmentIndent, fragmentName),
			)

			continue
		}

		// Generate field type
		var fieldType string

		if len(selection.Children) > 0 {
			if hasInlineFragments {
				// Interface/Union type - generate union with discriminators
				unionType := generateInterfaceUnionType(
					ctx,
					selection,
					readonly,
					collectedDocs,
					unmasked,
					indentLevel+1,
				)

				// Apply type modifiers (lists, nullability) to the union type
				modifiers := ""
				if selection.TypeModifiers != nil {
					modifiers = *selection.TypeModifiers
				}
				fieldType = ApplyTypeModifiers(unionType, modifiers, false) // Output type
			} else {
				// Regular nested object type
				childType, childErr := generateSelectionType(ctx, selection.Children, readonly, indentLevel+1, selection.FieldType, collectedDocs, unmasked)
				if childErr != nil {
					return "", childErr
				}

				// Apply type modifiers (lists, nullability) using the proper function
				modifiers := ""
				if selection.TypeModifiers != nil {
					modifiers = *selection.TypeModifiers
				}
				fieldType = ApplyTypeModifiers(childType, modifiers, false) // Output type
			}
		} else {
			// Scalar field - use simplified type conversion.
			// Special-case __typename on a concrete parent type: we know the exact string literal.
			if selection.FieldName == "__typename" && parentType != "" && len(collectedDocs.PossibleTypes[parentType]) == 0 {
				fieldType = fmt.Sprintf(`"%s"`, parentType)
			} else {
				fieldType = convertLeafType(ctx, selection.FieldType, selection.TypeModifiers, collectedDocs)
			}
		}

		// @includeListID attaches an opaque __id to the runtime value; reflect that in the type
		for _, directive := range selection.Directives {
			if directive.Name == graphql.IncludeListIDDirective {
				fieldType = fieldType + " & { __id: string }"
				break
			}
		}

		// Add readonly modifier if needed
		readonlyPrefix := ""
		if readonly {
			readonlyPrefix = "readonly "
		}

		// fields inlined through a conditionally included spread might be missing
		// from the response so they are typed as optional
		if optionalFields[selection] {
			fieldName += "?"
		}

		// Add JSDoc comment if this field has a description
		var fieldDef string
		indent := strings.Repeat("\t", indentLevel+1)
		if selection.Description != nil && *selection.Description != "" {
			comment := fieldComment(selection, indentLevel+1)
			fieldDef = fmt.Sprintf(
				"%s\n%s%s%s: %s;",
				comment,
				indent,
				readonlyPrefix,
				fieldName,
				fieldType,
			)
		} else {
			fieldDef = fmt.Sprintf("%s%s%s: %s;", indent, readonlyPrefix, fieldName, fieldType)
		}

		fields = append(fields, fieldDef)
	}

	// Add fragment spreads if any
	if len(fragmentFields) > 0 {
		readonlyPrefix := ""
		if readonly {
			readonlyPrefix = "readonly "
		}
		indent := strings.Repeat("\t", indentLevel+1)
		fragmentField := fmt.Sprintf(
			"%s%s\" $fragments\": {\n%s\n%s};",
			indent,
			readonlyPrefix,
			strings.Join(fragmentFields, "\n"),
			indent,
		)
		fields = append(fields, fragmentField)
	}

	if len(fields) == 0 {
		return "{}", nil
	}

	// Add proper indentation for the closing brace
	closingIndent := strings.Repeat("\t", indentLevel)
	return fmt.Sprintf("{\n%s\n%s}", strings.Join(fields, "\n"), closingIndent), nil
}

func generateInterfaceUnionType(
	ctx *DocumentContext,
	selection *collected.Selection,
	readonly bool,
	collectedDocs *collected.Documents,
	unmasked bool,
	indentLevel int,
) string {
	return generateInterfaceUnionTypeWithLoading(ctx, selection, readonly, false, collectedDocs, unmasked, indentLevel)
}

func generateInterfaceUnionTypeWithLoading(
	ctx *DocumentContext,
	selection *collected.Selection,
	readonly bool,
	isLoadingState bool,
	collectedDocs *collected.Documents,
	unmasked bool,
	indentLevel int,
) string {
	readonlyPrefix := ""
	if readonly {
		readonlyPrefix = "readonly "
	}
	fieldIndent := strings.Repeat("\t", indentLevel+1)
	memberIndent := strings.Repeat("\t", indentLevel)
	fragmentSubIndent := strings.Repeat("\t", indentLevel+2)

	// Collect all fragments and determine which concrete types need union members
	fragmentsByType := make(map[string][]*collected.Selection)
	concreteTypesSet := make(map[string]bool)
	// Track named fragment spreads (e.g. ...UserFrag) per concrete type for " $fragments" markers
	namedFragmentsByType := make(map[string][]string)

	// Get the possible types for this field (e.g., for Entity union: User, Cat)
	fieldPossibleTypes := make(map[string]bool)
	if possibleTypesMap, exists := collectedDocs.PossibleTypes[selection.FieldType]; exists {
		for typeName := range possibleTypesMap {
			fieldPossibleTypes[typeName] = true
		}
	} else {
		// If it's not a union/interface, the field type itself is the only possible type
		fieldPossibleTypes[selection.FieldType] = true
	}

	// collectNamedFragments gathers named fragment spreads from a child list into the map
	collectNamedFragments := func(concreteType string, children []*collected.Selection) {
		for _, grandchild := range children {
			if grandchild.Kind == "fragment" {
				fragName := grandchild.FieldName
				if grandchild.FragmentRef != nil {
					fragName = *grandchild.FragmentRef
				}
				namedFragmentsByType[concreteType] = append(namedFragmentsByType[concreteType], fragName)
			}
		}
	}

	// Helper function to recursively process inline fragments
	var processInlineFragments func([]*collected.Selection)
	processInlineFragments = func(selections []*collected.Selection) {
		for _, child := range selections {
			if child.Kind == "inline_fragment" {
				fragmentTypeName := child.FieldName

				// If the fragment is on an abstract type (interface/union),
				// we need to apply it to all concrete types that implement it
				if possibleTypesMap, exists := collectedDocs.PossibleTypes[fragmentTypeName]; exists {
					// This is an abstract type - add the fragment to ALL concrete implementations
					for concreteType := range possibleTypesMap {
						fragmentsByType[concreteType] = append(fragmentsByType[concreteType], child)
						concreteTypesSet[concreteType] = true
						expanded, _ := expandMaskedSpreads(ctx, collectedDocs, child.Children, concreteType)
						collectNamedFragments(concreteType, expanded)
					}
					// Also recursively process any nested inline fragments within this abstract fragment
					processInlineFragments(child.Children)
				} else {
					// This is a concrete type - add the fragment directly if it's possible for this field
					if fieldPossibleTypes[fragmentTypeName] {
						fragmentsByType[fragmentTypeName] = append(fragmentsByType[fragmentTypeName], child)
						concreteTypesSet[fragmentTypeName] = true
						expanded, _ := expandMaskedSpreads(ctx, collectedDocs, child.Children, fragmentTypeName)
						collectNamedFragments(fragmentTypeName, expanded)
					}
				}
			}
		}
	}

	// Process all inline fragments, including nested ones
	processInlineFragments(selection.Children)

	// Filter concrete types to only include those that are possible for this field
	// This ensures we only generate union members for types that can actually appear
	var filteredTypes []string
	for typeName := range concreteTypesSet {
		if fieldPossibleTypes[typeName] {
			filteredTypes = append(filteredTypes, typeName)
		}
	}

	// Sort for consistent output
	sort.Strings(filteredTypes)

	// If no inline fragments, fallback to simple object
	if len(filteredTypes) == 0 {
		return "{}"
	}

	// Build union parts for each type that has an inline fragment
	var unionParts []string
	for _, typeName := range filteredTypes {
		// Build the type literal for this possible type
		var fields []string

		// expand every fragment that applies to this type in a single pass so a
		// field selected by more than one fragment keeps the union of its
		// sub-selections instead of only the first occurrence (duplicates are
		// merged inside expandMaskedSpreads)
		allChildren := []*collected.Selection{}
		for _, fragment := range fragmentsByType[typeName] {
			allChildren = append(allChildren, fragment.Children...)
		}
		fragmentChildren, optionalFields := expandMaskedSpreads(ctx, collectedDocs, allChildren, typeName)
		for _, fragmentChild := range fragmentChildren {
			// Skip __typename fields from fragments - we'll add the discriminated version
			if fragmentChild.Kind == "field" && fragmentChild.FieldName != "__typename" {
				var fieldType string

				if isLoadingState {
					// In loading state, all fields become LoadingType
					fieldType = "LoadingType"
				} else {
					// Check if this field has children (nested object type)
					if len(fragmentChild.Children) > 0 {
						// Check if this field has inline fragments (interface/union type)
						hasInlineFragments := false
						for _, child := range fragmentChild.Children {
							if child.Kind == "inline_fragment" {
								hasInlineFragments = true
								break
							}
						}

						if hasInlineFragments {
							// Interface/Union type - generate union with discriminators
							unionType := generateInterfaceUnionType(
								ctx,
								fragmentChild,
								readonly,
								collectedDocs,
								unmasked,
								indentLevel+1,
							)

							// Apply type modifiers (lists, nullability) to the union type
							modifiers := ""
							if fragmentChild.TypeModifiers != nil {
								modifiers = *fragmentChild.TypeModifiers
							}
							fieldType = ApplyTypeModifiers(
								unionType,
								modifiers,
								false,
							) // Output type
						} else {
							// Regular nested object type
							childType, childErr := generateSelectionType(ctx, fragmentChild.Children, readonly, indentLevel+1, fragmentChild.FieldType, collectedDocs, unmasked)
							if childErr != nil {
								// Fallback to simple type conversion on error
								fieldType = convertLeafType(
									ctx,
									fragmentChild.FieldType,
									fragmentChild.TypeModifiers,
									collectedDocs,
								)
							} else {
								// Apply type modifiers (lists, nullability) using the proper function
								modifiers := ""
								if fragmentChild.TypeModifiers != nil {
									modifiers = *fragmentChild.TypeModifiers
								}
								fieldType = ApplyTypeModifiers(childType, modifiers, false) // Output type
							}
						}
					} else {
						fieldType = convertLeafType(
							ctx,
							fragmentChild.FieldType,
							fragmentChild.TypeModifiers,
							collectedDocs,
						)
					}
				}

				// fields inlined through a conditionally included spread might be
				// missing from the response so they are typed as optional
				optional := ""
				if optionalFields[fragmentChild] {
					optional = "?"
				}

				fields = append(
					fields,
					fmt.Sprintf(
						"%s%s%s%s: %s;",
						fieldIndent,
						readonlyPrefix,
						fragmentChild.FieldName,
						optional,
						fieldType,
					),
				)
			}
		}

		// union/interface arms merge fields across several inline fragments, so the
		// per-node sort FlattenSelection applies doesn't survive the merge. only the
		// $unmasked type wants a stable global order and only tests need it sorted, so
		// gate on sortKeys to keep production (sortKeys=false) free of the cost.
		if ctx.SortKeys && unmasked {
			sort.Strings(fields)
		}

		// Add " $fragments" marker for named fragment spreads on this concrete type
		// (omitted in unmasked mode — the fields are already inlined)
		if !unmasked {
			if fragNames := namedFragmentsByType[typeName]; len(fragNames) > 0 {
				seen := make(map[string]bool)
				var uniqueFragNames []string
				for _, n := range fragNames {
					if !seen[n] {
						seen[n] = true
						uniqueFragNames = append(uniqueFragNames, n)
					}
				}
				sort.Strings(uniqueFragNames)
				fragEntries := make([]string, len(uniqueFragNames))
				for i, n := range uniqueFragNames {
					fragEntries[i] = fmt.Sprintf("%s%s: {};", fragmentSubIndent, n)
				}
				fields = append(fields, fmt.Sprintf(
					"%s%s\" $fragments\": {\n%s\n%s};",
					fieldIndent,
					readonlyPrefix,
					strings.Join(fragEntries, "\n"),
					fieldIndent,
				))
			}
		}

		// Always add __typename field for discrimination with literal type
		fields = append(fields, fmt.Sprintf("%s%s__typename: \"%s\";", fieldIndent, readonlyPrefix, typeName))

		// Create the type literal
		typeLiteral := fmt.Sprintf("({\n%s\n%s})", strings.Join(fields, "\n"), memberIndent)
		unionParts = append(unionParts, typeLiteral)
	}

	// Add non-exhaustive case for interfaces (not unions)
	// Check if this is an interface by looking at possible types
	if possibleTypesMap, exists := collectedDocs.PossibleTypes[selection.FieldType]; exists &&
		len(possibleTypesMap) > len(filteredTypes) {
		// This is an interface with more possible types than we have fragments for
		// But only add non-exhaustive case if we don't have fragments for all concrete types
		var hasFragmentForAllTypes bool = true
		for concreteType := range possibleTypesMap {
			found := false
			for _, fragmentType := range filteredTypes {
				if fragmentType == concreteType {
					found = true
					break
				}
			}
			if !found {
				hasFragmentForAllTypes = false
				break
			}
		}

		if !hasFragmentForAllTypes {
			nonExhaustive := fmt.Sprintf(
				"({\n%s%s\" $fragments\"?: {};\n%s%s__typename: \"non-exhaustive; don't match this\";\n%s})",
				fieldIndent,
				readonlyPrefix,
				fieldIndent,
				readonlyPrefix,
				memberIndent,
			)
			unionParts = append(unionParts, nonExhaustive)
		}
	}

	// Create the union type
	if isLoadingState {
		unionType := fmt.Sprintf("({} & (%s))", strings.Join(unionParts, " | "))
		return unionType
	} else {
		unionType := fmt.Sprintf("{} & (%s)", strings.Join(unionParts, " | "))
		return unionType
	}
}

func hasAnyLoadingDirectives(selections []*collected.Selection) bool {
	for _, selection := range selections {
		// Check if this field has @loading directive
		for _, directive := range selection.Directives {
			if directive.Name == graphql.LoadingDirective {
				return true
			}
		}
		// Check children recursively
		if len(selection.Children) > 0 && hasAnyLoadingDirectives(selection.Children) {
			return true
		}
	}
	return false
}

func hasDocumentLevelLoading(doc *collected.Document) bool {
	// Check if the document has @loading directive at the document level
	for _, directive := range doc.Directives {
		if directive.Name == graphql.LoadingDirective {
			return true
		}
	}
	return false
}

func generateOptimisticType(
	ctx *DocumentContext,
	selections []*collected.Selection,
	readonly bool,
	indentLevel int,
	parentType string,
	collectedDocs *collected.Documents,
) (string, error) {
	if len(selections) == 0 {
		return "{}", nil
	}

	var fields []string
	indent := strings.Repeat("\t", indentLevel+1)

	// First pass: determine which fields will actually be visible
	var visibleSelections []*collected.Selection
	explicitFieldCount := 0
	fragmentCount := 0

	// Count fragments first
	for _, sel := range selections {
		if sel.Kind == "fragment" {
			fragmentCount++
		}
	}

	// Count explicit fields that would be visible (excluding internal/auto-added fields)
	for _, sel := range selections {
		if sel.Kind == "fragment" {
			visibleSelections = append(visibleSelections, sel)
			continue
		}

		// Skip internal fields (automatically added fields like __typename)
		if sel.Internal {
			continue
		}

		visibleSelections = append(visibleSelections, sel)
		if sel.FieldName != "__typename" {
			// @optimisticKey fields are server-generated; the caller can never provide them,
			// so they don't count as "explicit" — without this, a selection like
			// { id @optimisticKey ...Frag } would suppress fragment expansion and produce
			// a broken `Frag?: null` optimistic type instead of inlining the fragment fields.
			isOptimisticKey := false
			for _, d := range sel.Directives {
				if d.Name == graphql.OptimisticKeyDirective {
					isOptimisticKey = true
					break
				}
			}
			if !isOptimisticKey {
				explicitFieldCount++
			}
		}
	}

	// When all selections are fragment spreads (e.g. list-operation mutations), expand
	// the fragments inline so users can provide the actual fields in the optimistic response.
	if explicitFieldCount == 0 && fragmentCount > 0 {
		var expanded []*collected.Selection
		for _, sel := range visibleSelections {
			if sel.Kind != "fragment" {
				continue
			}
			fragName := sel.FieldName
			if sel.FragmentRef != nil {
				fragName = *sel.FragmentRef
			}
			if fragDoc, ok := collectedDocs.Selections[fragName]; ok {
				expanded = append(expanded, fragDoc.Selections...)
			}
		}
		if len(expanded) > 0 {
			return generateOptimisticType(ctx, expanded, readonly, indentLevel, parentType, collectedDocs)
		}
	}

	// Second pass: generate types for visible selections
	for _, selection := range visibleSelections {
		// Fields marked @optimisticKey are server-generated (e.g. id) and must not
		// appear in the optimistic response type — the caller cannot know them yet.
		isOptimisticKey := false
		for _, d := range selection.Directives {
			if d.Name == graphql.OptimisticKeyDirective {
				isOptimisticKey = true
				break
			}
		}
		if isOptimisticKey {
			continue
		}

		fieldName := selection.FieldName
		readonlyPrefix := ""
		if readonly {
			readonlyPrefix = "readonly "
		}

		var fieldType string

		// Check if this field has inline fragments (interface/union type)
		hasInlineFragments := false
		for _, child := range selection.Children {
			if child.Kind == "inline_fragment" {
				hasInlineFragments = true
				break
			}
		}

		if hasInlineFragments {
			// Generate union type for interface/union fields
			fieldType = generateInterfaceUnionType(
				ctx,
				selection,
				readonly,
				collectedDocs,
				false,
				indentLevel+1,
			)
		} else if len(selection.Children) > 0 {
			// Regular nested object type
			childType, childErr := generateOptimisticType(ctx, selection.Children, readonly, indentLevel+1, selection.FieldType, collectedDocs)
			if childErr != nil {
				return "", childErr
			}
			fieldType = childType
		} else {
			// Leaf field - convert the GraphQL type to TypeScript.
			// Special-case __typename on a concrete parent type: we know the exact string literal.
			if selection.FieldName == "__typename" && parentType != "" && len(collectedDocs.PossibleTypes[parentType]) == 0 {
				fieldType = fmt.Sprintf(`"%s"`, parentType)
			} else {
				fieldType = convertLeafType(ctx, selection.FieldType, selection.TypeModifiers, collectedDocs)
			}
		}

		// Add JSDoc comment if this field has a description
		if selection.Description != nil && *selection.Description != "" {
			comment := fieldComment(selection, indentLevel+1)
			fields = append(fields, comment)
		}

		// For optimistic types, all fields are optional
		// If the field is nullable in the schema, preserve that nullability
		if selection.TypeModifiers != nil && !strings.Contains(*selection.TypeModifiers, "!") {
			// Field is nullable - add | null to the optimistic type
			if len(selection.Children) > 0 {
				// For object types, add | null after the object type
				fieldType = fmt.Sprintf("%s | null", fieldType)
			} else {
				// For scalar types, nullability should already be included by convertToTypeScriptTypeSimple
				// but ensure it's there for optimistic types
				if !strings.Contains(fieldType, "| null") && !strings.Contains(fieldType, "| undefined") {
					fieldType = fmt.Sprintf("%s | null", fieldType)
				}
			}
		}
		fields = append(
			fields,
			fmt.Sprintf("%s%s%s?: %s;", indent, readonlyPrefix, fieldName, fieldType),
		)
	}

	if len(fields) == 0 {
		return "{}", nil
	}

	// Add proper indentation for the closing brace
	closingIndent := strings.Repeat("\t", indentLevel)
	return fmt.Sprintf("{\n%s\n%s}", strings.Join(fields, "\n"), closingIndent), nil
}

func generateLoadingStateType(
	ctx *DocumentContext,
	selections []*collected.Selection,
	indentLevel int,
	parentType string,
	forceLoading bool,
	collectedDocs *collected.Documents,
) (string, error) {
	if len(selections) == 0 {
		return "{}", nil
	}

	var fields []string
	var fragmentFields []string
	indent := strings.Repeat("\t", indentLevel+1)

	// First pass: determine which fields will actually be visible
	var visibleSelections []*collected.Selection
	explicitFieldCount := 0
	fragmentCount := 0

	for _, sel := range selections {
		if sel.Kind == "fragment" {
			fragmentCount++
			visibleSelections = append(visibleSelections, sel)
			continue
		}

		// Skip internal fields (automatically added fields like __typename)
		if sel.Internal {
			continue
		}

		visibleSelections = append(visibleSelections, sel)
		if sel.FieldName != "__typename" {
			explicitFieldCount++
		}
	}

	// onlyFragments logic is now handled in the first pass when determining visibility

	// Second pass: generate types for visible selections
	for _, selection := range visibleSelections {
		// Handle fragment spreads with @loading (or global loading)
		if selection.Kind == "fragment" {
			// Check if this fragment spread has @loading directive or if global loading is enabled
			hasFragmentLoading := forceLoading // Global loading treats all fragments as having @loading
			if !hasFragmentLoading {
				for _, directive := range selection.Directives {
					if directive.Name == graphql.LoadingDirective {
						hasFragmentLoading = true
						break
					}
				}
			}

			if hasFragmentLoading {
				// Fragment spread with @loading (or global loading): the spread's data is
				// pending while it loads, so mark the reference as LoadingType in the loading
				// variant. This keeps the variant a genuine loading variant (it carries a
				// PendingValue) so isPending can detect it, matching the runtime where the
				// fragment's pending fields are co-located on the reference.
				fragmentName := selection.FieldName
				if selection.FragmentRef != nil {
					fragmentName = *selection.FragmentRef
				}
				fragmentIndent := strings.Repeat("\t", indentLevel+2)
				fragmentFields = append(
					fragmentFields,
					fmt.Sprintf("%s%s: LoadingType;", fragmentIndent, fragmentName),
				)
			}
			continue
		}

		fieldName := selection.FieldName
		readonlyPrefix := "readonly "

		var fieldType string

		// Check if this field has @loading directive
		hasLoading := forceLoading
		cascadeLoading := forceLoading // Document-level loading acts like cascade on everything
		for _, directive := range selection.Directives {
			if directive.Name == graphql.LoadingDirective {
				hasLoading = true

				for _, arg := range directive.Arguments {
					if arg.Name == "cascade" && arg.Value.Raw == "true" {
						cascadeLoading = true
					}
				}

				// if the directive
				break
			}
		}

		if hasLoading {
			if len(selection.Children) > 0 {
				// Check if children only contain fragment spreads with @loading
				onlyLoadingFragments := true
				hasLoadingFragments := false
				hasExplicitFields := false
				for _, child := range selection.Children {
					if child.Kind == "fragment" {
						// Check if this fragment has @loading or if global loading is enabled
						childHasLoading := cascadeLoading // Cascade loading treats all fragments as having @loading
						if !childHasLoading {
							for _, directive := range child.Directives {
								if directive.Name == graphql.LoadingDirective {
									childHasLoading = true
									break
								}
							}
						}
						if childHasLoading {
							hasLoadingFragments = true
						} else {
							onlyLoadingFragments = false
						}
					} else if !child.Internal {
						hasExplicitFields = true
						onlyLoadingFragments = false
					}
				}

				// Only consider it "only loading fragments" if we have loading fragments and no explicit fields
				onlyLoadingFragments = onlyLoadingFragments && hasLoadingFragments &&
					!hasExplicitFields

				if onlyLoadingFragments && hasLoadingFragments {
					// Field with @loading that only contains fragment spreads with @loading
					// Generate the same structure as normal state (fragment structure)
					childType, childErr := generateLoadingStateType(
						ctx,
						selection.Children,
						indentLevel+1,
						selection.FieldType,
						cascadeLoading,
						collectedDocs,
					)
					if childErr != nil {
						return "", childErr
					}
					fieldType = childType

					// Apply array syntax if this is a list type
					if selection.TypeModifiers != nil &&
						strings.Contains(*selection.TypeModifiers, "]") {
						fieldType = fmt.Sprintf("%s[]", fieldType)
					}

				} else if hasAnyLoadingDirectives(selection.Children) || cascadeLoading {
					// Check if this field has inline fragments (interface/union type)
					hasInlineFragments := false
					for _, child := range selection.Children {
						if child.Kind == "inline_fragment" {
							hasInlineFragments = true
							break
						}
					}

					if hasInlineFragments && cascadeLoading {
						// Interface/Union type with cascade - generate union with loading states
						unionType := generateInterfaceUnionTypeWithLoading(
							ctx,
							selection,
							true, // readonly
							true, // isLoadingState
							collectedDocs,
							false, // unmasked
							indentLevel+1,
						)

						// Apply array syntax if this is a list type
						if selection.TypeModifiers != nil && strings.Contains(*selection.TypeModifiers, "]") {
							fieldType = fmt.Sprintf("%s[]", unionType)
						} else {
							fieldType = unionType
						}
					} else {
						// Field with @loading directive that has children with loading - generate nested loading structure
						childType, childErr := generateLoadingStateType(
							ctx,
							selection.Children,
							indentLevel+1,
							selection.FieldType,
							cascadeLoading,
							collectedDocs,
						)
						if childErr != nil {
							return "", childErr
						}
						fieldType = childType

						// Apply array syntax if this is a list type
						if selection.TypeModifiers != nil &&
							strings.Contains(*selection.TypeModifiers, "]") {
							fieldType = fmt.Sprintf("%s[]", fieldType)
						}
					}
				} else {
					// Field with @loading directive (leaf or no loading children) - becomes LoadingType
					fieldType = "LoadingType"

					// Check if this is a list type and apply array syntax
					if selection.TypeModifiers != nil && strings.Contains(*selection.TypeModifiers, "]") {
						fieldType = "LoadingType[]"
					}
				}
			} else {
				// Field with @loading directive (leaf or no loading children) - becomes LoadingType
				fieldType = "LoadingType"

				// Check if this is a list type and apply array syntax
				if selection.TypeModifiers != nil && strings.Contains(*selection.TypeModifiers, "]") {
					fieldType = "LoadingType[]"
				}
			}
		} else {
			// Field without @loading directive is omitted in loading state, unless it has children with @loading
			if len(selection.Children) > 0 && hasAnyLoadingDirectives(selection.Children) {
				// Nested object with loading children - generate loading state for children
				childType, childErr := generateLoadingStateType(
					ctx,
					selection.Children,
					indentLevel+1,
					selection.FieldType,
					forceLoading,
					collectedDocs,
				)
				if childErr != nil {
					return "", childErr
				}
				fieldType = childType

				// Apply array syntax if this is a list type
				if selection.TypeModifiers != nil &&
					strings.Contains(*selection.TypeModifiers, "]") {
					fieldType = fmt.Sprintf("%s[]", fieldType)
				}
			} else {
				// Field without loading - skip it in loading state
				continue
			}
		}

		// Add JSDoc comment if this field has a description
		if selection.Description != nil && *selection.Description != "" {
			comment := fieldComment(selection, indentLevel+1)
			fields = append(fields, comment)
		}

		fields = append(
			fields,
			fmt.Sprintf("%s%s%s: %s;", indent, readonlyPrefix, fieldName, fieldType),
		)
	}

	// Add fragment spreads if any
	if len(fragmentFields) > 0 {
		readonlyPrefix := "readonly "
		indent := strings.Repeat("\t", indentLevel+1)
		fragmentField := fmt.Sprintf(
			"%s%s\" $fragments\": {\n%s\n%s};",
			indent,
			readonlyPrefix,
			strings.Join(fragmentFields, "\n"),
			indent,
		)
		fields = append(fields, fragmentField)
	}

	if len(fields) == 0 {
		return "{}", nil
	}

	// Add proper indentation for the closing brace
	closingIndent := strings.Repeat("\t", indentLevel)
	return fmt.Sprintf("{\n%s\n%s}", strings.Join(fields, "\n"), closingIndent), nil
}

// convertLeafType converts GraphQL leaf types to TypeScript using automatic kind detection
func convertLeafType(
	ctx *DocumentContext,
	typeName string,
	typeModifiers *string,
	collectedDocs *collected.Documents,
) string {
	// Determine the kind automatically based on collected documents and project config
	kind := determineTypeKind(ctx.ProjectConfig, typeName, collectedDocs)

	// Collect dependencies as we encounter them
	typeStr := ""
	switch kind {
	case "ENUM":
		ctx.EnumTypes[typeName] = true

		typeStr = fmt.Sprintf("%s$options", typeName)
	case "INPUT":
		// Only collect input types that are actually input types (not scalars)
		if _, exists := collectedDocs.InputTypes[typeName]; exists {
			ctx.InputTypes[typeName] = true
		}

		typeStr = typeName
	case "SCALAR":
		typeStr = convertScalarType(kind, typeName, ctx.ProjectConfig, false)
		if scalarCfg, ok := ctx.ProjectConfig.Scalars[typeName]; ok && scalarCfg.Module != "" {
			ctx.ScalarImports[ScalarImportStatement(scalarCfg)] = true
		}
	}

	// Apply type modifiers using the exported function
	modifiers := ""
	if typeModifiers != nil {
		modifiers = *typeModifiers
	}

	return ApplyTypeModifiers(typeStr, modifiers, false)
}

// ScalarImportStatement builds the TypeScript import statement for a custom scalar.
// The identifier is the root part of the type name (before any "."), so
// { type: "Temporal.Instant", module: "temporal-polyfill" } → import type { Temporal } from 'temporal-polyfill'
// { type: "MyDate", module: "./my-date", default: true }    → import type MyDate from './my-date'
func ScalarImportStatement(cfg plugins.ScalarConfig) string {
	identifier := cfg.Type
	if dot := strings.Index(identifier, "."); dot != -1 {
		identifier = identifier[:dot]
	}
	if cfg.DefaultImport {
		return fmt.Sprintf("import type %s from '%s'", identifier, cfg.Module)
	}
	return fmt.Sprintf("import type { %s } from '%s'", identifier, cfg.Module)
}

// determineTypeKind automatically determines the GraphQL type kind based on collected documents and project config
func determineTypeKind(
	projectConfig plugins.ProjectConfig,
	typeName string,
	collectedDocs *collected.Documents,
) string {
	// First check collected documents for enum values (for performance)
	if _, isEnum := collectedDocs.EnumValues[typeName]; isEnum {
		return "ENUM"
	}

	// Check if it's a scalar type (built-in or custom)
	if isScalarType(projectConfig, typeName) {
		return "SCALAR"
	}

	// Default to INPUT for unknown types
	return "INPUT"
}

// isScalarType checks if a type is a scalar (built-in GraphQL scalar or custom scalar)
func isScalarType(projectConfig plugins.ProjectConfig, typeName string) bool {
	// Check built-in GraphQL scalars
	switch typeName {
	case "String", "ID", "Int", "Float", "Boolean":
		return true
	}

	// Check runtime scalars
	if _, exists := projectConfig.RuntimeScalars[typeName]; exists {
		return true
	}

	// Check custom scalars
	if _, exists := projectConfig.Scalars[typeName]; exists {
		return true
	}

	return false
}

// RootTypeNames holds the actual root type names from the schema
type RootTypeNames struct {
	Query        string
	Mutation     string
	Subscription string
}

// Helper function to look up actual root type names from the schema
func GetRootTypes(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	conn plugins.Conn,
) (*RootTypeNames, error) {
	rootTypes := &RootTypeNames{}

	// Look up the actual root type names from the types table
	stmt, err := conn.Prepare(`
		SELECT name, operation
		FROM types
		WHERE operation IN ('query', 'mutation', 'subscription')
	`)
	if err != nil {
		return nil, err
	}
	defer stmt.Finalize()

	err = db.StepStatement(ctx, stmt, func() {
		typeName := stmt.ColumnText(0)
		operation := stmt.ColumnText(1)

		switch operation {
		case "query":
			rootTypes.Query = typeName
		case "mutation":
			rootTypes.Mutation = typeName
		case "subscription":
			rootTypes.Subscription = typeName
		}
	})
	if err != nil {
		return nil, err
	}

	return rootTypes, nil
}

// Helper function to determine the root type name for a document
func getRootTypeName(doc *collected.Document, rootTypes *RootTypeNames) string {
	switch doc.Kind {
	case "query":
		return rootTypes.Query
	case "mutation":
		return rootTypes.Mutation
	case "subscription":
		return rootTypes.Subscription
	case "fragment":
		return doc.TypeCondition
	default:
		return rootTypes.Query // fallback
	}
}

func fieldComment(selection *collected.Selection, indentLevel int) string {
	indent := strings.Repeat("\t", indentLevel)

	// Use the actual field description from the schema if available
	if selection.Description != nil && *selection.Description != "" {
		// Check if description contains newlines for multi-line formatting
		description := *selection.Description
		if strings.Contains(description, "\n") {
			// Multi-line comment
			lines := strings.Split(description, "\n")
			var commentLines []string
			commentLines = append(commentLines, fmt.Sprintf("%s/**", indent))
			for _, line := range lines {
				commentLines = append(commentLines, fmt.Sprintf("%s * %s", indent, line))
			}
			commentLines = append(commentLines, fmt.Sprintf("%s */", indent))
			return strings.Join(commentLines, "\n")
		} else {
			// Single-line comment in multi-line format
			return fmt.Sprintf("%s/**\n%s * %s\n%s */", indent, indent, description, indent)
		}
	}

	// Fallback to field name if no description is available
	return fmt.Sprintf("%s/**\n%s * %s\n%s */", indent, indent, selection.FieldName, indent)
}

// Helper function to check if a field name is a key field for a specific type
func isKeyFieldName(
	projectConfig plugins.ProjectConfig,
	typeName string,
	fieldName string,
) bool {
	// Get key fields for this type using ProjectConfig
	var keyFields []string
	// First try to get type-specific keys from ProjectConfig.TypeConfig
	if typeConfig, exists := projectConfig.TypeConfig[typeName]; exists &&
		len(typeConfig.Keys) > 0 {
		keyFields = typeConfig.Keys
	} else {
		// If no type-specific keys found, use default keys from project config
		keyFields = projectConfig.DefaultKeys
	}

	// Check if the field name is in the list of key fields
	return slices.Contains(keyFields, fieldName)
}
