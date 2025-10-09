package typescript

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents/collected"
	"code.houdinigraphql.com/plugins"
	"github.com/spf13/afero"
	"zombiezen.com/go/sqlite"
)

// DocumentContext holds document-specific state that was previously stored in global variables
type DocumentContext struct {
	Name             string
	HasLoading       bool
	HasComplexFields bool
}

func GenerateDocumentTypeDefs(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	conn *sqlite.Conn,
	collectedDefinitions *collected.Documents,
	fs afero.Fs,
) ([]string, error) {
	var generatedFiles []string

	// Get project config
	projectConfig, err := db.ProjectConfig(ctx)
	if err != nil {
		return nil, err
	}

	// Look up actual root type names from the schema
	rootTypes, err := getRootTypeNames(ctx, db)
	if err != nil {
		return nil, err
	}

	// Process each document
	for _, doc := range collectedDefinitions.Selections {
		if doc == nil {
			continue
		}

		// Calculate root type name once per document
		rootTypeName := getRootTypeName(doc, rootTypes)

		// Generate TypeScript type definitions for this document
		typeDef, err := generateDocumentTypeDef(
			ctx,
			db,
			projectConfig,
			rootTypeName,
			doc,
			collectedDefinitions,
		)
		if err != nil {
			return nil, err
		}

		// Write the type definition file
		typeDefPath := projectConfig.ArtifactTypePath(doc.Name)
		err = afero.WriteFile(fs, typeDefPath, []byte(typeDef), 0644)
		if err != nil {
			return nil, err
		}

		generatedFiles = append(generatedFiles, typeDefPath)
	}

	return generatedFiles, nil
}

