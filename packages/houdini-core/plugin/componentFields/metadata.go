package componentFields

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"code.houdinigraphql.com/packages/houdini-core/plugin/schema"
	"code.houdinigraphql.com/plugins"
	"zombiezen.com/go/sqlite"
)

// we need to look at anything tagged with @componentField and load the metadata into the database
// this includes:
// - populate prop, fields, etc for non-inline component fields
// - adding internal fields to the type definitions
// note: we'll hold on doing the actual injection of fragments til after we've validated
// everything to ensure that error messages make sense
func WriteMetadata[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	// First, load component field info from document_directives.
	// We assume that the @componentField directive appears only on fragment definitions.
	type ComponentFieldData struct {
		RawDocumentID int
		Type          string
		Prop          string
		Field         string
		Filepath      string
		Row           int
		Column        int
		Arguments     []struct {
			Name    string `json:"name"`
			Type    string `json:"type"`
			Default int    `json:"default"`
		}
	}
	documentInfo := map[int]*ComponentFieldData{}

	query := `
		SELECT
			docs.raw_document,
			raw_docs.filepath,
			doc_directives."column",
			doc_directives."row",
			docs.type_condition,
			field_arg_values.raw AS type_field,
			prop_arg_values.raw AS component_prop,
			COALESCE(
				'[' || GROUP_CONCAT(
				CASE WHEN arg_directive_args.name IS NOT NULL THEN json_object(
					'name', arg_directive_args.name,
					'type', arg_type_values.raw,
					'default', arg_default_values.id
				) END
				) || ']',
				''
			) AS component_field_args
		FROM document_directives AS doc_directives
			JOIN documents AS docs
				ON doc_directives.document = docs.id
			LEFT JOIN raw_documents AS raw_docs
				ON docs.raw_document = raw_docs.id
			JOIN document_directive_arguments AS doc_dir_arg_field
				ON doc_directives.id = doc_dir_arg_field.parent
				AND doc_dir_arg_field.name = 'field'
			JOIN argument_values AS field_arg_values
				ON doc_dir_arg_field.value = field_arg_values.id

			-- parse any arguments that might be added
			LEFT JOIN document_directive_arguments AS doc_dir_arg_prop
				ON doc_directives.id = doc_dir_arg_prop.parent
				AND doc_dir_arg_prop.name = 'prop'
			LEFT JOIN argument_values AS prop_arg_values
				ON doc_dir_arg_prop.value = prop_arg_values.id
			LEFT JOIN document_directives AS arg_directive
				ON arg_directive.document = docs.id
				AND arg_directive.directive = $arguments_directive
			LEFT JOIN document_directive_arguments AS arg_directive_args
				ON arg_directive.id = arg_directive_args.parent
			LEFT JOIN argument_values AS arg_values2
				ON arg_directive_args.value = arg_values2.id
			LEFT JOIN argument_value_children AS arg_child_type
				ON arg_child_type.parent = arg_values2.id
				AND arg_child_type.name = 'type'
			LEFT JOIN argument_values AS arg_type_values
				ON arg_child_type.value = arg_type_values.id
			LEFT JOIN argument_value_children AS arg_child_default
				ON arg_child_default.parent = arg_values2.id
				AND arg_child_default.name = 'default'
			LEFT JOIN argument_values AS arg_default_values
				ON arg_child_default.value = arg_default_values.id
		WHERE doc_directives.directive = $component_field
			AND (raw_docs.current_task = $task_id OR $task_id IS NULL)
		GROUP BY doc_directives.id
	`
	bindings := map[string]any{
		"component_field":     schema.ComponentFieldDirective,
		"arguments_directive": schema.ArgumentsDirective,
	}

	err := db.StepQuery(ctx, query, bindings, func(search *sqlite.Stmt) {
		rawDocumentID := search.ColumnInt(0)
		// Create or reuse the entry for this raw document.
		document, ok := documentInfo[rawDocumentID]
		if !ok {
			document = &ComponentFieldData{}
			documentInfo[rawDocumentID] = document
		}

		// the type comes from the document's type_condition.
		document.Filepath = search.ColumnText(1)
		document.Row = search.ColumnInt(2)
		document.Column = search.ColumnInt(3)
		document.Type = search.ColumnText(4)
		document.Field = search.ColumnText(5)
		document.Prop = search.ColumnText(6)

		// marshal the arguments spec into the document
		argJSON := search.ColumnText(7)
		if argJSON != "" {
			if err := json.Unmarshal([]byte(argJSON), &document.Arguments); err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
		}

	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}

	// grab a connection to write with
	conn, err := db.Take(context.Background())
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer db.Put(conn)

	// Convert our map into a slice for in‑memory processing.
	var records []ComponentFieldData
	for _, data := range documentInfo {
		records = append(records, *data)
	}

	// Prepare a statement to look up a type's kind from the types table.
	typesStmt, err := conn.Prepare(`SELECT kind FROM types WHERE name = ?`)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer typesStmt.Finalize()

	// Prepare a statement to check for conflicts in type_fields.
	tfStmt, err := conn.Prepare(`SELECT COUNT(*) FROM type_fields WHERE id = ?`)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer tfStmt.Finalize()

	// validate the component fields before we write them

	// ensure that each component field has a non-empty prop.
	for _, rec := range records {
		if strings.TrimSpace(rec.Prop) == "" {
			errs.Append(&plugins.Error{
				Message: "Component field must specify a prop",
				Kind:    plugins.ErrorKindValidation,
				Locations: []*plugins.ErrorLocation{
					{
						Filepath: rec.Filepath,
						Line:     rec.Row,
						Column:   rec.Column,
					},
				},
			})
		}
	}

	// ensure that the component field's type is not abstract.
	for _, rec := range records {
		if err := typesStmt.Reset(); err != nil {
			errs.Append(plugins.WrapError(err))
			continue
		}
		typesStmt.BindText(1, rec.Type)
		hasRow, err := typesStmt.Step()
		if err != nil {
			errs.Append(plugins.WrapError(err))
			continue
		}
		if !hasRow {
			// Type not found—skip.
			continue
		}
		kind := typesStmt.ColumnText(0)
		if kind == "INTERFACE" || kind == "UNION" {
			errs.Append(&plugins.Error{
				Message: fmt.Sprintf("Component field on type %q is not allowed on abstract type (document %d)", rec.Type, rec.RawDocumentID),
				Kind:    plugins.ErrorKindValidation,
			})
		}
	}

	// (c) Check that the component field does not conflict with an existing type field.
	// We assume the conflict key is built as "<Type>.<Field>".
	for _, rec := range records {
		candidateID := fmt.Sprintf("%s.%s", rec.Type, rec.Field)
		if err := tfStmt.Reset(); err != nil {
			errs.Append(plugins.WrapError(err))
			continue
		}
		tfStmt.BindText(1, candidateID)
		if _, err := tfStmt.Step(); err != nil {
			errs.Append(plugins.WrapError(err))
			continue
		}
		count := tfStmt.ColumnInt(0)
		if count > 0 {
			errs.Append(&plugins.Error{
				Message: fmt.Sprintf("Component field '%s' (prop %q) on type %q conflicts with an existing type field", rec.Field, rec.Prop, rec.Type),
				Kind:    plugins.ErrorKindValidation,
			})
		}
	}

	// (d) Ensure that there are no duplicate component field definitions.
	// That is, group by (Type, Prop, Field) and if any group has more than one record, that's an error.
	group := make(map[string][]ComponentFieldData)
	for _, rec := range records {
		key := fmt.Sprintf("%s|%s|%s", rec.Type, rec.Prop, rec.Field)
		group[key] = append(group[key], rec)
	}
	for key, recs := range group {
		if len(recs) > 1 {
			errs.Append(&plugins.Error{
				Message: fmt.Sprintf("Duplicate component field definition for (%s); found %d occurrences", key, len(recs)),
				Kind:    plugins.ErrorKindValidation,
			})
		}
	}

	// if there are any errors, don't go any further
	if errs.Len() > 0 {
		return
	}

	// Prepare statements to insert (or upsert) component fields and internal type fields.
	insertComponentField, err := conn.Prepare(`
		INSERT INTO component_fields
			(document, prop, field, type, inline)
		VALUES
			($document, $prop, $field, $type, false)
		ON CONFLICT(document) DO UPDATE SET
  			prop = excluded.prop,
  			field = excluded.field,
  			type = excluded.type
	`)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer insertComponentField.Finalize()

	insertInternalField, err := conn.Prepare(`
		INSERT INTO type_fields (id, parent, name, type, internal) VALUES ($id, $parent, $name, $type, true)
	`)
	if err != nil {
		errs.Append(&plugins.Error{
			Message: "could not prepare statement to insert internal fields",
			Detail:  err.Error(),
		})
		errs.Append(plugins.WrapError(err))
		return
	}
	defer insertInternalField.Finalize()

	insertFieldArgument, err := conn.Prepare(`
		INSERT INTO type_field_arguments (id, field, name, type, type_modifiers) VALUES ($id, $parent, $name, $type, $type_modifiers)
	`)
	if err != nil {
		errs.Append(&plugins.Error{
			Message: "could not prepare statement to insert internal fields",
			Detail:  err.Error(),
		})
		errs.Append(plugins.WrapError(err))
		return
	}
	defer insertFieldArgument.Finalize()

	// Process the collected component field data.
	for _, data := range documentInfo {
		err = db.ExecStatement(insertComponentField, map[string]any{
			"document": data.RawDocumentID,
			"prop":     data.Prop,
			"field":    data.Field,
			"type":     data.Type,
		})
		if err != nil {
			errs.Append(plugins.WrapError(err))
			continue
		}
		err = db.ExecStatement(insertInternalField, map[string]any{
			"id":     fmt.Sprintf("%s.%s", data.Type, data.Field),
			"parent": data.Type,
			"name":   data.Field,
			"type":   "Component",
		})
		if err != nil {
			errs.Append(plugins.WrapError(err))
			continue
		}

		// make sure any arguments on the component field are added to the internal field
		for _, arg := range data.Arguments {
			argType, typeModifiers := schema.ParseFieldType(arg.Type)
			err = db.ExecStatement(insertFieldArgument, map[string]any{
				"id":             fmt.Sprintf("%s.%s.%s", data.Type, data.Field, arg.Name),
				"parent":         fmt.Sprintf("%s.%s", data.Type, data.Field),
				"name":           arg.Name,
				"type":           argType,
				"type_modifiers": typeModifiers,
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
				continue
			}
		}
	}
}
