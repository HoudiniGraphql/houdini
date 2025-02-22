package lists

import (
	"context"

	"code.houdinigraphql.com/plugins"
)

func InsertListOperationDocuments[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	// during validation, we might have discovered lists that cause new documents to be inserted
	// into the database
	conn, err := db.Take(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
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
		errs.Append(plugins.WrapError(err))
		return
	}
	defer copySelection.Finalize()

	insertDocument, err := conn.Prepare("INSERT INTO documents (name, raw_document, kind, type_condition) VALUES (?, ?, ?, ?)")
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer insertDocument.Finalize()

}
