package runtime

import (
	"context"
	"encoding/json"
	"fmt"
	"path"
	"slices"
	"sort"
	"strings"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents/typescript"
	"code.houdinigraphql.com/plugins"
	"github.com/spf13/afero"
	"zombiezen.com/go/sqlite"
)

func GenerateImperativeCacheTypeDefs(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	fs afero.Fs,
) ([]string, error) {
	// Get project configuration
	projectConfig, err := db.ProjectConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get project config: %w", err)
	}

	// Target file path
	targetPath := path.Join(projectConfig.ProjectRoot, projectConfig.RuntimeDir, "generated.d.ts")

	// Before we generate the content, let's look at the current content
	existingContent := ""
	if exists, err := afero.Exists(fs, targetPath); err == nil && exists {
		existingContentByte, err := afero.ReadFile(fs, targetPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read existing generated.d.ts: %w", err)
		}
		existingContent = string(existingContentByte)
	}

	// Generate the TypeScript content
	content, err := generateCacheTypeDefContent(ctx, db, projectConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to generate cache type definitions: %w", err)
	}

	// Write the file
	err = afero.WriteFile(fs, targetPath, []byte(content), 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to write generated.d.ts: %w", err)
	}

	// Only return the filepath if the content changed
	if existingContent != content {
		return []string{targetPath}, nil
	}

	return []string{}, nil
}

func generateCacheTypeDefContent(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	projectConfig plugins.ProjectConfig,
) (string, error) {
	var content strings.Builder

	// Generate imports
	imports, err := generateImports(ctx, db, projectConfig)
	if err != nil {
		return "", err
	}
	content.WriteString(imports)

	// Generate the main CacheTypeDef type
	cacheTypeDef, err := generateCacheTypeDef(ctx, db, projectConfig)
	if err != nil {
		return "", err
	}
	content.WriteString(cacheTypeDef)

	return content.String(), nil
}

func generateImports(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	projectConfig plugins.ProjectConfig,
) (string, error) {
	var imports strings.Builder

	// Base import for Record type
	imports.WriteString(`import type { Record } from "./public/record";` + "\n")

	// Collect all documents with their argument info in a single query
	documentsWithArgs, err := getDocumentsWithArguments(ctx, db)
	if err != nil {
		return "", err
	}

	// Sort documents for consistent output - queries first, then fragments
	var sortedDocs []DocumentWithArgs
	for _, doc := range documentsWithArgs {
		sortedDocs = append(sortedDocs, doc)
	}

	sort.Slice(sortedDocs, func(i, j int) bool {
		if sortedDocs[i].Kind != sortedDocs[j].Kind {
			// Queries come before fragments
			if sortedDocs[i].Kind == "query" {
				return true
			}
			if sortedDocs[j].Kind == "query" {
				return false
			}
		}
		return sortedDocs[i].Name < sortedDocs[j].Name
	})

	// Generate imports for queries first
	for _, doc := range sortedDocs {
		if doc.Kind == "query" {
			imports.WriteString(fmt.Sprintf(
				`import { %s$result, %s$input } from "../artifacts/%s";`+"\n",
				doc.Name, doc.Name, doc.Name,
			))
		}
	}

	// Add utility imports
	imports.WriteString(`import type { ValueOf } from "$houdini/runtime/lib/types";` + "\n")

	// Add enum imports - only user-defined enums, not internal ones
	enumNames, err := getEnumNames(ctx, db)
	if err != nil {
		return "", err
	}
	for _, enumName := range enumNames {
		imports.WriteString(fmt.Sprintf(
			`import type { %s } from "$houdini/graphql/enums";`+"\n",
			enumName,
		))
	}

	// Generate imports for fragments
	for _, doc := range sortedDocs {
		if doc.Kind == "fragment" {
			// Use pre-loaded argument info
			if doc.HasArguments {
				imports.WriteString(fmt.Sprintf(
					`import { %s$input } from "../artifacts/%s";`+"\n",
					doc.Name, doc.Name,
				))
			}
			imports.WriteString(fmt.Sprintf(
				`import { %s$data } from "../artifacts/%s";`+"\n",
				doc.Name, doc.Name,
			))
		}
	}

	imports.WriteString("\n")
	return imports.String(), nil
}

type Document struct {
	Name          string
	Kind          string
	TypeCondition *string
}