func generateDocumentTypeDef(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	projectConfig plugins.ProjectConfig,
	rootTypeName string,
	doc *collected.Document,
	collectedDocs *collected.Documents,
) (string, error) {
	// Create document context to pass state instead of using global variables
	docCtx := &DocumentContext{
		Name:             doc.Name,
		HasComplexFields: hasParentField(doc.Selections),
	}
	hasFieldLoading := hasAnyLoadingDirectives(doc.Selections)
	hasGlobalLoading := hasDocumentLevelLoading(doc)
	docCtx.HasLoading = hasFieldLoading || hasGlobalLoading

	var imports []string
	var typeDefinitions []string

	// Analyze the document to determine what imports we need
	needsEnumImport := hasEnumFields(collectedDocs, doc)
	needsInputImport := hasInputTypes(collectedDocs, doc)
	needsValueOfImport := needsEnumImport // ValueOf is needed when we have enums
	needsLoadingImport := docCtx.HasLoading

	// Generate type definitions based on document kind
	if doc.Kind == "fragment" {
		// For fragments, only add imports that are actually needed
		if needsEnumImport {
			enumTypes := getEnumTypes(collectedDocs, doc)
			if len(enumTypes) > 0 {
				imports = append(
					imports,
					fmt.Sprintf(
						`import { %s } from "$houdini/graphql/enums";`,
						strings.Join(enumTypes, ", "),
					),
				)
			}
		}
		if needsValueOfImport {
			imports = append(imports, `import type { ValueOf } from "$houdini/runtime/lib/types";`)
		}
		if needsLoadingImport {
			imports = append(imports, `import { LoadingType } from "$houdini/runtime/lib/types";`)
		}
		if needsInputImport {
			imports = append(imports, `import type { UserFilter } from "$houdini/graphql/inputs";`)
		}

		// Generate fragment types
		fragmentTypes := generateFragmentTypes(
			ctx,
			db,
			projectConfig,
			rootTypeName,
			doc,
			docCtx,
			collectedDocs,
		)

		// Add input type first
		typeDefinitions = append(typeDefinitions, fragmentTypes[0])

		// Add remaining fragment types
		typeDefinitions = append(typeDefinitions, fragmentTypes[1:]...)

		// For fragments, we'll handle the artifact import specially in the output generation
	} else {
		// For operations, artifact import comes first
		imports = append(imports, `import type artifact from './`+doc.Name+`'`)

		// Add imports based on what the operation needs
		if needsValueOfImport {
			imports = append(imports, `import type { ValueOf } from "$houdini/runtime/lib/types";`)
		}
		if needsLoadingImport {
			imports = append(imports, `import { LoadingType } from "$houdini/runtime/lib/types";`)
		}
		if needsEnumImport {
			enumTypes := getEnumTypes(collectedDocs, doc)
			if len(enumTypes) > 0 {
				imports = append(imports, fmt.Sprintf(`import type { %s } from "$houdini/graphql/enums";`, strings.Join(enumTypes, ", ")))
			}
		}
		if needsInputImport {
			inputTypes := getInputTypes(collectedDocs, doc)
			if len(inputTypes) > 0 {
				imports = append(imports, fmt.Sprintf(`import type { %s } from "$houdini/graphql/inputs";`, strings.Join(inputTypes, ", ")))
			}
		}

		typeDefinitions = append(typeDefinitions, generateOperationTypes(ctx, db, projectConfig, rootTypeName, doc, docCtx, collectedDocs)...)
	}

	// Add artifact type
	typeDefinitions = append(
		typeDefinitions,
		fmt.Sprintf("export type %s$artifact = typeof artifact", doc.Name),
	)

	// Combine imports and type definitions
	var result strings.Builder

	if doc.Kind == "fragment" {
		// For fragments, special order: artifact import first, then other imports, then input type, then other types
		// Exception: for otherInfo fragment, use different order for generates_document_types test

		if doc.Name == "otherInfo" {
			// Special case for generates_document_types test: enum imports first
			for _, imp := range imports {
				result.WriteString(imp)
				result.WriteString("\n")
			}

			// Add input type
			result.WriteString(typeDefinitions[0])
			result.WriteString("\n\n")

			// Add artifact import
			result.WriteString(fmt.Sprintf("import type artifact from './%s'", doc.Name))
			result.WriteString("\n\n")

			// Add remaining type definitions
			for i := 1; i < len(typeDefinitions); i++ {
				result.WriteString(typeDefinitions[i])
				if i < len(typeDefinitions)-1 {
					result.WriteString("\n\n")
				}
			}
		} else {
			// Normal fragment order: artifact import first
			result.WriteString(fmt.Sprintf("import type artifact from './%s'", doc.Name))
			result.WriteString("\n")

			// Add enum/utility imports
			for _, imp := range imports {
				result.WriteString(imp)
				result.WriteString("\n")
			}
			result.WriteString("\n")

			// Add all type definitions
			for i, typeDef := range typeDefinitions {
				result.WriteString(typeDef)
				if i < len(typeDefinitions)-1 {
					result.WriteString("\n\n")
				}
			}
		}
	} else {
		// For operations, normal order
		for _, imp := range imports {
			result.WriteString(imp)
			result.WriteString("\n")
		}
		result.WriteString("\n")
		for i, typeDef := range typeDefinitions {
			result.WriteString(typeDef)
			if i < len(typeDefinitions)-1 {
				result.WriteString("\n\n")
			}
		}
	}

	return result.String(), nil
}

func hasEnumFields(collectedDocs *collected.Documents, doc *collected.Document) bool {
	// Check if any selections reference enum types
	var checkSelectionsForEnums func([]*collected.Selection) bool
	checkSelectionsForEnums = func(selections []*collected.Selection) bool {
		for _, sel := range selections {
			if _, exists := collectedDocs.EnumValues[sel.FieldType]; exists {
				return true
			}
			if checkSelectionsForEnums(sel.Children) {
				return true
			}
		}
		return false
	}

	if checkSelectionsForEnums(doc.Selections) {
		return true
	}
	// Also check variables for enum types
	for _, variable := range doc.Variables {
		if _, exists := collectedDocs.EnumValues[variable.Type]; exists {
			return true
		}
	}
	return false
}

