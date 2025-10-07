package schema

import (
	"context"
	"fmt"
	"path"
	"sort"
	"strings"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents/typescript"
	"code.houdinigraphql.com/plugins"
	"github.com/spf13/afero"
	"zombiezen.com/go/sqlite"
)

func generateInputTypeDefinitions(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	fs afero.Fs,
) error {
	// grab the project config
	config, err := db.ProjectConfig(ctx)
	if err != nil {
		return err
	}

	tab := strings.Repeat(" ", 4)

	// we are going to generate type definitions for all of the input types in the schema
	var content strings.Builder
	// start off with the value of type
	content.WriteString("type ValuesOf<T> = T[keyof T];\n\n")

	// build up a map of input types to their fields
	inputTypesWithFields := make(map[string][]InputField)

	err = db.StepQuery(ctx, `
		SELECT t.name as type_name, f.name as field_name, f.type, f.type_modifiers, ft.kind
		FROM types t
		LEFT JOIN type_fields f ON t.name = f.parent AND f.internal = 0
		LEFT JOIN types ft on f.type = ft.name
		WHERE t.kind = 'INPUT' AND t.built_in = 0 AND t.internal = 0
		ORDER BY t.name, f.name
	`, nil, func(stmt *sqlite.Stmt) {
		typeName := stmt.ColumnText(0)

		// If this is just a type without fields (NULL field_name), create empty entry
		if stmt.ColumnType(1) == sqlite.TypeNull {
			if _, exists := inputTypesWithFields[typeName]; !exists {
				inputTypesWithFields[typeName] = []InputField{}
			}
			return
		}

		field := InputField{
			Name: stmt.ColumnText(1),
			Type: stmt.ColumnText(2),
			Kind: stmt.GetText("kind"),
		}
		if stmt.ColumnType(3) == sqlite.TypeText {
			field.TypeModifiers = stmt.ColumnText(3)
		}

		inputTypesWithFields[typeName] = append(inputTypesWithFields[typeName], field)
	})

	// Group fields by type name - convert to slice to get index and sort for deterministic output
	typeNames := make([]string, 0, len(inputTypesWithFields))
	for typeName := range inputTypesWithFields {
		typeNames = append(typeNames, typeName)
	}
	sort.Strings(typeNames)

	for i, typeName := range typeNames {
		fields := inputTypesWithFields[typeName]
		content.WriteString(fmt.Sprintf("export type %s = {\n", typeName))

		for _, field := range fields {
			tsType, err := typescript.ConvertToTypeScriptType(
				ctx,
				db,
				config,
				field.Kind,
				field.Type,
				field.TypeModifiers,
			)
			if err != nil {
				return err
			}

			optional := ""
			if typescript.IsOptionalField(field.TypeModifiers) {
				optional = "?"
			}

			content.WriteString(fmt.Sprintf("%s%s%s: %s;\n", tab, field.Name, optional, tsType))
		}

		content.WriteString("};")

		// Add newline between types, but not after the last one
		if i < len(typeNames)-1 {
			content.WriteString("\n\n")
		}
	}

	// write the content to the file
	targetPath := path.Join(config.DefinitionsDirectory(), "inputs.d.ts")
	return afero.WriteFile(fs, targetPath, []byte(content.String()), 0o644)
}

type InputType struct {
	Name string
}

type InputField struct {
	Name          string
	Kind          string
	Type          string
	TypeModifiers string
}
