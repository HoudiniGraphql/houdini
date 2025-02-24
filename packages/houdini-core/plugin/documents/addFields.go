package documents

import (
	"context"

	"code.houdinigraphql.com/plugins"
)

// AddDocumentFields adds necessary documents to the selections of the user's project including
// keys and __typename for every object
func AddDocumentFields[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	conn, err := db.Take(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}

	// to pull this off we have to perform 2 different inserts that are driven by looking
	// at selections_ref (to indentify a selection that has sub-selections) and joining it
	// to type_fields through the parent_id column. once we have the types that are used
	// as parents, we can look at the config and type_config tables to determine which keys
	// need to be added
	fieldsToInsert, err := conn.Prepare(`
		-- look for distinct selection sets
		WITH base AS (
			SELECT DISTINCT
				sr.parent_id AS object_selection_id,
				sr.document AS doc_id,
				tf.type AS parent_type
			FROM selection_refs sr
				JOIN selections s ON sr.parent_id = s.id
				JOIN type_fields tf ON s.type = tf.id
				JOIN types t ON t.name = tf.parent AND t.kind = 'OBJECT'
				JOIN documents on selection_refs.document = documents.id
				JOIN raw_documents on documents.raw_document = raw_documents.id
			WHERE sr.parent_id IS NOT NULL AND t.operation = false
				AND raw_documents.current_task = $task_id OR $task_id IS NULL
		),

		-- build up the keys that need to be inserted for each distinct selection set we found
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
				CROSS JOIN json_each((SELECT default_keys FROM config LIMIT 1)) j
				LEFT JOIN type_configs tc ON tc.name = b.parent_type
			WHERE tc.name IS NULL
		)

		-- Only keep keys that actually exist in type_fields
		SELECT ok.*
		FROM keys_union ok
		JOIN type_fields tf  ON tf.parent = ok.parent_type AND tf.name = ok.key_name
	`)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}

	// we need statments to insert selections and selection refs
	_, err = conn.Prepare("INSERT INTO selections (field_name, alias, kind, type) VALUES ($field_name, $alias, $kind, $type)")
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	_, err = conn.Prepare("INSERT INTO selection_refs (parent_id, child_id, document, row, column, path_index) VALUES ($parent_id, $child_id, $document, $row, $column, $path_index)")
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}

	// every row of the above query is a selection that needs to be inserted
	err = db.StepStatement(ctx, fieldsToInsert, func() {

	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
}