type DocumentWithArgs struct {
	Name          string
	Kind          string
	TypeCondition *string
	HasArguments  bool
}

func getDocumentsWithArguments(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
) (map[string]DocumentWithArgs, error) {
	documentsWithArgs := make(map[string]DocumentWithArgs)

	err := db.StepQuery(ctx, `
		SELECT d.name, d.kind, d.type_condition,
		       CASE WHEN dd.directive IS NOT NULL THEN 1 ELSE 0 END as has_arguments
		FROM documents d
		LEFT JOIN document_directives dd ON d.id = dd.document AND dd.directive = 'arguments'
		ORDER BY d.name
	`, nil, func(stmt *sqlite.Stmt) {
		doc := DocumentWithArgs{
			Name:         stmt.ColumnText(0),
			Kind:         stmt.ColumnText(1),
			HasArguments: stmt.ColumnInt(3) == 1,
		}
		if stmt.ColumnType(2) == sqlite.TypeText {
			tc := stmt.ColumnText(2)
			doc.TypeCondition = &tc
		}
		documentsWithArgs[doc.Name] = doc
	})

	return documentsWithArgs, err
}

func getEnumNames(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
) ([]string, error) {
	var enumNames []string

	err := db.StepQuery(ctx, `
		SELECT name
		FROM types
		WHERE kind = 'ENUM' AND built_in = 0 AND internal = 0
		ORDER BY name
	`, nil, func(stmt *sqlite.Stmt) {
		enumNames = append(enumNames, stmt.ColumnText(0))
	})

	return enumNames, err
}

type TypeInfo struct {
	Name string
	Kind string
}

func getTypeInfo(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	typeName string,
) (*TypeInfo, error) {
	var typeInfo *TypeInfo

	err := db.StepQuery(ctx, `
		SELECT name, kind
		FROM types
		WHERE name = $typeName
	`, map[string]any{"typeName": typeName}, func(stmt *sqlite.Stmt) {
		typeInfo = &TypeInfo{
			Name: stmt.ColumnText(0),
			Kind: stmt.ColumnText(1),
		}
	})

	if typeInfo == nil {
		return nil, fmt.Errorf("type not found: %s", typeName)
	}

	return typeInfo, err
}

func generateCacheTypeDef(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	projectConfig plugins.ProjectConfig,
) (string, error) {
	var content strings.Builder

	content.WriteString("export declare type CacheTypeDef = {\n")

	// Generate types section
	typesSection, err := generateTypesSection(ctx, db, projectConfig)
	if err != nil {
		return "", err
	}
	content.WriteString("\t\ttypes: {\n")
	content.WriteString(typesSection)
	content.WriteString("\t\t};\n")

	// Generate lists section
	listsSection, err := generateListsSection(ctx, db)
	if err != nil {
		return "", err
	}
	content.WriteString("\t\tlists: {\n")
	content.WriteString(listsSection)
	content.WriteString("\t\t};\n")

	// Generate queries section
	queriesSection, err := generateQueriesSection(ctx, db)
	if err != nil {
		return "", err
	}
	content.WriteString("\t\tqueries: ")
	content.WriteString(queriesSection)
	content.WriteString(";\n")

	content.WriteString("};\n")

	return content.String(), nil
}

