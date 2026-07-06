package plugin

import (
	"context"

	"code.houdinigraphql.com/plugins"
)

// BeforeValidate removes generated documents before validation runs. On a fresh
// database this is a no-op: generation (list operations, pagination variants,
// refetch queries) happens in AfterValidate, after every rule has already run.
// But long-lived databases (the language server, the dev server's HMR loop)
// re-validate with the previous run's generated documents still present — and the
// validation rules were never designed to see them. A @plural fragment spread
// copied into a list operation fragment sits at the document root, a pagination
// variant carries its arguments as variables, and both produce phantom errors
// attributed to the user's file. Deleting them here (scoped to the current task,
// or everything on a full run) restores the fresh-run invariant; AfterValidate
// recreates them from the validated state.
func (p *HoudiniCore) BeforeValidate(ctx context.Context) error {
	conn, err := p.DB.Take(ctx)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer p.DB.Put(conn)

	statement, err := conn.Prepare(`
		DELETE FROM documents
		WHERE generated = true
		  AND (
			$task_id IS NULL
			OR raw_document IN (SELECT id FROM raw_documents WHERE current_task = $task_id)
		  )
	`)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer statement.Finalize()

	if err := p.DB.ExecStatement(statement, nil); err != nil {
		return plugins.WrapError(err)
	}

	return nil
}
