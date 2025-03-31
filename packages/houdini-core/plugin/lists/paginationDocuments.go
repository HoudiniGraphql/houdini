package lists

import (
	"context"
	"encoding/json"
	"fmt"

	"zombiezen.com/go/sqlite/sqlitex"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin/schema"
	"code.houdinigraphql.com/plugins"
)

func PreparePaginationDocuments(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
) error {
	projectConfig, err := db.ProjectConfig(ctx)
	if err != nil {
		return plugins.WrapError(err)
	}

	conn, err := db.Take(ctx)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer db.Put(conn)

	close := sqlitex.Transaction(conn)
	commit := func(err error) error {
		close(&err)
		return err
	}

	// in order to prepare paginated documents to load we need add the necessary arguments and replace any references to the pagination fields
	// with the appropriate variable references. to pull this off, we need to look at the discovered lists and extract information about
	// variables that are defined on the document as well as arguments that are passed to the field that's marked with the paginate/list directive
	query, err := conn.Prepare(`
		SELECT
			raw_documents.id,
			selection_refs.document as document,
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
			selections.type,
			documents.name,
			CASE
				WHEN types.operation THEN null
				WHEN documents.type_condition IS NOT NULL
					THEN COALESCE(type_configs.resolve_query, 'node')
				ELSE null
			END as resolve_query,
			CASE
				WHEN COUNT(tf.type) = 0 OR type_condition is null THEN NULL
				ELSE json_group_array(
					DISTINCT json_object(
						'name', je.value,
						'kind', tf.type
					)
				)
			END as resolve_key_objects,
			documents.type_condition,
			discovered_lists.paginate
		FROM discovered_lists
			JOIN raw_documents on discovered_lists.raw_document = raw_documents.id
			JOIN selections on discovered_lists.list_field = selections.id
			JOIN selection_refs on selection_refs.child_id = selections.id
			JOIN documents on selection_refs.document = documents.id
			LEFT JOIN document_variables on document_variables."document" = selection_refs.document
			LEFT JOIN selection_arguments on discovered_lists.list_field = selection_arguments.selection_id
			LEFT JOIN argument_values on selection_arguments.value = argument_values.id
			LEFT JOIN types on documents.type_condition = types."name"
			LEFT JOIN type_configs on documents.type_condition = type_configs."name"
			JOIN config
			CROSS JOIN json_each(COALESCE(type_configs.keys, config.default_keys)) AS je
			LEFT JOIN type_fields tf
				ON tf.parent = documents.type_condition
				AND tf.name = je.value
		WHERE (document_variables."name"  is null OR document_variables."name" in ('first', 'last', 'limit', 'before', 'after', 'offset'))
			AND (selection_arguments."name" is null OR selection_arguments."name" in ('first', 'last', 'limit', 'before', 'after', 'offset'))
			AND (raw_documents.current_task = $task_id OR $task_id IS NULL)
		GROUP BY discovered_lists.id
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}

	defer query.Finalize()

	type variableInfo struct {
		Variable string `json:"variable"`
		ID       int    `json:"id"`
	}

	type paginationArgumentInfo struct {
		Argument string `json:"argument"`
		ID       int    `json:"id"`
		Value    int    `json:"value"`
		Kind     string `json:"kind"`
		Raw      string `json:"raw"`
	}

	type paginationFieldArgumentSpec struct {
		Name string
		Kind string
	}

	// once we have a row, we'll need to insert variables and arguments into the document (and maybe extra documents)
	insertDocument, err := conn.Prepare(`
		INSERT INTO documents (name, kind, raw_document) VALUES ($name, 'query', $raw_document)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertDocument.Finalize()
	insertDocumentVariable, err := conn.Prepare(`
		INSERT INTO document_variables (document, "name", type, type_modifiers, default_value, row, column) VALUES ($document, $name, $type, $type_modifiers, $default_value, 0, 0)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertDocumentVariable.Finalize()
	insertSelectionArgument, err := conn.Prepare(`
		INSERT INTO selection_arguments (selection_id, "name", "value", row, column, field_argument) VALUES ($selection_id, $name, $value, 0, 0, $field_argument)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertSelectionArgument.Finalize()
	insertSelection, err := conn.Prepare(`
		INSERT INTO selections (field_name, kind, alias, type) VALUES ($field_name, $kind, $field_name, $type)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertSelection.Finalize()
	insertSelectionRef, err := conn.Prepare(`
		INSERT INTO selection_refs (document, child_id, parent_id, row, column, path_index) VALUES ($document, $child_id, $parent_id, 0, 0, 0)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertSelectionRef.Finalize()
	insertArgumentValue, err := conn.Prepare(`
		INSERT INTO argument_values (kind, raw, expected_type, document, row, column) VALUES ($kind, $raw, $expected_type, $document, 0, 0)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertArgumentValue.Finalize()
	insertDocumentDirectives, err := conn.Prepare(`
		INSERT INTO document_directives (document, directive, row, column) VALUES ($document, $directive, 0, 0)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertDocumentDirectives.Finalize()
	insertDocumentDirectiveArgument, err := conn.Prepare(`
		INSERT INTO document_directive_arguments (parent, name, value) VALUES ($document_directive, $argument, $value)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertDocumentDirectiveArgument.Finalize()

	// we might also need to delete an existing argument in place of the new one
	deleteSelectionArgument, err := conn.Prepare(`
		DELETE FROM selection_arguments WHERE id = $id
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer deleteSelectionArgument.Finalize()

	// we'll need to add selection directives
	insertSelectionDirective, err := conn.Prepare(`
		INSERT INTO selection_directives (selection_id, directive, row, column) VALUES ($selection, $directive, 0, 0)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertSelectionDirective.Finalize()
	// we'll need to add selection directive arguments
	insertSelectionDirectiveArgument, err := conn.Prepare(`
		INSERT INTO selection_directive_arguments (parent, name, value) VALUES ($parent, $name, $value)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertSelectionDirectiveArgument.Finalize()

	// iterate over the rows
	errs := &plugins.ErrorList{}
	err = db.StepStatement(ctx, query, func() {
		// pull out the row values
		rawDocument := query.ColumnInt(0)
		document := query.ColumnInt64(1)
		docType := query.ColumnText(2)
		listField := query.ColumnText(3)
		variablesStr := query.ColumnText(4)
		argumentsStr := query.ColumnText(5)
		supportsForward := query.ColumnBool(6)
		supportsBackward := query.ColumnBool(7)
		connection := query.ColumnBool(8)
		fieldName := query.ColumnText(9)
		documentName := query.ColumnText(10)
		resolveQuery := query.ColumnText(11)
		resolveKeys := query.ColumnText(12)
		paginate := false
		if !query.IsNull("paginate") {
			paginate = true
		}

		if !paginate {
			return
		}

		// unmarshal the variables
		var variables []variableInfo
		if err := json.Unmarshal([]byte(variablesStr), &variables); err != nil {
			errs.Append(plugins.WrapError(fmt.Errorf("failed to unmarshal variables: %v", err)))
			return
		}

		// unmarshal the arguments
		var arguments []paginationArgumentInfo
		if argumentsStr != "" {
			if err := json.Unmarshal([]byte(argumentsStr), &arguments); err != nil {
				errs.Append(plugins.WrapError(fmt.Errorf("failed to unmarshal arguments: %v", err)))
				return
			}
		}

		// unmarshal the keys to use when resolving this field
		keys := []paginationFieldArgumentSpec{}
		if resolveKeys != "" {
			if err := json.Unmarshal([]byte(resolveKeys), &keys); err != nil {
				errs.Append(plugins.WrapError(fmt.Errorf("failed to unmarshal keys: %v", err)))
				return
			}
		}

		// now we need to make sure that the tagged field has all of the necessary argument definitions
		argumentsToAdd := []paginationFieldArgumentSpec{}
		if connection {
			if supportsForward {
				argumentsToAdd = append(argumentsToAdd,
					paginationFieldArgumentSpec{
						Name: "first",
						Kind: "Int",
					},
					paginationFieldArgumentSpec{
						Name: "after",
						Kind: "String",
					},
				)
			}
			if supportsBackward {
				argumentsToAdd = append(argumentsToAdd,
					paginationFieldArgumentSpec{
						Name: "last",
						Kind: "Int",
					},
					paginationFieldArgumentSpec{
						Name: "before",
						Kind: "String",
					},
				)
			}
		} else {
			if supportsForward {
				argumentsToAdd = append(argumentsToAdd,
					paginationFieldArgumentSpec{
						Name: "limit",
						Kind: "Int",
					},
					paginationFieldArgumentSpec{
						Name: "offset",
						Kind: "Int",
					},
				)
			}
		}

		// we can reuse argument values that point to the variables
		variableIDs := map[string]int64{}

		// loop over the arguments and add them to the document
		for _, arg := range argumentsToAdd {
			// the argument might already be defined on the field, in which case we can just delete the row in the database
			// we'll replace it with the variable reference later
			for _, existingArg := range arguments {
				if existingArg.Argument == arg.Name {

					// if the argument is already defined, we need to make sure that the type matches
					err = db.ExecStatement(
						deleteSelectionArgument,
						map[string]any{"id": existingArg.ID},
					)
					if err != nil {
						errs.Append(plugins.WrapError(err))
						return
					}

					break
				}
			}

			// create the variable value
			err = db.ExecStatement(insertArgumentValue, map[string]any{
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
			variableIDs[arg.Name] = valueID

			// add the argument to the field
			err = db.ExecStatement(insertSelectionArgument, map[string]any{
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
	ARGUMENTS:
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

			// if the variable is already defined, skip it
			for _, variable := range variables {
				if variable.Variable == arg.Name {
					continue ARGUMENTS
				}
			}

			// add the variable to the document
			err = db.ExecStatement(insertDocumentVariable, map[string]any{
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

		// we need to apply the dedupe directive to the document that holds the query
		// if we are looking at a paginated fragment then it needs to point to the generated document
		dedupeTarget := document
		if docType == "fragment" {
			// insert a document with a name derived from the fragment name
			err = db.ExecStatement(insertDocument, map[string]any{
				"name":         schema.FragmentPaginationQueryName(documentName),
				"raw_document": rawDocument,
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
			dedupeTarget = conn.LastInsertRowID()

			// add the variables to the document
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

				// add the variable definition
				err = db.ExecStatement(insertDocumentVariable, map[string]any{
					"document":      dedupeTarget,
					"name":          arg.Name,
					"type":          arg.Kind,
					"default_value": defaultValue,
				})
				if err != nil {
					errs.Append(plugins.WrapError(err))
					return
				}
			}

			// we need to embed the fragment in the document selection
			err = db.ExecStatement(insertSelection, map[string]any{
				"field_name": documentName,
				"kind":       "fragment",
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
			fragmentSpreadID := conn.LastInsertRowID()

			// we need to add the with directive to the fragment spread
			err = db.ExecStatement(insertSelectionDirective, map[string]any{
				"selection": fragmentSpreadID,
				"directive": schema.WithDirective,
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
			withID := conn.LastInsertRowID()

			// for each argument we drive pagination with, we need to add an argument to the directive
			for _, arg := range argumentsToAdd {
				// if the argument is already defined, we need to make sure that the type matches
				err = db.ExecStatement(insertSelectionDirectiveArgument, map[string]any{
					"parent": withID,
					"name":   arg.Name,
					"value":  variableIDs[arg.Name],
				})
				if err != nil {
					errs.Append(plugins.WrapError(err))
					return
				}
			}

			// if we don't have a resolve query, all we need to do is insert the fragment spread into the document
			if resolveQuery == "" {
				// insert a selection ref with the fragment spread as a child
				err = db.ExecStatement(insertSelectionRef, map[string]any{
					"document": dedupeTarget,
					"child_id": fragmentSpreadID,
				})
				if err != nil {
					errs.Append(plugins.WrapError(err))
					return
				}
			} else {
				// we need to create a selection with the resolveQuery
				err = db.ExecStatement(insertSelection, map[string]any{
					"field_name": resolveQuery,
					"kind":       "field",
					"type":       fmt.Sprintf("%s.%s", "Query", resolveQuery),
				})
				if err != nil {
					errs.Append(plugins.WrapError(err))
					return
				}
				resolveSelection := conn.LastInsertRowID()

				// add the selection to the document
				err = db.ExecStatement(insertSelectionRef, map[string]any{
					"document": dedupeTarget,
					"child_id": resolveSelection,
				})
				if err != nil {
					errs.Append(plugins.WrapError(err))
					return
				}

				// and add the fragment spread to the resolve selection
				err = db.ExecStatement(insertSelectionRef, map[string]any{
					"document":  dedupeTarget,
					"child_id":  fragmentSpreadID,
					"parent_id": resolveSelection,
				})
				if err != nil {
					errs.Append(plugins.WrapError(err))
					return
				}

				// if we have keys to add, then we need to add them to document
				for _, key := range keys {
					// we need a variable that references the key
					err = db.ExecStatement(insertArgumentValue, map[string]any{
						"kind":          "Variable",
						"raw":           key.Name,
						"expected_type": key.Kind,
						"document":      dedupeTarget,
					})
					if err != nil {
						errs.Append(plugins.WrapError(err))
						return
					}

					// and add the key as an argumnent to the resolve field
					err = db.ExecStatement(insertSelectionArgument, map[string]any{
						"selection_id":   resolveSelection,
						"name":           key.Name,
						"value":          conn.LastInsertRowID(),
						"field_argument": fmt.Sprintf("%s.%s.%s", "Query", resolveQuery, key.Name),
					})
					if err != nil {
						errs.Append(plugins.WrapError(err))
						return
					}

					// we also need a document variable
					err = db.ExecStatement(insertDocumentVariable, map[string]any{
						"document":       dedupeTarget,
						"name":           key.Name,
						"type":           key.Kind,
						"type_modifiers": "!",
					})
					if err != nil {
						errs.Append(plugins.WrapError(err))
						return
					}
				}
			}
		}

		// if we aren't supposed to suppress the dedupe directive, we need to add it to the document
		if !projectConfig.SuppressPaginationDeduplication {
			// add the dedupe directive to the document
			err = db.ExecStatement(insertDocumentDirectives, map[string]any{
				"document":  dedupeTarget,
				"directive": schema.DedupeDirective,
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}

			directiveID := conn.LastInsertRowID()

			// set the match argument to Variables
			err = db.ExecStatement(insertArgumentValue, map[string]any{
				"kind":          "Enum",
				"raw":           "Variables",
				"expected_type": "DedupeMatchMode",
				"document":      dedupeTarget,
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}

			err = db.ExecStatement(insertDocumentDirectiveArgument, map[string]any{
				"document_directive": directiveID,
				"argument":           "match",
				"value":              conn.LastInsertRowID(),
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
		}
	})
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	if errs.Len() > 0 {
		return commit(errs)
	}

	// we're done
	return commit(nil)
}