func generateTypesSection(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	projectConfig plugins.ProjectConfig,
) (string, error) {
	var content strings.Builder

	// Get all concrete types with their fields in a single query
	typesWithFields, err := getConcreteTypesWithFields(ctx, db)
	if err != nil {
		return "", err
	}

	// Get fragments grouped by type
	fragmentsByType, err := getFragmentsByType(ctx, db)
	if err != nil {
		return "", err
	}

	// Sort types to ensure __ROOT__ comes first, then alphabetical
	var sortedTypes []ConcreteTypeWithFields
	for _, typeInfo := range typesWithFields {
		sortedTypes = append(sortedTypes, typeInfo)
	}

	sort.Slice(sortedTypes, func(i, j int) bool {
		iIsQuery := sortedTypes[i].Operation != nil && *sortedTypes[i].Operation == "query"
		jIsQuery := sortedTypes[j].Operation != nil && *sortedTypes[j].Operation == "query"

		if iIsQuery && !jIsQuery {
			return true
		}
		if !iIsQuery && jIsQuery {
			return false
		}
		return sortedTypes[i].Name < sortedTypes[j].Name
	})

	for _, typeInfo := range sortedTypes {
		typeName := typeInfo.Name

		// Use __ROOT__ for Query type
		if typeInfo.Operation != nil && *typeInfo.Operation == "query" {
			typeName = "__ROOT__"
		}

		content.WriteString(fmt.Sprintf("\t\t\t%s: {\n", typeName))

		// Generate idFields
		idFields, err := generateIdFields(ctx, db, typeInfo.Name, projectConfig)
		if err != nil {
			return "", err
		}
		content.WriteString(fmt.Sprintf("\t\t\t\tidFields: %s;\n", idFields))

		// Generate fields
		fields, err := generateTypeFieldsFromData(ctx, projectConfig, db, typeInfo.Fields)
		if err != nil {
			return "", err
		}
		content.WriteString("\t\t\t\tfields: {\n")
		content.WriteString(fields)
		content.WriteString("\t\t\t\t};\n")

		// Generate fragments
		fragments := "[]"
		if typeFragments, exists := fragmentsByType[typeInfo.Name]; exists {
			fragments = fmt.Sprintf("[%s]", strings.Join(typeFragments, ", "))
		}
		content.WriteString(fmt.Sprintf("\t\t\t\tfragments: %s;\n", fragments))

		content.WriteString("\t\t\t};\n")
	}

	return content.String(), nil
}

type ConcreteType struct {
	Name      string
	Kind      string
	Operation *string
}

type ConcreteTypeWithFields struct {
	Name      string
	Kind      string
	Operation *string
	Fields    []TypeField
}

func getConcreteTypesWithFields(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
) (map[string]ConcreteTypeWithFields, error) {
	typesWithFields := make(map[string]ConcreteTypeWithFields)

	err := db.StepQuery(ctx, `
		SELECT t.name as type_name, t.kind, t.operation,
		       f.id as field_id, f.name as field_name, f.type, f.type_modifiers
		FROM types t
		LEFT JOIN type_fields f ON t.name = f.parent AND f.internal = 0
		WHERE t.kind = 'OBJECT' AND t.built_in = 0 AND t.internal = 0
		ORDER BY t.name, f.name
	`, nil, func(stmt *sqlite.Stmt) {
		typeName := stmt.ColumnText(0)

		// Get or create the type entry
		typeInfo, exists := typesWithFields[typeName]
		if !exists {
			typeInfo = ConcreteTypeWithFields{
				Name:   typeName,
				Kind:   stmt.ColumnText(1),
				Fields: []TypeField{},
			}
			if stmt.ColumnType(2) == sqlite.TypeText {
				op := stmt.ColumnText(2)
				typeInfo.Operation = &op
			}
		}

		// If this row has field data (not NULL), add the field
		if stmt.ColumnType(3) != sqlite.TypeNull {
			field := TypeField{
				ID:   stmt.ColumnText(3),
				Name: stmt.ColumnText(4),
				Type: stmt.ColumnText(5),
			}
			if stmt.ColumnType(6) == sqlite.TypeText {
				field.TypeModifiers = stmt.ColumnText(6)
			}
			typeInfo.Fields = append(typeInfo.Fields, field)
		}

		typesWithFields[typeName] = typeInfo
	})

	return typesWithFields, err
}

func generateIdFields(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	typeName string,
	projectConfig plugins.ProjectConfig,
) (string, error) {
	// For __ROOT__ (Query type), return empty object
	if typeName == "Query" {
		return "{}", nil
	}

	// Get key fields for this type
	keyFields, err := getKeyFields(ctx, db, typeName, projectConfig)
	if err != nil {
		return "", err
	}

	if len(keyFields) == 0 {
		return "never", nil
	}

	var fields []string
	for _, field := range keyFields {
		tsType, err := typescript.ConvertToTypeScriptType(
			ctx,
			db,
			projectConfig,
			"",
			field.Type,
			field.TypeModifiers,
			false, // isInput = false for cache key fields
		)
		if err != nil {
			return "", err
		}
		// Remove nullability for ID fields
		tsType = strings.ReplaceAll(tsType, " | null | undefined", "")
		fields = append(fields, fmt.Sprintf("\n\t\t\t\t\t%s: %s;", field.Name, tsType))
	}

	return fmt.Sprintf("{%s\n\t\t\t\t}", strings.Join(fields, "")), nil
}

