package schema

import (
	"context"
	"fmt"
	"path/filepath"
	"sort"
	"strings"

	"github.com/spf13/afero"
	"golang.org/x/sync/errgroup"
	"zombiezen.com/go/sqlite"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins"
)

func GenerateDefinitionFiles(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	fs afero.Fs,
	sortKeys bool,
) error {
	projectConfig, err := db.ProjectConfig(ctx)
	if err != nil {
		return fmt.Errorf("failed to get project config: %w", err)
	}

	group, ctx := errgroup.WithContext(ctx)

	group.Go(func() error {
		return generateSchemaFile(ctx, db, fs, projectConfig)
	})

	group.Go(func() error {
		return generateDocumentsFile(ctx, db, fs, projectConfig)
	})

	group.Go(func() error {
		return generateEnumFiles(ctx, db, fs, projectConfig)
	})

	group.Go(func() error {
		return generateInputTypeDefinitions(ctx, db, fs)
	})

	return group.Wait()
}

func generateSchemaFile(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	fs afero.Fs,
	projectConfig plugins.ProjectConfig,
) error {
	type argument struct {
		Name          string
		Type          string
		TypeModifiers string
		DefaultValue  string
	}

	type directive struct {
		Name        string
		Internal    bool
		Repeatable  bool
		Description string
		Arguments   []*argument
		Locations   []string
	}

	type enumValue struct {
		Value       string
		Description string
	}

	directives := make(map[string]*directive)
	errs := &plugins.ErrorList{}
	customTypes := make(map[string]bool)

	var schemaString strings.Builder
	// get all internal directives in the order they were discovered
	err := db.StepQuery(ctx, `
		SELECT name, internal, repeatable, description
		FROM directives
		WHERE internal = 1
		ORDER BY rowid
	`, nil, func(stmt *sqlite.Stmt) {
		name := stmt.ColumnText(0)
		internal := stmt.ColumnInt(1) == 1
		repeatable := stmt.ColumnInt(2) == 1
		description := stmt.ColumnText(3)

		// create directive struct to collect data
		directive := &directive{
			Name:        name,
			Internal:    internal,
			Repeatable:  repeatable,
			Description: description,
			Arguments:   []*argument{},
			Locations:   []string{},
		}
		directives[name] = directive
		// collect arguments first
		argErr := db.StepQuery(ctx, `
				SELECT name, type, type_modifiers, default_value
				FROM directive_arguments
				WHERE parent = $directive
				ORDER BY name
			`, map[string]any{"directive": name}, func(stmt *sqlite.Stmt) {
			arg := &argument{
				Name:          stmt.ColumnText(0),
				Type:          stmt.ColumnText(1),
				TypeModifiers: stmt.ColumnText(2),
				DefaultValue:  stmt.ColumnText(3),
			}
			directive.Arguments = append(directive.Arguments, arg)

			// collect custom types (skip built-in GraphQL scalars)
			if !isBuiltInScalar(arg.Type) {
				customTypes[arg.Type] = true
			}
		})
		if argErr != nil {
			errs.Append(plugins.WrapError(argErr))
			return
		}

		// collect locations
		locErr := db.StepQuery(ctx, `
				SELECT location
				FROM directive_locations
				WHERE directive = $directive
				ORDER BY location
			`, map[string]any{"directive": name}, func(stmt *sqlite.Stmt) {
			location := stmt.ColumnText(0)
			directive.Locations = append(directive.Locations, location)
		})
		if locErr != nil {
			errs.Append(plugins.WrapError(locErr))
			return
		}

		if description != "" && description != "null" {
			// writing the desc as a comment
			schemaString.WriteString(fmt.Sprintf("\"\"\"%s\"\"\"\n", description))
		}

		schemaString.WriteString(fmt.Sprintf("directive @%s", name))

		// arguments in parentheses
		if len(directive.Arguments) > 0 {
			schemaString.WriteString("(")
			for i, arg := range directive.Arguments {
				if i > 0 {
					schemaString.WriteString(", ")
				}
				schemaString.WriteString(
					fmt.Sprintf("%s: %s%s", arg.Name, arg.Type, arg.TypeModifiers),
				)
			}
			schemaString.WriteString(")")
		}

		// add repeatable keyword
		if repeatable {
			schemaString.WriteString(" repeatable")
		}

		// add locations
		if len(directive.Locations) > 0 {
			schemaString.WriteString(" on ")
			schemaString.WriteString(strings.Join(directive.Locations, " | "))
		}

		schemaString.WriteString("\n\n")
	})
	if err != nil {
		return plugins.WrapError(err)
	}

	if errs.Error() != "" {
		return errs
	}

	// writing enum definitions for custom types referenced by directive arguments at the end of the file
	// writing at the end of the file(schema.graphql) cost us one more loop but it is cleaner
	// collect enum names
	enumNames := make([]string, 0, len(customTypes))
	for typeName := range customTypes {
		enumNames = append(enumNames, typeName)
	}
	// sort enum names for deterministic output
	sort.Strings(enumNames)
	for _, typeName := range enumNames {

		enumValues := []enumValue{}

		// query enum values for this type
		enumErr := db.StepQuery(ctx, `
			SELECT value, description
			FROM enum_values
			WHERE parent = $typeName
			ORDER BY value
		`, map[string]any{"typeName": typeName}, func(stmt *sqlite.Stmt) {
			value := stmt.ColumnText(0)
			description := stmt.ColumnText(1)
			enumValues = append(enumValues, enumValue{Value: value, Description: description})
		})

		if enumErr != nil {
			errs.Append(plugins.WrapError(enumErr))
			continue
		}

		// description goes first as comment
		// if we found enum values, write the enum definition
		if len(enumValues) > 0 {
			schemaString.WriteString(fmt.Sprintf("enum %s {\n", typeName))
			for _, ev := range enumValues {
				if ev.Description != "" {
					schemaString.WriteString(fmt.Sprintf("  \"\"\"%s\"\"\"\n", ev.Description))
				}
				schemaString.WriteString(fmt.Sprintf("  %s\n", ev.Value))
			}
			schemaString.WriteString("}\n\n")
		}

	}

	schemaFileLocation := projectConfig.DefinitionsSchemaPath()

	dir := filepath.Dir(schemaFileLocation)
	err = fs.MkdirAll(dir, 0o755)
	if err != nil {
		return plugins.WrapError(err)
	}

	err = afero.WriteFile(fs, schemaFileLocation, []byte(schemaString.String()), 0o644)
	if err != nil {
		return plugins.WrapError(err)
	}
	return nil
}

