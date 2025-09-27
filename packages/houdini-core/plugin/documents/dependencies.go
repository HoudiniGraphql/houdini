package documents

import (
	"context"

	"code.houdinigraphql.com/plugins"
)

func LoadDocumentDependencies[PluginConfig any](
	ctx context.Context,
	db plugins.DatabasePool[PluginConfig],
	errs *plugins.ErrorList,
) {
	conn, err := db.Take(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer db.Put(conn)

	// prepare the insert query with ON CONFLICT IGNORE to prevent duplicates
	insertDependency, err := conn.Prepare(
		"INSERT OR IGNORE INTO document_dependencies (document, depends_on) VALUES ($document, $depends_on)",
	)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer insertDependency.Finalize()

	// for our purposes we need to look at every fragment used in every document along with
	// any fields that might be pulled in via component fields
	search, err := conn.Prepare(`
    SELECT
      selection_refs."document",
      COALESCE(component_fields.fragment, selections.field_name) as depends_on
    FROM selections
      JOIN selection_refs ON selection_refs.child_id = selections.id
      JOIN documents ON selection_refs.document = documents.id
      JOIN raw_documents ON documents.raw_document = raw_documents.id
      LEFT JOIN component_fields ON selections.type = component_fields.type_field
    WHERE
      (raw_documents.current_task = $task_id OR $task_id IS NULL)
      AND (
          selections.kind = 'fragment'
        OR
          (selections.kind = 'field' AND component_fields.id IS NOT NULL)
      )
  `)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer search.Finalize()

	// for every row that we find, we need to register a dependency
	err = db.StepStatement(ctx, search, func() {
		err = db.ExecStatement(insertDependency, map[string]any{
			"document":   search.GetInt64("document"),
			"depends_on": search.GetText("depends_on"),
		})
		if err != nil {
			errs.Append(plugins.WrapError(err))
		}
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
}