func getKeyFields(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	typeName string,
	projectConfig plugins.ProjectConfig,
) ([]InputField, error) {
	var keyFields []InputField

	// First try to get type-specific keys
	var keys []string
	err := db.StepQuery(ctx, `
		SELECT keys
		FROM type_configs
		WHERE name = $typeName
	`, map[string]any{"typeName": typeName}, func(stmt *sqlite.Stmt) {
		keysJSON := stmt.ColumnText(0)
		json.Unmarshal([]byte(keysJSON), &keys)
	})
	if err != nil {
		return nil, err
	}

	// If no type-specific keys, use default keys
	if len(keys) == 0 {
		keys = projectConfig.DefaultKeys
	}

	// Get field information for each key
	for _, key := range keys {
		err := db.StepQuery(ctx, `
			SELECT name, type, type_modifiers
			FROM type_fields
			WHERE parent = $typeName AND name = $key
		`, map[string]any{"typeName": typeName, "key": key}, func(stmt *sqlite.Stmt) {
			field := InputField{
				Name: stmt.ColumnText(0),
				Type: stmt.ColumnText(1),
			}
			if stmt.ColumnType(2) == sqlite.TypeText {
				field.TypeModifiers = stmt.ColumnText(2)
			}
			keyFields = append(keyFields, field)
		})
		if err != nil {
			return nil, err
		}
	}

	return keyFields, nil
}

func generateTypeFieldsFromData(
	ctx context.Context,
	projectConfig plugins.ProjectConfig,
	db plugins.DatabasePool[config.PluginConfig],
	fields []TypeField,
) (string, error) {
	var content strings.Builder

	for _, field := range fields {
		// Generate field type
		fieldType, err := generateFieldType(ctx, projectConfig, db, field)
		if err != nil {
			return "", err
		}

		// Generate field arguments
		fieldArgs, err := generateFieldArguments(ctx, db, projectConfig, field.ID)
		if err != nil {
			return "", err
		}

		content.WriteString(fmt.Sprintf("\t\t\t\t\t%s: {\n", field.Name))
		content.WriteString(fmt.Sprintf("\t\t\t\t\t\ttype: %s;\n", fieldType))
		content.WriteString(fmt.Sprintf("\t\t\t\t\t\targs: %s;\n", fieldArgs))
		content.WriteString("\t\t\t\t\t};\n")
	}

	return content.String(), nil
}

type TypeField struct {
	ID            string
	Name          string
	Type          string
	TypeModifiers string
}

func generateFieldType(
	ctx context.Context,
	config plugins.ProjectConfig,
	db plugins.DatabasePool[config.PluginConfig],
	field TypeField,
) (string, error) {
	// Get the base type information
	typeInfo, err := getTypeInfo(ctx, db, field.Type)
	if err != nil {
		return "", err
	}

	var baseType string
	switch typeInfo.Kind {
	case "SCALAR":
		baseType = typescript.ConvertScalarType(
			config,
			field.Type,
			false,
		) // isInput = false for cache field types
	case "ENUM":
		baseType = field.Type
	case "OBJECT":
		baseType = fmt.Sprintf("Record<CacheTypeDef, \"%s\">", field.Type)
	case "INTERFACE", "UNION":
		// Get possible types for abstract types
		possibleTypes, err := getPossibleTypes(ctx, db, field.Type)
		if err != nil {
			return "", err
		}
		var recordTypes []string
		for _, possibleType := range possibleTypes {
			recordTypes = append(
				recordTypes,
				fmt.Sprintf("Record<CacheTypeDef, \"%s\">", possibleType),
			)
		}
		baseType = strings.Join(recordTypes, " | ")
	default:
		baseType = "any"
	}

	// Apply type modifiers
	return typescript.ApplyTypeModifiers(baseType, field.TypeModifiers, false), nil // Output type (cache field)
}

func getPossibleTypes(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	typeName string,
) ([]string, error) {
	var possibleTypes []string

	err := db.StepQuery(ctx, `
		SELECT member
		FROM possible_types
		WHERE type = $typeName
		ORDER BY member
	`, map[string]any{"typeName": typeName}, func(stmt *sqlite.Stmt) {
		possibleTypes = append(possibleTypes, stmt.ColumnText(0))
	})

	return possibleTypes, err
}