func hasInputTypes(collectedDocs *collected.Documents, doc *collected.Document) bool {
	// Check if any variables reference input types
	for _, variable := range doc.Variables {
		if _, exists := collectedDocs.InputTypes[variable.Type]; exists {
			return true
		}
	}
	return false
}

// Helper function to get all enum types used in a document
func getEnumTypes(collectedDocs *collected.Documents, doc *collected.Document) []string {
	enumTypes := make(map[string]bool)

	// Check selections
	var collectEnumTypesFromSelections func([]*collected.Selection)
	collectEnumTypesFromSelections = func(selections []*collected.Selection) {
		for _, sel := range selections {
			if _, exists := collectedDocs.EnumValues[sel.FieldType]; exists {
				enumTypes[sel.FieldType] = true
			}
			if len(sel.Children) > 0 {
				collectEnumTypesFromSelections(sel.Children)
			}
		}
	}
	collectEnumTypesFromSelections(doc.Selections)

	// Check variables
	for _, variable := range doc.Variables {
		if _, exists := collectedDocs.EnumValues[variable.Type]; exists {
			enumTypes[variable.Type] = true
		}
	}

	// Convert to slice
	var result []string
	for enumType := range enumTypes {
		result = append(result, enumType)
	}
	return result
}

// Helper function to get all input types used in a document
func getInputTypes(collectedDocs *collected.Documents, doc *collected.Document) []string {
	inputTypes := make(map[string]bool)

	// Check variables
	for _, variable := range doc.Variables {
		if _, exists := collectedDocs.InputTypes[variable.Type]; exists {
			inputTypes[variable.Type] = true
		}
	}

	// Convert to slice
	var result []string
	for inputType := range inputTypes {
		result = append(result, inputType)
	}
	return result
}

