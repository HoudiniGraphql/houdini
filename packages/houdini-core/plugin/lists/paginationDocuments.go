package lists

import (
	"context"
	"fmt"

	"encoding/json"

	"code.houdinigraphql.com/plugins"
)

func PreparePaginationDocuments[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig]) error {
	conn, err := db.Take(ctx)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer db.Put(conn)

	// in order to prepare paginated documents to load we need add the necessary arguments and replace any references to the pagination fields
	// with the appropriate variable references. to pull this off, we need to look at the discovered lists and extract information about
	// variables that are defined on the document as well as arguments that are passed to the field that's marked with the paginate/list directive
	query, err := conn.Prepare(`
		SELECT
			raw_documents.filepath,
			documents.id as document,
			documents.kind as document_kind,
			discovered_lists.list_field,
			json_group_array(
			DISTINCT json_object(
				'variable', document_variables."name",
				'id', document_variables.id
			)
			) FILTER (WHERE document_variables.id IS NOT NULL) as variables,
			json_group_array(
			DISTINCT json_object(
				'argument', selection_arguments."name",
				'id', selection_arguments.id,
				'value', selection_arguments."value",
				'kind', argument_values.kind,
				'raw', argument_values.raw
			)
			) FILTER (WHERE selection_arguments.id IS NOT NULL) as arguments,
			discovered_lists.supports_forward,
			discovered_lists.supports_backward,
			discovered_lists."connection",
			selections.type
		FROM discovered_lists
			JOIN raw_documents on discovered_lists.raw_document = raw_documents.id
			JOIN documents on documents.raw_document = raw_documents.id
			JOIN selections on discovered_lists.list_field = selections.id
			LEFT JOIN document_variables on document_variables."document" = documents.id
			LEFT JOIN selection_arguments on discovered_lists.list_field = selection_arguments.selection_id
			LEFT JOIN argument_values on selection_arguments.value = argument_values.id
		WHERE (document_variables."name"  is null OR document_variables."name" in ('first', 'last', 'limit', 'before', 'after', 'offset'))
		AND (selection_arguments."name" is null OR selection_arguments."name" in ('first', 'last', 'limit', 'before', 'after', 'offset'))
		GROUP BY discovered_lists.id
	`)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer query.Finalize()

	type VariableInfo struct {
		Variable string `json:"variable"`
		ID       int    `json:"id"`
	}

	type ArgumentInfo struct {
		Argument string `json:"argument"`
		ID       int    `json:"id"`
		Value    string `json:"value"`
		Kind     string `json:"kind"`
		Raw      string `json:"raw"`
	}

	type FieldArgumentSpec struct {
		Name string
		Kind string
	}

	// once we have a row, we'll need to insert variables and arguments into the document
	insertDocumentVariable, err := conn.Prepare(`
		INSERT INTO document_variables (document, "name", type, default_value, row, column) VALUES ($document, $name, $type, $default_value, 0, 0)
	`)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer insertDocumentVariable.Finalize()
	insertSelectionArgument, err := conn.Prepare(`
		INSERT INTO selection_arguments (selection_id, "name", "value", row, column, field_argument) VALUES ($selection_id, $name, $value, 0, 0, $field_argument)
	`)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer insertSelectionArgument.Finalize()
	insertArgumentValue, err := conn.Prepare(`
		INSERT INTO argument_values (kind, raw, expected_type, document) VALUES ($kind, $raw, $expected_type, $document)
	`)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer insertArgumentValue.Finalize()

	// we might also need to delete an existing argument in place of the new one
	deleteSelectionArgument, err := conn.Prepare(`
		DELETE FROM selection_arguments WHERE id = $id
	`)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer deleteSelectionArgument.Finalize()

	// iterate over the rows
	errs := &plugins.ErrorList{}
	err = db.StepStatement(ctx, query, func() {
		// pull out the row values
		document := query.ColumnInt(1)
		_ = query.ColumnText(2)
		listField := query.ColumnText(3)
		variablesStr := query.ColumnText(4)
		argumentsStr := query.ColumnText(5)
		supportsForward := query.ColumnBool(6)
		supportsBackward := query.ColumnBool(7)
		connection := query.ColumnBool(8)
		fieldName := query.ColumnText(9)

		// unmarshal the variables
		var variables []VariableInfo
		if err := json.Unmarshal([]byte(variablesStr), &variables); err != nil {
			errs.Append(plugins.WrapError(fmt.Errorf("failed to unmarshal variables: %v", err)))
			return
		}

		// unmarshal the arguments
		var arguments []ArgumentInfo
		if err := json.Unmarshal([]byte(argumentsStr), &arguments); err != nil {
			errs.Append(plugins.WrapError(fmt.Errorf("failed to unmarshal arguments: %v", err)))
			return
		}

		// now we need to make sure that the tagged field has all of the ncessary argument definitions
		argumentsToAdd := []FieldArgumentSpec{}
		if connection {
			if supportsForward {
				argumentsToAdd = append(argumentsToAdd,
					FieldArgumentSpec{
						Name: "first",
						Kind: "Int",
					},
					FieldArgumentSpec{
						Name: "after",
						Kind: "String",
					},
				)
			}
			if supportsBackward {
				argumentsToAdd = append(argumentsToAdd,
					FieldArgumentSpec{
						Name: "last",
						Kind: "Int",
					},
					FieldArgumentSpec{
						Name: "before",
						Kind: "String",
					},
				)
			}
		} else {
			if supportsForward {
				argumentsToAdd = append(argumentsToAdd,
					FieldArgumentSpec{
						Name: "limit",
						Kind: "Int",
					},
					FieldArgumentSpec{
						Name: "offset",
						Kind: "Int",
					},
				)
			}
		}

		// loop over the arguments and add them to the document
		for _, arg := range argumentsToAdd {
			// the argument might already be defined on the field, in which case we can just delete the row in the database
			// we'll replace it with the variable reference later
			for _, existingArg := range arguments {
				if existingArg.Argument == arg.Name {

					// if the argument is already defined, we need to make sure that the type matches
					err = db.ExecStatement(deleteSelectionArgument, map[string]interface{}{"id": existingArg.ID})
					if err != nil {
						errs.Append(plugins.WrapError(err))
						return
					}

					break
				}
			}

			// create the variable value
			err = db.ExecStatement(insertArgumentValue, map[string]interface{}{
				"kind":          "Variable",
				"raw":           arg.Name,
				"expected_type": arg.Kind,
				"document":      document,
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
			valueID := conn.LastInsertRowID()

			// add the argument to the field
			err = db.ExecStatement(insertSelectionArgument, map[string]interface{}{
				"selection_id":   listField,
				"name":           arg.Name,
				"value":          valueID,
				"field_argument": fmt.Sprintf("%s.%s", fieldName, arg.Name),
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
		}

		// now that the field has all of the arguments we need to define the corresponding variables
		// on the document
		for _, arg := range argumentsToAdd {
			// if the variable is already defined then we have a value ID to use as the default value
			var defaultValue interface{}
			for _, appliedArg := range arguments {
				if appliedArg.Argument == arg.Name {
					if appliedArg.Kind != "Variable" {
						defaultValue = appliedArg.Value
					}
					break
				}
			}

			// add the variable to the document
			err = db.ExecStatement(insertDocumentVariable, map[string]interface{}{
				"document":      document,
				"name":          arg.Name,
				"type":          arg.Kind,
				"default_value": defaultValue,
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
		}

	})
	if err != nil {
		return plugins.WrapError(err)
	}

	// we're done
	return nil
}
