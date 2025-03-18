package lists

import (
	"context"
	"encoding/json"
	"fmt"

	"zombiezen.com/go/sqlite/sqlitex"

	"code.houdinigraphql.com/packages/houdini-core/plugin/schema"
	"code.houdinigraphql.com/plugins"
)

func InsertOperationDocuments[PluginConfig any](
	ctx context.Context,
	db plugins.DatabasePool[PluginConfig],
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
	insertStatement, err := conn.Prepare(`
		SELECT name, type, node, raw_document
		FROM discovered_lists
			JOIN raw_documents ON raw_documents.id = discovered_lists.raw_document
		WHERE raw_documents.current_task = $task_id OR $task_id IS NULL
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertStatement.Finalize()

	err = db.StepStatement(ctx, insertStatement, func() {
		name := insertStatement.ColumnText(0)
		listType := insertStatement.ColumnText(1)
		selectionParent := insertStatement.ColumnInt64(2)
		rawDocument := insertStatement.ColumnInt64(3)

		// if the document doesn't have a name then we dont need to generate documents for it
		if name == "" {
			return
		}

		// the first thing we have to do is insert a document with the correct names
		// and then we'll copy over the selection_refs from the selection_parent

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

			// copy the selection from the selection parent to the new document
			err = db.ExecStatement(copySelection, map[string]any{
				"document":         conn.LastInsertRowID(),
				"selection_parent": selectionParent,
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

		SELECT b.name, b.type, tc.keys, b.raw_document
		FROM base b
		JOIN type_configs tc ON tc.name = b.type

		UNION

		SELECT b.name, b.type, default_config.default_keys, b.raw_document
		FROM base b
			LEFT JOIN type_configs tc ON tc.name = b.type
			JOIN default_config
		WHERE tc.name IS NULL
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer statementWithKeys.Finalize()

	err = db.StepStatement(ctx, statementWithKeys, func() {
		listName := statementWithKeys.ColumnText(0)
		typeName := statementWithKeys.ColumnText(1)
		keysStr := statementWithKeys.ColumnText(2)
		rawDocument := statementWithKeys.ColumnInt64(3)

		keys := []string{}
		err = json.Unmarshal([]byte(keysStr), &keys)
		if err != nil {
			errs.Append(plugins.WrapError(err))
			return
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
