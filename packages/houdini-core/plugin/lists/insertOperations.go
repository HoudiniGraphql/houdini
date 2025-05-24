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

func InsertOperationDocuments(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
) error {
	// during validation, we might have discovered lists that cause new documents to be inserted
	// into the database. we also need to insert internal directives so that we can strip them
	// from the final selection set

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

	// we don't want to add the same directive twice
	insertedDirectives := map[string]bool{}

	// we need a query that copys the subselection for the list field
	// into a document
	copySelection, err := conn.Prepare(`
		INSERT
			INTO selection_refs (document, child_id, row, column, path_index)
		SELECT
			$document AS document,
			child_id,
			row,
			column,
			path_index
		FROM selection_refs WHERE parent_id = $selection_parent
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer copySelection.Finalize()

	searchSelectionArguments, err := conn.Prepare(`
    SELECT 
      selection_id, name, value, row, column, field_argument 
    FROM selection_arguments WHERE document = $document
  `)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer searchSelectionArguments.Finalize()

	insertSelectionArguments, err := conn.Prepare(`
    INSERT INTO selection_arguments 
      (name, value, row, column, field_argument, selection_id, document)
    VALUES 
      ($name, $value, $row, $column, $field_argument, $selection_id, $document)
  `)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertSelectionArguments.Finalize()

	// copying argument values has to happen in multiple steps since we need to recreate the
	// nested structure with each parent value
	searchArgumentValues, err := conn.Prepare(`
    SELECT 
    	argument_values.*,
    	CASE 
	    	WHEN 
	    		argument_value_children.id is null THEN json('[]')
	    	ELSE 
		    	COALESCE(json_group_array(
		    		json_object(
		    			'name', argument_value_children."name",
		    			'value', argument_value_children."value",
		    			'row', argument_value_children."row",
		    			'column', argument_value_children."column"
		    		)
		    	), json('[]'))
		END as children
    FROM argument_values 
      LEFT JOIN argument_value_children ON argument_values.id = argument_value_children.parent
    WHERE argument_values.document = $document
    GROUP BY argument_values.id ORDER BY id DESC
  `)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer searchArgumentValues.Finalize()

	// once we have an argument value we need to insert a matching row with a different document
	insertArgumentValue, err := conn.Prepare(`
      INSERT INTO argument_values 
          (kind, raw, row, column, expected_type, expected_type_modifiers, document)
      VALUES
          ($kind, $raw, $row, $column, $expected_type, $expected_type_modifiers, $document)
  `)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertArgumentValue.Finalize()

	insertArgumentValueChildren, err := conn.Prepare(`
      INSERT INTO argument_value_children
        (name, parent, value, row, column, document)
      VALUES
        ($name, $parent, $value, $row, $column, $document)
  `)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertArgumentValueChildren.Finalize()

	insertDocument, err := conn.Prepare(
		"INSERT INTO documents (name, raw_document, kind, type_condition) VALUES ($name, $raw_document, $kind, $type_condition)",
	)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertDocument.Finalize()

	// a statement to insert internal directives
	insertInternalDirectiveStmt, err := conn.Prepare(
		"INSERT INTO directives (name, description, internal, visible) VALUES ($name, $description, true, true)",
	)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertInternalDirectiveStmt.Finalize()

	// a statement to insert a selection
	insertSelection, err := conn.Prepare(
		"INSERT INTO selections (field_name, alias, kind, type) VALUES ($field_name, $alias, $kind, $type)",
	)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertSelection.Finalize()

	// a statement to insert selection refs
	insertSelectionRef, err := conn.Prepare(
		"INSERT INTO selection_refs (parent_id, child_id, document, row, column, path_index) VALUES ($parent_id, $child_id, $document, $row, $column, $path_index)",
	)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertSelectionRef.Finalize()

	// now we can step through each discovered list and insert the necessary documents
	errs := &plugins.ErrorList{}
	searchLists, err := conn.Prepare(`
		SELECT 
      discovered_lists.name, 
      discovered_lists.node_type, 
      discovered_lists.node, 
      discovered_lists.raw_document, 
      documents.id as document_id,
      CASE 
        WHEN document_variables.id IS NULL THEN json('[]')
        ELSE json_group_array(
          json_object(
            'name', document_variables.name,
            'type', document_variables.type,
            'type_modifiers', document_variables.type_modifiers
          )
        )
      END as document_arguments
		FROM discovered_lists
			JOIN raw_documents ON raw_documents.id = discovered_lists.raw_document
      JOIN documents ON documents.raw_document = raw_documents.id
      LEFT JOIN document_variables ON document_variables.document = documents.id
		WHERE raw_documents.current_task = $task_id OR $task_id IS NULL
    GROUP BY discovered_lists.name
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer searchLists.Finalize()

	insertDocumentArgument, err := conn.Prepare(`
    INSERT INTO document_variables (document, name, type, row, column, type_modifiers)
    VALUES ($document, $name, $type, 0, 0, $type_modifiers)
  `)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertDocumentArgument.Finalize()

	err = db.StepStatement(ctx, searchLists, func() {
		name := searchLists.ColumnText(0)
		listType := searchLists.ColumnText(1)
		selectionParent := searchLists.ColumnInt64(2)
		rawDocument := searchLists.ColumnInt64(3)
		documentID := searchLists.GetInt64("document_id")
		documentArgmentsString := searchLists.GetText("document_arguments")

		arguments := []struct {
			Name          string `json:"name"`
			Type          string `json:"type"`
			TypeModifiers string `json:"type_modifiers"`
		}{}
		err = json.Unmarshal([]byte(documentArgmentsString), &arguments)
		if err != nil {
			errs.Append(plugins.WrapError(err))
			return
		}

		// if the document doesn't have a name then we dont need to generate documents for it
		if name == "" {
			return
		}

		// the first thing we have to do is insert a document with the correct names
		// and then we'll copy over the selection_refs from the selection_parent

		// let's collect the documents we inserted so we can copy the argument values over to both documents
		copyTargets := []int64{}

		// _insert and _toggle both get the full selection set
		for _, suffixes := range []string{schema.ListOperationSuffixInsert, schema.ListOperationSuffixToggle} {
			err := db.ExecStatement(insertDocument, map[string]any{
				"name":           fmt.Sprintf("%s%s", name, suffixes),
				"kind":           "fragment",
				"type_condition": listType,
				"raw_document":   rawDocument,
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}

			fragmentID := conn.LastInsertRowID()
			copyTargets = append(copyTargets, fragmentID)

			// copy the selection from the selection parent to the new document
			err = db.ExecStatement(copySelection, map[string]any{
				"document":         fragmentID,
				"selection_parent": selectionParent,
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}

			for _, arg := range arguments {
				err = db.ExecStatement(insertDocumentArgument, map[string]any{
					"name":           arg.Name,
					"type":           arg.Type,
					"type_modifiers": arg.TypeModifiers,
					"document":       fragmentID,
				})
			}
		}

		// now we need to copy argument values that show up. to recreate the nested structure we need a mapping
		// of old values to the copied ones
		valueMap := map[int64]map[int64]int64{}
		searchArgumentValues.SetInt64("$document", documentID)
		err = db.StepStatement(ctx, searchArgumentValues, func() {
			// every row that we get in the query needs to be inserted as an argument value
			id := searchArgumentValues.GetInt64("id")
			kind := searchArgumentValues.GetText("kind")
			raw := searchArgumentValues.GetText("raw")
			row := searchArgumentValues.GetInt64("row")
			column := searchArgumentValues.GetInt64("column")
			expectedType := searchArgumentValues.GetText("expected_type")
			expectedTypeModifiers := searchArgumentValues.GetText("expected_type_modifiers")
			childrenString := searchArgumentValues.GetText("children")

			children := []struct {
				Name   string `json:"name"`
				Value  int64  `json:"value"`
				Row    int64  `json:"row"`
				Column int64  `json:"column"`
			}{}
			err = json.Unmarshal([]byte(childrenString), &children)
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}

			for _, target := range copyTargets {
				// insert a new argument value
				err = db.ExecStatement(insertArgumentValue, map[string]any{
					"kind":                    kind,
					"raw":                     raw,
					"row":                     row,
					"column":                  column,
					"expected_type":           expectedType,
					"expected_type_modifiers": expectedTypeModifiers,
					"document":                target,
				})
				if err != nil {
					errs.Append(plugins.WrapError(err))
					return
				}
				newID := conn.LastInsertRowID()

				// register the mapping
				if _, ok := valueMap[target]; !ok {
					valueMap[target] = map[int64]int64{}
				}

				valueMap[target][id] = newID

				// process any children
				for _, child := range children {
					err = db.ExecStatement(insertArgumentValueChildren, map[string]any{
						"name":     child.Name,
						"row":      child.Row,
						"column":   child.Column,
						"value":    newID,
						"document": target,
					})
					if err != nil {
						errs.Append(plugins.WrapError(err))
						return
					}
				}
			}
		})
		if err != nil {
			errs.Append(plugins.WrapError(err))
			return
		}

		// now we need to apply the selection arguments with the new values
		searchSelectionArguments.SetInt64("$document", documentID)
		err = db.StepStatement(ctx, searchSelectionArguments, func() {
			selectionID := searchSelectionArguments.GetText("selection_id")
			name := searchSelectionArguments.GetText("name")
			value := searchSelectionArguments.GetInt64("value")
			row := searchSelectionArguments.GetInt64("row")
			column := searchSelectionArguments.GetInt64("column")
			fieldArgument := searchSelectionArguments.GetText("field_argument")

			for _, target := range copyTargets {
				err = db.ExecStatement(insertSelectionArguments, map[string]any{
					"name":           name,
					"value":          valueMap[target][value],
					"row":            row,
					"column":         column,
					"field_argument": fieldArgument,
					"selection_id":   selectionID,
					"document":       target,
				})
				if err != nil {
					errs.Append(plugins.WrapError(err))
					return
				}
			}
		})
		if err != nil {
			errs.Append(plugins.WrapError(err))
			return
		}
	})
	if err != nil {
		return commit(plugins.WrapError(err))
	}

	// we'll insert delete directive and remove fragment driven by a separate query
	statementWithKeys, err := conn.Prepare(`
		WITH default_config AS (
			SELECT default_keys
			FROM config
			LIMIT 1
		),

		base AS (
			select * from discovered_lists
			JOIN raw_documents on discovered_lists.raw_document = raw_documents.id
			WHERE raw_documents.current_task = $task_id or $task_id is NULL
		)

		SELECT b.name, b.node_type, tc.keys, b.raw_document
		FROM base b
		JOIN type_configs tc ON tc.name = b.node_type

		UNION

		SELECT b.name, b.node_type, default_config.default_keys, b.raw_document
		FROM base b
			LEFT JOIN type_configs tc ON tc.name = b.node_type
			JOIN default_config
		WHERE tc.name IS NULL
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer statementWithKeys.Finalize()

	err = db.StepStatement(ctx, statementWithKeys, func() {
		listName := statementWithKeys.GetText("name")
		typeName := statementWithKeys.GetText("node_type")
		keysStr := statementWithKeys.GetText("default_keys")
		rawDocument := statementWithKeys.GetText("raw_document")

		keys := []string{}
		if keysStr != "" {
			err = json.Unmarshal([]byte(keysStr), &keys)
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
		}

		if ok := insertedDirectives[typeName]; !ok {
			// we need to insert a delete directive for each type that has a list
			err = db.ExecStatement(insertInternalDirectiveStmt, map[string]any{
				"name":        fmt.Sprintf("%s%s", typeName, schema.ListOperationSuffixDelete),
				"description": fmt.Sprintf("Delete the %s with the matching key", typeName),
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}

			// make sure we only generate it once
			insertedDirectives[typeName] = true
		}

		// if the list isn't named we dont need to generate  delete directive
		if listName != "" {
			// we also need to insert a remove fragment for each type that has a list
			db.ExecStatement(insertDocument, map[string]any{
				"name":           fmt.Sprintf("%s%s", listName, schema.ListOperationSuffixRemove),
				"kind":           "fragment",
				"type_condition": typeName,
				"raw_document":   rawDocument,
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}

			fragmentID := conn.LastInsertRowID()

			// now we need a selection for each key and a ref that links it up to the parent
			for _, key := range append(keys, "__typename") {
				// insert the selection row
				err = db.ExecStatement(insertSelection, map[string]any{
					"field_name": key,
					"alias":      key,
					"kind":       "field",
					"type":       fmt.Sprintf("%s.%s", typeName, key),
				})
				if err != nil {
					errs.Append(plugins.WrapError(err))
					return
				}

				// insert the selection ref
				err = db.ExecStatement(insertSelectionRef, map[string]any{
					"child_id":   conn.LastInsertRowID(),
					"document":   fragmentID,
					"row":        0,
					"column":     0,
					"path_index": 0,
				})
				if err != nil {
					errs.Append(plugins.WrapError(err))
					return
				}
			}
		}
	})
	if err != nil {
		return commit(plugins.WrapError(err))
	}

	// if we collected any errors, return them
	if errs.Len() > 0 {
		return commit(errs)
	}

	// we're done
	return commit(nil)
}