func generateDocumentsFile(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	fs afero.Fs,
	projectConfig plugins.ProjectConfig,
) error {
	// get all documents from docuemnt table joined with discovered list and that are fragments
	var documentString strings.Builder

	err := db.StepQuery(ctx, `
		SELECT DISTINCT d.printed
		FROM documents d
		WHERE d.kind = 'fragment'
		  AND d.internal = true
		  AND d.visible = false
		  AND EXISTS (
		    SELECT 1 FROM discovered_lists dl
		    WHERE d.name = dl.name || '_insert'
		       OR d.name = dl.name || '_toggle'
		       OR d.name = dl.name || '_remove'
		  )
		ORDER BY d.name
	`, nil, func(stmt *sqlite.Stmt) {
		printed := stmt.ColumnText(0)
		// remove __typename from the printed document, maybe there is a better way to do this
		cleanedPrinted := removeTypename(printed)
		documentString.WriteString(cleanedPrinted)
		documentString.WriteString("\n\n")
	})
	if err != nil {
		return plugins.WrapError(err)
	}

	documentsFileLocation := projectConfig.DefinitionsDocumentsPath()

	dir := filepath.Dir(documentsFileLocation)
	err = fs.MkdirAll(dir, 0o755)
	if err != nil {
		return plugins.WrapError(err)
	}

	err = afero.WriteFile(fs, documentsFileLocation, []byte(documentString.String()), 0o644)
	if err != nil {
		return plugins.WrapError(err)
	}
	return nil
}

