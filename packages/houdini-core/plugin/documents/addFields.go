package documents

import (
	"context"
	"fmt"

	"code.houdinigraphql.com/plugins"
)

// AddDocumentFields adds necessary documents to the selections of the user's project including
// keys and __typename for every object
func AddDocumentFields[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig]) error {
	conn, err := db.Take(ctx)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer db.Put(conn)

	// to pull this off we have to perform 2 different inserts that are driven by looking
	// at selections_ref (to indentify a selection that has sub-selections) and joining it
	// to type_fields through the parent_id column. once we have the types that are used
	// as parents, we can look at the config and type_config tables to determine which keys
	// need to be added
	fieldsToInsert, err := conn.Prepare(`
		WITH default_config AS (
			SELECT default_keys
			FROM config
			LIMIT 1
		),

		base AS (
			SELECT DISTINCT
				sr.parent_id AS object_selection_id,
				sr.document AS doc_id,
				CASE
					WHEN s.kind = 'inline_fragment' THEN s.field_name
					ELSE tf.type
				END AS parent_type
			FROM selection_refs sr
			JOIN selections s ON sr.parent_id = s.id
			LEFT JOIN type_fields tf ON s.type = tf.id
			JOIN types t ON t.name = (
				CASE
					WHEN s.kind = 'inline_fragment' THEN s.field_name
					ELSE tf.type
				END
			)
			JOIN documents d ON sr.document = d.id
			JOIN raw_documents rd ON d.raw_document = rd.id
			WHERE sr.parent_id IS NOT NULL
			AND t.operation = false
			AND (rd.current_task = $task_id OR $task_id IS NULL)
		),

		keys_union AS (
			-- Always include __typename.
			SELECT '__typename' AS key_name, parent_type, object_selection_id, doc_id
			FROM base

			UNION

			-- Use type-specific keys when available.
			SELECT j.value AS key_name, b.parent_type, b.object_selection_id, b.doc_id
			FROM base b
			JOIN type_configs tc ON tc.name = b.parent_type
			CROSS JOIN json_each(tc.keys) j

			UNION

			-- Use default keys only if no type-specific keys exist for that type.
			SELECT j.value AS key_name, b.parent_type, b.object_selection_id, b.doc_id
			FROM base b
				CROSS JOIN default_config
				CROSS JOIN json_each(default_config.default_keys) j
				LEFT JOIN type_configs tc ON tc.name = b.parent_type
			WHERE tc.name IS NULL
		)

		-- Only keep keys that actually exist in type_fields
		SELECT keys_union.*
		FROM keys_union
		JOIN type_fields tf ON tf.parent = keys_union.parent_type AND tf.name = keys_union.key_name
	`)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer fieldsToInsert.Finalize()

	// we need statments to insert selections and selection refs
	insertSelection, err := conn.Prepare("INSERT INTO selections (field_name, alias, kind, type) VALUES ($field_name, $alias, $kind, $type)")
	if err != nil {
		return plugins.WrapError(err)
	}
	defer insertSelection.Finalize()
	insertSelectionRef, err := conn.Prepare("INSERT INTO selection_refs (parent_id, child_id, document, row, column, path_index) VALUES ($parent_id, $child_id, $document, $row, $column, $path_index)")
	if err != nil {
		return plugins.WrapError(err)
	}
	defer insertSelectionRef.Finalize()

	errs := &plugins.ErrorList{}

	// every row of the above query is a selection that needs to be inserted
	err = db.StepStatement(ctx, fieldsToInsert, func() {
		field := fieldsToInsert.ColumnText(0)
		parentType := fieldsToInsert.ColumnText(1)
		selectionID := fieldsToInsert.ColumnInt64(2)
		docID := fieldsToInsert.ColumnInt64(3)

		// insert the selection
		err := db.ExecStatement(insertSelection, map[string]interface{}{
			"field_name": field,
			"alias":      field,
			"kind":       "field",
			"type":       fmt.Sprintf("%s.%s", parentType, field),
		})
		if err != nil {
			errs.Append(plugins.WrapError(err))
			return
		}

		// and now we need to create the selection ref
		err = db.ExecStatement(insertSelectionRef, map[string]interface{}{
			"parent_id":  selectionID,
			"child_id":   conn.LastInsertRowID(),
			"document":   docID,
			"row":        0,
			"column":     0,
			"path_index": 0,
		})
		if err != nil {
			errs.Append(plugins.WrapError(err))
			return
		}

		fmt.Println("inserting selection ref", map[string]interface{}{
			"parent_id":  selectionID,
			"child_id":   conn.LastInsertRowID(),
			"document":   docID,
			"row":        0,
			"column":     0,
			"path_index": 0,
		})
	})
	if err != nil {
		return plugins.WrapError(err)
	}
	// if we collcted any errors along the way, return them
	if errs.Len() > 0 {
		return errs
	}
	return nil
}