func generateFieldArguments(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	projectConfig plugins.ProjectConfig,
	fieldID string,
) (string, error) {
	// Get arguments for this field
	args, err := getFieldArguments(ctx, db, fieldID)
	if err != nil {
		return "", err
	}

	if len(args) == 0 {
		return "never", nil
	}

	var argStrings []string
	for _, arg := range args {
		tsType, err := typescript.ConvertToTypeScriptType(
			ctx,
			db,
			projectConfig,
			"",
			arg.Type,
			arg.TypeModifiers,
			true, // isInput = true for field arguments (these are inputs to GraphQL operations)
		)
		if err != nil {
			return "", err
		}

		optional := ""
		if typescript.IsOptionalField(arg.TypeModifiers) {
			optional = "?"
		}

		argStrings = append(
			argStrings,
			fmt.Sprintf("\n\t\t\t\t\t\t\t%s%s: %s;", arg.Name, optional, tsType),
		)
	}

	return fmt.Sprintf("{%s\n\t\t\t\t\t\t}", strings.Join(argStrings, "")), nil
}

type FieldArgument struct {
	Name          string
	Type          string
	TypeModifiers string
}

func getFieldArguments(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	fieldID string,
) ([]FieldArgument, error) {
	var args []FieldArgument

	err := db.StepQuery(ctx, `
		SELECT name, type, type_modifiers
		FROM type_field_arguments
		WHERE field = $fieldID
		ORDER BY name
	`, map[string]any{"fieldID": fieldID}, func(stmt *sqlite.Stmt) {
		arg := FieldArgument{
			Name: stmt.ColumnText(0),
			Type: stmt.ColumnText(1),
		}
		if stmt.ColumnType(2) == sqlite.TypeText {
			arg.TypeModifiers = stmt.ColumnText(2)
		}
		args = append(args, arg)
	})

	return args, err
}

func getFragmentsByType(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
) (map[string][]string, error) {
	fragmentsByType := make(map[string][]string)

	err := db.StepQuery(ctx, `
		SELECT d.type_condition, d.name,
		       CASE WHEN dd.directive IS NOT NULL THEN 1 ELSE 0 END as has_arguments
		FROM documents d
		LEFT JOIN document_directives dd ON d.id = dd.document AND dd.directive = 'arguments'
		WHERE d.kind = 'fragment' AND d.type_condition IS NOT NULL
		ORDER BY d.type_condition, d.name
	`, nil, func(stmt *sqlite.Stmt) {
		typeName := stmt.ColumnText(0)
		fragmentName := stmt.ColumnText(1)
		hasArgs := stmt.ColumnInt(2) == 1

		var fragmentTuple string
		if hasArgs {
			fragmentTuple = fmt.Sprintf("[any, %s$data, %s$input]", fragmentName, fragmentName)
		} else {
			fragmentTuple = fmt.Sprintf("[any, %s$data, never]", fragmentName)
		}

		fragmentsByType[typeName] = append(fragmentsByType[typeName], fragmentTuple)
	})

	return fragmentsByType, err
}

func generateListsSection(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
) (string, error) {
	var content strings.Builder

	// Get all discovered lists with their field arguments in a single query
	listsWithFilters, err := getDiscoveredListsWithFilters(ctx, db)
	if err != nil {
		return "", err
	}

	// Sort lists by name for consistent output
	var listNames []string
	for name := range listsWithFilters {
		listNames = append(listNames, name)
	}
	sort.Strings(listNames)

	for _, listName := range listNames {
		list := listsWithFilters[listName]
		content.WriteString(fmt.Sprintf("\t\t\t%s: {\n", listName))

		// Generate types
		if len(list.PossibleTypes) == 1 {
			content.WriteString(fmt.Sprintf("\t\t\t\ttypes: \"%s\";\n", list.PossibleTypes[0]))
		} else {
			typeStrings := make([]string, len(list.PossibleTypes))
			for i, t := range list.PossibleTypes {
				typeStrings[i] = fmt.Sprintf("\"%s\"", t)
			}
			content.WriteString(fmt.Sprintf("\t\t\t\ttypes: %s;\n", strings.Join(typeStrings, " | ")))
		}

		// Generate filters from pre-loaded data
		filters := generateListFiltersFromData(list.FilterArgs)
		content.WriteString(fmt.Sprintf("\t\t\t\tfilters: %s;\n", filters))

		content.WriteString("\t\t\t};\n")
	}

	return content.String(), nil
}