func generateEnumFiles(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	fs afero.Fs,
	projectConfig plugins.ProjectConfig,
) error {
	type enumValue struct {
		Value       string
		Description string
	}

	type enumData struct {
		Name        string
		Description string
		Values      []enumValue
	}

	// collect all enum data from database
	enums := []enumData{}
	errs := &plugins.ErrorList{}

	// all enum except internal + built_in types and their values
	err := db.StepQuery(ctx, `
		SELECT t.name, t.description
		FROM types t
		WHERE t.kind == 'ENUM' AND t.internal == 0 AND t.built_in == 0
		ORDER BY t.name

	`, nil, func(stmt *sqlite.Stmt) {
		enumName := stmt.ColumnText(0)
		enumDescription := stmt.ColumnText(1)
		enum := enumData{
			Name:        enumName,
			Description: enumDescription,
			Values:      []enumValue{},
		}

		// all values for this enum
		valueErr := db.StepQuery(ctx, `
			SELECT value, description
			FROM enum_values
			WHERE parent = $enumName
			ORDER BY value
		`, map[string]any{"enumName": enumName}, func(valueStmt *sqlite.Stmt) {
			value := valueStmt.ColumnText(0)
			description := valueStmt.ColumnText(1)
			enum.Values = append(enum.Values, enumValue{Value: value, Description: description})
		})

		if valueErr != nil {
			errs.Append(plugins.WrapError(valueErr))
			return
		}

		enums = append(enums, enum)
	})
	if err != nil {
		return plugins.WrapError(err)
	}

	if errs.Error() != "" {
		return errs
	}

	var enumString strings.Builder
	// start off with the values of helper type
	enumString.WriteString("type ValuesOf<T> = T[keyof T]\n\n")

	for _, enum := range enums {
		// js enum definition generation
		if enum.Description != "" {
			enumString.WriteString(fmt.Sprintf("/** %s */\n", enum.Description))
		}
		enumString.WriteString(fmt.Sprintf("export const %s = {\n", enum.Name))
		for i, value := range enum.Values {
			if i > 0 {
				enumString.WriteString(",\n")
			}
			if value.Description != "" {
				// handle multi-line descriptions (e.g., with @deprecated)
				lines := strings.Split(value.Description, "\n")
				enumString.WriteString("    /**\n")
				for _, line := range lines {
					enumString.WriteString(fmt.Sprintf("     * %s\n", line))
				}
				enumString.WriteString("    */\n")
			}
			enumString.WriteString(fmt.Sprintf("    \"%s\": \"%s\"", value.Value, value.Value))
		}
		enumString.WriteString("\n} as const;\n\n")
		fmt.Fprintf(&enumString,
			"export type %s$options = ValuesOf<typeof %s>\n\n",
			enum.Name,
			enum.Name,
		)
	}

	// writing enums.js
	enumsFileLocation := projectConfig.DefinitionsEnumRuntime()
	dir := filepath.Dir(enumsFileLocation)

	err = fs.MkdirAll(dir, 0o755)
	if err != nil {
		return plugins.WrapError(err)
	}

	err = afero.WriteFile(fs, enumsFileLocation, []byte(enumString.String()), 0o644)
	if err != nil {
		return plugins.WrapError(err)
	}
	// generate index.js file
	indexJsContent := "\nexport * from './enums.js'\n\n"
	indexJsLocation := projectConfig.DefinitionsIndexJs()

	err = afero.WriteFile(fs, indexJsLocation, []byte(indexJsContent), 0o644)
	if err != nil {
		return plugins.WrapError(err)
	}

	return nil
}

// helper
func isBuiltInScalar(typeName string) bool {
	builtInScalars := map[string]bool{
		"String":  true,
		"Boolean": true,
		"Int":     true,
		"Float":   true,
		"ID":      true,
	}
	return builtInScalars[typeName]
}

func removeTypename(document string) string {
	lines := strings.Split(document, "\n")
	var result []string

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed != "__typename" {
			result = append(result, line)
		}
	}

	return strings.Join(result, "\n")
}
