package lists

import (
	"context"
	"encoding/json"
	"fmt"

	"zombiezen.com/go/sqlite/sqlitex"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/graphql"
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
	// into a document - this finds all descendants and copies them preserving relationships
	// The key insight: we're only creating new refs, not new selections, so parent_id relationships should be preserved
	copySelection, err := conn.Prepare(`
		WITH RECURSIVE subtree AS (
			-- Start with the selection parent itself
			SELECT $selection_parent as selection_id

			UNION ALL

			-- Add all descendants recursively
			SELECT sr.child_id
			FROM selection_refs sr
			JOIN subtree st ON sr.parent_id = st.selection_id
		)
		-- Copy all selection references where both parent and child are in our subtree
		-- BUT exclude the selection_parent itself - we only want its children
		INSERT INTO selection_refs (document, parent_id, child_id, row, column, path_index, internal)
		SELECT
			$document AS document,
			CASE
				WHEN sr.parent_id = $selection_parent THEN NULL  -- Direct children of selection_parent become roots
				ELSE sr.parent_id
			END as parent_id,
			sr.child_id,
			sr.row,
			sr.column,
			sr.path_index,
			sr.internal
		FROM selection_refs sr
		WHERE sr.parent_id IN (SELECT selection_id FROM subtree)
		  AND sr.child_id IN (SELECT selection_id FROM subtree)
		  AND sr.child_id != $selection_parent  -- Exclude the selection_parent itself
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
		`
			INSERT INTO documents 
				(name, raw_document, kind, type_condition, internal, visible)
			VALUES 
				($name, $raw_document, $kind, $type_condition, true, false)
		`,
	)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertDocument.Finalize()

	insertDocumentDependency, err := conn.Prepare(
		`
			INSERT INTO document_dependencies
				(document, depends_on)
			VALUES 
				($document, $depends_on)
		`,
	)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertDocumentDependency.Finalize()

	// a statement to insert internal directives
	insertInternalDirectiveStmt, err := conn.Prepare(
		"INSERT INTO directives (name, description, internal, visible) VALUES ($name, $description, true, true)ON CONFLICT (name) DO NOTHING",
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
		"INSERT INTO selection_refs (parent_id, child_id, document, row, column, path_index, internal) VALUES ($parent_id, $child_id, $document, $row, $column, $path_index, $internal)",
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
					discovered_lists.document,
					documents.id as document_id,
					documents.raw_document,
					CASE
						WHEN document_variables.id IS NULL THEN json('[]')
						ELSE json_group_array(
							json_object(
								'name', document_variables.name,
								'type', document_variables.type,
								'type_modifiers', document_variables.type_modifiers
							)
						)
					END as document_arguments,
				documents.name as document_name
		FROM discovered_lists
			JOIN documents ON documents.id = discovered_lists.document AND documents.kind != 'fragment'
			JOIN raw_documents ON raw_documents.id = documents.raw_document
			LEFT JOIN document_variables ON document_variables.document = documents.id
			LEFT JOIN documents operations ON operations.name = discovered_lists.name || $toggle_suffix
		WHERE 
			discovered_lists.name IS NOT '' and discovered_lists.name IS NOT NULL 
			AND operations.id IS NULL 
			AND (raw_documents.current_task = $task_id OR $task_id IS NULL)
		GROUP BY discovered_lists.name
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer searchLists.Finalize()
	err = db.BindStatement(searchLists, map[string]any{
		"toggle_suffix": graphql.ListOperationSuffixToggle,
	})
	if err != nil {
		return commit(plugins.WrapError(err))
	}

	insertDocumentArgument, err := conn.Prepare(`
    INSERT OR IGNORE INTO document_variables (document, name, type, row, column, type_modifiers)
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
		documentID := searchLists.GetInt64("document_id")
		rawDocument := searchLists.GetInt64("raw_document")
		documentArgmentsString := searchLists.GetText("document_arguments")
		documentName := searchLists.GetText("document_name")

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
		for _, suffixes := range []string{graphql.ListOperationSuffixInsert, graphql.ListOperationSuffixToggle} {
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

			// insert the document dependency
			err = db.ExecStatement(insertDocumentDependency, map[string]any{
				"document":   fragmentID,
				"depends_on": documentName,
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}

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
				if err != nil {
					errs.Append(plugins.WrapError(err))
					return
				}
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

	projectConfig, err := db.ProjectConfig(ctx)
	if err != nil {
		return err
	}

	// we'll insert delete directive and remove fragment driven by a separate query
	statementWithKeys, err := conn.Prepare(`
		SELECT
			dl.id,
			dl.name,
			dl.node_type,
			MIN(tc.keys)                  AS keys,
			rd.id                         AS raw_document,
			MIN(op_doc.name)              AS document_name
		FROM discovered_lists dl
		JOIN documents doc        ON dl.document     = doc.id
		JOIN raw_documents rd     ON doc.raw_document = rd.id
		LEFT JOIN type_configs tc ON tc.name = dl.node_type
		LEFT JOIN documents op_doc ON op_doc.name = dl.name || $remove_suffix
		WHERE dl.name IS NOT '' AND dl.name IS NOT NULL
			AND op_doc.id IS NULL
			AND (rd.current_task = $task_id OR $task_id IS NULL)
			AND (doc.processed = false OR doc.processed IS NULL)
		GROUP BY
			dl.name, dl.node_type, rd.id
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer statementWithKeys.Finalize()
	err = db.BindStatement(statementWithKeys, map[string]any{
		"remove_suffix": graphql.ListOperationSuffixRemove,
	})
	if err != nil {
		return commit(plugins.WrapError(err))
	}

	err = db.StepStatement(ctx, statementWithKeys, func() {
		listName := statementWithKeys.GetText("name")
		typeName := statementWithKeys.GetText("node_type")
		keysStr := statementWithKeys.GetText("keys")
		rawDocument := statementWithKeys.GetText("raw_document")
		documentName := statementWithKeys.GetText("document_name")

		keys := []string{}
		if keysStr != "" {
			err = json.Unmarshal([]byte(keysStr), &keys)
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
		} else {
			keys = projectConfig.DefaultKeys
		}

		if ok := insertedDirectives[typeName]; !ok {
			// we need to insert a delete directive for each type that has a list
			err = db.ExecStatement(insertInternalDirectiveStmt, map[string]any{
				"name":        fmt.Sprintf("%s%s", typeName, graphql.ListOperationSuffixDelete),
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
			err = db.ExecStatement(insertDocument, map[string]any{
				"name":           fmt.Sprintf("%s%s", listName, graphql.ListOperationSuffixRemove),
				"kind":           "fragment",
				"type_condition": typeName,
				"raw_document":   rawDocument,
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}

			fragmentID := conn.LastInsertRowID()

			// insert the document dependency
			err = db.ExecStatement(insertDocumentDependency, map[string]any{
				"document":   fragmentID,
				"depends_on": documentName,
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}

			// now we need a selection for each key and a ref that links it up to the parent
			allKeys := append(keys, "__typename")

			for _, key := range allKeys {
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
					"internal":   true,
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
