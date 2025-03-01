package lists

import (
	"context"

	"code.houdinigraphql.com/plugins"
)

func InsertOperationDocuments[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig]) error {
	// during validation, we might have discovered lists that cause new documents to be inserted
	// into the database. we also need to insert internal directives so that we can strip them
	// from the final selection set

	conn, err := db.Take(ctx)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer db.Put(conn)

	// we need a query that copys the subselection for the list field
	// into a document
	copySelection, err := conn.Prepare(`
		INSERT
			INTO selection_refs (document, child_id, row, column)
		SELECT
			? AS document,
			child_id,
			row,
			column
		FROM selection_refs WHERE parent_id = ?
	`)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer copySelection.Finalize()

	insertDocument, err := conn.Prepare("INSERT INTO documents (name, raw_document, kind, type_condition) VALUES (?, ?, ?, ?)")
	if err != nil {
		return plugins.WrapError(err)
	}
	defer insertDocument.Finalize()

	// a statement to insert internal directives
	insertInternalDirectiveStmt, err := conn.Prepare("INSERT INTO directives (name, description, internal, visible) VALUES ($name, $description, true, true)")
	if err != nil {
		return plugins.WrapError(err)
	}
	defer insertInternalDirectiveStmt.Finalize()

	// we're done
	return nil
}