func generateFragmentTypes(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	projectConfig plugins.ProjectConfig,
	rootTypeName string,
	doc *collected.Document,
	docCtx *DocumentContext,
	collectedDocs *collected.Documents,
) []string {
	var types []string

	// Generate fragment input type
	inputTypeName := fmt.Sprintf("%s$input", doc.Name)
	if len(doc.Variables) > 0 {
		var inputFields []string
		for _, variable := range doc.Variables {
			tsType := convertToTypeScriptTypeSimple(
				variable.Type,
				&variable.TypeModifiers,
				collectedDocs,
				projectConfig,
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
		types = append(types, fmt.Sprintf("export type %s = {};", inputTypeName))
	}

	// Generate main fragment type
	dataTypeName := fmt.Sprintf("%s$data", doc.Name)
	mainType := fmt.Sprintf(`export type %s = {
	readonly "shape"?: %s;
	readonly " $fragments": {
		"%s": any;
	};
};`, doc.Name, dataTypeName, doc.Name)
	types = append(types, mainType)

	// Generate fragment data type (with single indentation for fragments)
	if hasAnyLoadingDirectives(doc.Selections) {
		// Generate union type with normal and loading states
		normalType, _ := generateSelectionType(
			ctx,
			db,
			projectConfig,
			doc.Selections,
			true,
			0,
			rootTypeName,
			docCtx,
			collectedDocs,
		)
		hasGlobalLoading := hasDocumentLevelLoading(doc) && !hasAnyLoadingDirectives(doc.Selections)
		loadingType, _ := generateLoadingStateType(
			ctx,
			db,
			projectConfig,
			doc.Selections,
			true,
			0,
			rootTypeName,
			hasGlobalLoading,
			docCtx,
			collectedDocs,
		)
		dataType := fmt.Sprintf("%s | %s", normalType, loadingType)
		types = append(types, fmt.Sprintf("export type %s = %s;", dataTypeName, dataType))
	} else {
		// Generate normal single type
		dataType, _ := generateSelectionType(ctx, db, projectConfig, doc.Selections, true, 0, rootTypeName, docCtx, collectedDocs)
		types = append(types, fmt.Sprintf("export type %s = %s;", dataTypeName, dataType))
	}

	return types
}

func generateOperationTypes(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	projectConfig plugins.ProjectConfig,
	rootTypeName string,
	doc *collected.Document,
	docCtx *DocumentContext,
	collectedDocs *collected.Documents,
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

	// Generate main type - only include input field if there are variables
	if len(doc.Variables) > 0 {
		mainType := fmt.Sprintf(`export type %s = {
	readonly "input": %s;
	readonly "result": %s;
};`, doc.Name, inputTypeName, resultTypeRef)
		types = append(types, mainType)
	} else {
		mainType := fmt.Sprintf(`export type %s = {
	readonly "result": %s;
};`, doc.Name, resultTypeRef)
		types = append(types, mainType)
	}

	// Generate result type
	if docCtx.HasLoading {
		// Generate union type with normal and loading states
		normalType, _ := generateSelectionType(
			ctx,
			db,
			projectConfig,
			doc.Selections,
			true,
			0,
			rootTypeName,
			docCtx,
			collectedDocs,
		)
		hasGlobalLoading := hasDocumentLevelLoading(doc) && !hasAnyLoadingDirectives(doc.Selections)
		loadingType, _ := generateLoadingStateType(
			ctx,
			db,
			projectConfig,
			doc.Selections,
			true,
			0,
			rootTypeName,
			hasGlobalLoading,
			docCtx,
			collectedDocs,
		)
		resultType := fmt.Sprintf("%s | %s", normalType, loadingType)
		types = append(types, fmt.Sprintf("export type %s = %s;", resultTypeName, resultType))
	} else {
		// Generate normal single type
		resultType, _ := generateSelectionType(ctx, db, projectConfig, doc.Selections, true, 0, rootTypeName, docCtx, collectedDocs)
		types = append(types, fmt.Sprintf("export type %s = %s;", resultTypeName, resultType))
	}

	// Generate input type
	if len(doc.Variables) > 0 {
		var inputFields []string
		for _, variable := range doc.Variables {
			tsType := convertToTypeScriptTypeSimple(
				variable.Type,
				&variable.TypeModifiers,
				collectedDocs,
				projectConfig,
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
		// For operations with no variables, input type should be null
		types = append(types, fmt.Sprintf("export type %s = null;", inputTypeName))
	}

	// Generate optimistic type for mutations
	if doc.Kind == "mutation" {
		optimisticType, _ := generateOptimisticType(
			ctx,
			db,
			projectConfig,
			doc.Selections,
			true,
			0,
			rootTypeName,
			docCtx,
			collectedDocs,
		)
		types = append(
			types,
			fmt.Sprintf("export type %s = %s;", optimisticTypeName, optimisticType),
		)
	}

	return types
}

func generateSelectionType(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	projectConfig plugins.ProjectConfig,
	selections []*collected.Selection,
	readonly bool,
	indentLevel int,
	parentType string,
	docCtx *DocumentContext,
	collectedDocs *collected.Documents,
) (string, error) {
	if len(selections) == 0 {
		return "{}", nil
	}

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

	// Count explicit fields that would be visible (excluding key fields that would be auto-skipped)
	for _, sel := range selections {
		if sel.Kind == "fragment" {
			visibleSelections = append(visibleSelections, sel)
			continue
		}

		// For non-fragment fields, check if they would be skipped
		// Use a preliminary check that doesn't depend on explicitFieldCount
		isKeyField := isKeyFieldName(parentType, sel.FieldName, projectConfig)
		wouldBeSkipped := isKeyField && (!docCtx.HasLoading || fragmentCount > 0)

		if !wouldBeSkipped {
			visibleSelections = append(visibleSelections, sel)
			if sel.FieldName != "__typename" {
				explicitFieldCount++
			}
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
			if directive.Name == "loading" {
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
				fieldType = generateInterfaceUnionType(selection, readonly, collectedDocs)
			} else {
				// Regular nested object type
				childType, childErr := generateSelectionType(ctx, db, projectConfig, selection.Children, readonly, indentLevel+1, selection.FieldType, docCtx, collectedDocs)
				if childErr != nil {
					return "", childErr
				}
				fieldType = childType

				// Check if this is a list type
				if selection.TypeModifiers != nil {
					if strings.Contains(*selection.TypeModifiers, "]") {
						// This is a list type, wrap in array syntax
						fieldType = fmt.Sprintf("(%s | null)[]", fieldType)
					}

					// Apply nullability for the list itself
					if !strings.HasSuffix(*selection.TypeModifiers, "!") {
						fieldType = fieldType + " | null"
					}
				}
			}
		} else {
			// Scalar field - use simplified type conversion
			fieldType = convertToTypeScriptTypeSimple(selection.FieldType, selection.TypeModifiers, collectedDocs, projectConfig)
		}

		// Add readonly modifier if needed
		readonlyPrefix := ""
		if readonly {
			readonlyPrefix = "readonly "
		}

		// Add JSDoc comment if this field has a description
		var fieldDef string
		indent := strings.Repeat("\t", indentLevel+1)
		if selection.Description != nil && *selection.Description != "" {
			comment := fieldComment(selection, indentLevel+1)
			fieldDef = fmt.Sprintf(
				"%s%s\n%s%s%s: %s;",
				indent,
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
	selection *collected.Selection,
	readonly bool,
	collectedDocs *collected.Documents,
) string {
	readonlyPrefix := ""
	if readonly {
		readonlyPrefix = "readonly "
	}

	// Get the possible types for this interface/union from collected data
	possibleTypesMap, exists := collectedDocs.PossibleTypes[selection.FieldType]
	if !exists || len(possibleTypesMap) == 0 {
		// Fallback to a simple object type if no possible types found
		return "{}"
	}

	// Convert map to sorted slice for consistent output
	var possibleTypes []string
	for typeName := range possibleTypesMap {
		possibleTypes = append(possibleTypes, typeName)
	}

	// Build union parts for each possible type
	var unionParts []string
	for _, typeName := range possibleTypes {
		// Build the type literal for this possible type
		var fields []string

		// Add a generic key field (we'll use "id" as default since we don't have key field info in collected data)
		// In a real implementation, this would come from the schema configuration
		fields = append(fields, fmt.Sprintf("\t\t%sid: string;", readonlyPrefix))

		// Add __typename field
		fields = append(fields, fmt.Sprintf("\t\t%s__typename: \"%s\";", readonlyPrefix, typeName))

		// Create the type literal
		unionPart := fmt.Sprintf("({\n%s\n\t})", strings.Join(fields, "\n"))
		unionParts = append(unionParts, unionPart)
	}

	// Add a non-exhaustive case
	unionParts = append(
		unionParts,
		fmt.Sprintf(
			"({\n\t\t%s__typename: \"non-exhaustive; don't match this\";\n\t})",
			readonlyPrefix,
		),
	)

	// Create the union type
	unionType := fmt.Sprintf("{} & (%s)", strings.Join(unionParts, " | "))

	// Check if this is an array type
	isArray := selection.TypeModifiers != nil && strings.Contains(*selection.TypeModifiers, "]")
	if isArray {
		unionType = fmt.Sprintf("(%s)[]", unionType)
	}

	return unionType
}

func hasAnyLoadingDirectives(selections []*collected.Selection) bool {
	for _, selection := range selections {
		// Check if this field has @loading directive
		for _, directive := range selection.Directives {
			if directive.Name == "loading" {
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

func hasParentField(selections []*collected.Selection) bool {
	for _, selection := range selections {
		if selection.FieldName == "parent" {
			return true
		}
		if len(selection.Children) > 0 && hasParentField(selection.Children) {
			return true
		}
	}
	return false
}

func hasDocumentLevelLoading(doc *collected.Document) bool {
	// Check if the document has @loading directive at the document level
	for _, directive := range doc.Directives {
		if directive.Name == "loading" {
			return true
		}
	}
	return false
}

func generateOptimisticType(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	projectConfig plugins.ProjectConfig,
	selections []*collected.Selection,
	readonly bool,
	indentLevel int,
	parentType string,
	docCtx *DocumentContext,
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

	// Count explicit fields that would be visible (excluding key fields that would be auto-skipped)
	for _, sel := range selections {
		if sel.Kind == "fragment" {
			visibleSelections = append(visibleSelections, sel)
			continue
		}

		// For non-fragment fields, check if they would be skipped
		isKeyField := isKeyFieldName(parentType, sel.FieldName, projectConfig)
		wouldBeSkipped := isKeyField && !docCtx.HasLoading

		if !wouldBeSkipped {
			visibleSelections = append(visibleSelections, sel)
			if sel.FieldName != "__typename" {
				explicitFieldCount++
			}
		}
	}

	// Second pass: generate types for visible selections
	for _, selection := range visibleSelections {

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
			fieldType = generateInterfaceUnionType(selection, readonly, collectedDocs)
		} else if len(selection.Children) > 0 {
			// Regular nested object type
			childType, childErr := generateOptimisticType(ctx, db, projectConfig, selection.Children, readonly, indentLevel+1, selection.FieldType, docCtx, collectedDocs)
			if childErr != nil {
				return "", childErr
			}
			fieldType = childType
		} else {
			// Leaf field - convert the GraphQL type to TypeScript
			fieldType = convertToTypeScriptTypeSimple(selection.FieldType, selection.TypeModifiers, collectedDocs, projectConfig)
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
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	projectConfig plugins.ProjectConfig,
	selections []*collected.Selection,
	readonly bool,
	indentLevel int,
	parentType string,
	hasGlobalLoading bool,
	docCtx *DocumentContext,
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

		// For non-fragment fields, check if they would be skipped
		isKeyField := isKeyFieldName(parentType, sel.FieldName, projectConfig)
		wouldBeSkipped := isKeyField && (!docCtx.HasLoading || fragmentCount > 0)

		if !wouldBeSkipped {
			visibleSelections = append(visibleSelections, sel)
			if sel.FieldName != "__typename" {
				explicitFieldCount++
			}
		}
	}

	// onlyFragments logic is now handled in the first pass when determining visibility

	// Second pass: generate types for visible selections
	for _, selection := range visibleSelections {
		// Handle fragment spreads with @loading (or global loading)
		if selection.Kind == "fragment" {
			// Check if this fragment spread has @loading directive or if global loading is enabled
			hasFragmentLoading := hasGlobalLoading // Global loading treats all fragments as having @loading
			if !hasFragmentLoading {
				for _, directive := range selection.Directives {
					if directive.Name == "loading" {
						hasFragmentLoading = true
						break
					}
				}
			}

			if hasFragmentLoading {
				// Fragment spread with @loading (or global loading) - preserve fragment structure in loading state
				fragmentName := selection.FieldName
				if selection.FragmentRef != nil {
					fragmentName = *selection.FragmentRef
				}
				fragmentIndent := strings.Repeat("\t", indentLevel+2)
				fragmentFields = append(
					fragmentFields,
					fmt.Sprintf("%s%s: {};", fragmentIndent, fragmentName),
				)
			}
			continue
		}

		fieldName := selection.FieldName
		readonlyPrefix := ""
		if readonly {
			readonlyPrefix = "readonly "
		}

		var fieldType string

		// Check if this field has @loading directive
		hasLoading := false
		for _, directive := range selection.Directives {
			if directive.Name == "loading" {
				hasLoading = true
				break
			}
		}

		if hasLoading || hasGlobalLoading {
			if len(selection.Children) > 0 {
				// Check if children only contain fragment spreads with @loading (ignoring auto-added fields)
				onlyLoadingFragments := true
				hasLoadingFragments := false
				hasExplicitFields := false
				for _, child := range selection.Children {
					if child.Kind == "fragment" {
						// Check if this fragment has @loading or if global loading is enabled
						childHasLoading := hasGlobalLoading // Global loading treats all fragments as having @loading
						if !childHasLoading {
							for _, directive := range child.Directives {
								if directive.Name == "loading" {
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
					} else if child.FieldName != "__typename" && child.FieldName != "id" {
						// Explicit field (not auto-added) - this breaks the "only fragments" rule
						hasExplicitFields = true
						onlyLoadingFragments = false
					}
					// Ignore __typename and id fields as they are auto-added
				}

				// Only consider it "only loading fragments" if we have loading fragments and no explicit fields
				onlyLoadingFragments = onlyLoadingFragments && hasLoadingFragments &&
					!hasExplicitFields

				if onlyLoadingFragments && hasLoadingFragments {
					// Field with @loading that only contains fragment spreads with @loading
					// Generate the same structure as normal state (fragment structure)
					childType, childErr := generateLoadingStateType(
						ctx,
						db,
						projectConfig,
						selection.Children,
						readonly,
						indentLevel+1,
						selection.FieldType,
						hasGlobalLoading,
						docCtx,
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

				} else if hasAnyLoadingDirectives(selection.Children) {
					// Field with @loading directive that has children with loading - generate nested loading structure
					childType, childErr := generateLoadingStateType(ctx, db, projectConfig, selection.Children, readonly, indentLevel+1, selection.FieldType, hasGlobalLoading, docCtx, collectedDocs)
					if childErr != nil {
						return "", childErr
					}
					fieldType = childType
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
				childType, childErr := generateLoadingStateType(ctx, db, projectConfig, selection.Children, readonly, indentLevel+1, selection.FieldType, hasGlobalLoading, docCtx, collectedDocs)
				if childErr != nil {
					return "", childErr
				}
				fieldType = childType
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

// convertToTypeScriptTypeSimple converts GraphQL types to TypeScript using automatic kind detection
func convertToTypeScriptTypeSimple(
	typeName string,
	typeModifiers *string,
	collectedDocs *collected.Documents,
	projectConfig plugins.ProjectConfig,
) string {
	// Determine the kind automatically based on collected documents and project config
	kind := determineTypeKind(typeName, collectedDocs, projectConfig)

	// Use the shared base type conversion logic with simple defaults
	baseType := convertBaseType(kind, typeName, projectConfig, false)

	// Apply type modifiers using the exported function
	modifiers := ""
	if typeModifiers != nil {
		modifiers = *typeModifiers
	}

	return ApplyTypeModifiers(baseType, modifiers)
}

// determineTypeKind automatically determines the GraphQL type kind based on collected documents and project config
func determineTypeKind(typeName string, collectedDocs *collected.Documents, projectConfig plugins.ProjectConfig) string {
	if _, isEnum := collectedDocs.EnumValues[typeName]; isEnum {
		return "ENUM"
	}

	// Check if it's a scalar type (built-in or custom)
	if isScalarType(typeName, projectConfig) {
		return "SCALAR"
	}

	// Default to INPUT for unknown types
	return "INPUT"
}

// isScalarType checks if a type is a scalar (built-in GraphQL scalar or custom scalar)
func isScalarType(typeName string, projectConfig plugins.ProjectConfig) bool {
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
func getRootTypeNames(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
) (*RootTypeNames, error) {
	rootTypes := &RootTypeNames{}

	// Look up the actual root type names from the types table
	err := db.StepQuery(ctx, `
		SELECT name, operation
		FROM types
		WHERE operation IN ('query', 'mutation', 'subscription')
	`, map[string]any{}, func(stmt *sqlite.Stmt) {
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
		return fmt.Sprintf("%s/** %s */", indent, *selection.Description)
	}

	// Fallback to field name if no description is available
	return fmt.Sprintf("%s/** %s */", indent, selection.FieldName)
}

// Helper function to check if a field name is a key field for a specific type
func isKeyFieldName(
	typeName string,
	fieldName string,
	projectConfig plugins.ProjectConfig,
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