type DiscoveredList struct {
	Name          string
	FieldID       string
	PossibleTypes []string
}

type DiscoveredListWithFilters struct {
	Name          string
	PossibleTypes []string
	FilterArgs    []FieldArgument
}

func getDiscoveredListsWithFilters(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
) (map[string]DiscoveredListWithFilters, error) {
	listsWithFilters := make(map[string]DiscoveredListWithFilters)

	// First get the basic list info with possible types
	err := db.StepQuery(ctx, `
		SELECT DISTINCT dl.name, dl.list_field, dl.target_type,
		       COALESCE(pt.member, dl.target_type) as possible_type
		FROM discovered_lists dl
		LEFT JOIN possible_types pt ON dl.target_type = pt.type
		WHERE dl.name IS NOT NULL
		ORDER BY dl.name, possible_type
	`, nil, func(stmt *sqlite.Stmt) {
		listName := stmt.ColumnText(0)
		possibleType := stmt.ColumnText(3)

		list, exists := listsWithFilters[listName]
		if !exists {
			list = DiscoveredListWithFilters{
				Name:          listName,
				PossibleTypes: []string{},
				FilterArgs:    []FieldArgument{},
			}
		}

		// Add possible type if not already present
		if !slices.Contains(list.PossibleTypes, possibleType) {
			list.PossibleTypes = append(list.PossibleTypes, possibleType)
		}

		listsWithFilters[listName] = list
	})
	if err != nil {
		return nil, err
	}

	// Now get the field arguments for each list
	err = db.StepQuery(ctx, `
		SELECT DISTINCT dl.name, tfa.name as arg_name, tfa.type, tfa.type_modifiers
		FROM discovered_lists dl
		JOIN type_field_arguments tfa ON dl.list_field = tfa.field
		WHERE dl.name IS NOT NULL
		ORDER BY dl.name, tfa.name
	`, nil, func(stmt *sqlite.Stmt) {
		listName := stmt.ColumnText(0)

		if list, exists := listsWithFilters[listName]; exists {
			arg := FieldArgument{
				Name: stmt.ColumnText(1),
				Type: stmt.ColumnText(2),
			}
			if stmt.ColumnType(3) == sqlite.TypeText {
				arg.TypeModifiers = stmt.ColumnText(3)
			}
			list.FilterArgs = append(list.FilterArgs, arg)
			listsWithFilters[listName] = list
		}
	})

	return listsWithFilters, err
}

func generateListFiltersFromData(args []FieldArgument) string {
	if len(args) == 0 {
		return "never"
	}

	var argStrings []string
	for _, arg := range args {
		// Convert to TypeScript type using the exported function
		baseType := typescript.ConvertScalarType(plugins.ProjectConfig{}, arg.Type, false)
		tsType := typescript.ApplyTypeModifiers(baseType, arg.TypeModifiers, true) // Input type (filter argument)

		// All filter arguments are optional
		argStrings = append(argStrings, fmt.Sprintf("\n\t\t\t\t\t%s?: %s;", arg.Name, tsType))
	}

	return fmt.Sprintf("{%s\n\t\t\t\t}", strings.Join(argStrings, ""))
}

func generateQueriesSection(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
) (string, error) {
	// Get all documents with arguments info (reuse the optimized query)
	documentsWithArgs, err := getDocumentsWithArguments(ctx, db)
	if err != nil {
		return "", err
	}

	var queryTuples []string
	var queryNames []string
	// Collect query names for sorting
	for name, doc := range documentsWithArgs {
		if doc.Kind == "query" {
			queryNames = append(queryNames, name)
		}
	}

	// Sort for consistent output
	sort.Strings(queryNames)

	// Generate tuples
	for _, name := range queryNames {
		queryTuples = append(queryTuples, fmt.Sprintf("[any, %s$result, %s$input]", name, name))
	}

	if len(queryTuples) == 0 {
		return "[]", nil
	}

	return fmt.Sprintf("[%s]", strings.Join(queryTuples, ", ")), nil
}

type InputType struct {
	Name string
}

type InputField struct {
	Name          string
	Type          string
	TypeModifiers string
}
