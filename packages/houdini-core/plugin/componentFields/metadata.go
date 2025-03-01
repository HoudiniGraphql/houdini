package componentFields

import (
	"context"
	"fmt"
	"strconv"
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
		Line          int
	}
	documentInfo := map[int]*ComponentFieldData{}

	query := `
		SELECT
			documents.raw_document,
			documents.type_condition,
			document_directive_arguments.name,
			argument_values.raw,
			raw_documents.filepath,
			raw_documents.offset_column,
			raw_documents.offset_line
		FROM
			document_directives
			JOIN documents ON document_directives.document = documents.id
			JOIN document_directive_arguments ON document_directive_arguments.parent = document_directives.id
			JOIN argument_values on document_directive_arguments.value = argument_values.id
			LEFT JOIN raw_documents ON documents.raw_document = raw_documents.id
		WHERE
			document_directives.directive = $component_field
			AND (raw_documents.current_task = $task_id OR $task_id IS NULL)
	`
	bindings := map[string]any{
		"component_field": schema.ComponentFieldDirective,
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
		document.Type = search.ColumnText(1)
		document.RawDocumentID = rawDocumentID
		document.Row = search.ColumnInt(4)
		document.Line = search.ColumnInt(5)
		document.Filepath = search.ColumnText(6)

		// unquote the value if need be
		unquoted := search.ColumnText(3)
		if strings.HasPrefix(unquoted, `"`) {
			var err error
			unquoted, err = strconv.Unquote(search.ColumnText(3))
			if err != nil {
				fmt.Println(err)
				errs.Append(plugins.WrapError(err))
				return
			}
		}

		switch search.ColumnText(2) {
		case "prop":
			document.Prop = unquoted
		case "field":
			document.Field = unquoted
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
						Line:     rec.Line,
						Column:   rec.Row,
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
		fmt.Println(candidateID, rec)
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
	}
}
