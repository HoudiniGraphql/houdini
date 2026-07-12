package plugin

import (
	"context"

	"code.houdinigraphql.com/plugins"
)

// BeforeValidate removes generated documents before validation runs. On a fresh
// database this is (almost) a no-op: generation (list operations, pagination
// variants, refetch queries, argument variants) happens in AfterValidate, after
// every rule has already run. But long-lived databases (the language server, the
// dev server's HMR loop) re-validate with the previous run's generated documents
// still present, and the validation rules were never designed to see them: a
// @plural fragment spread copied into a list operation fragment sits at the
// document root, a pagination variant carries its arguments as variables, and both
// produce phantom errors attributed to the user's file. Deleting them here
// restores the fresh-run invariant; AfterValidate recreates them from the
// validated state.
//
// Two exceptions to "delete everything generated":
//   - inline component-field fragments are created at load time (AfterExtract),
//     not by AfterValidate — deleting them would leave the selections that
//     TransformFields rewrites pointing at nothing
//   - on task-scoped runs, other files' generated documents must survive: only
//     the task's documents get regenerated afterwards
func (p *HoudiniCore) BeforeValidate(ctx context.Context) error {
	conn, err := p.DB.Take(ctx)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer p.DB.Put(conn)

	// ExecStatement doesn't auto-bind $task_id from the context the way the
	// Step-query helpers do, so resolve it explicitly
	var taskID any
	if id := plugins.TaskIDFromContext(ctx); id != nil {
		taskID = *id
	}

	deleteGenerated, err := conn.Prepare(`
		DELETE FROM documents
		WHERE generated = true
		  AND name NOT LIKE '\_\_componentField\_\_%' ESCAPE '\'
		  AND (
			$task_id IS NULL
			OR raw_document IN (SELECT id FROM raw_documents WHERE current_task = $task_id)
		  )
	`)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer deleteGenerated.Finalize()

	if err := p.DB.ExecStatement(deleteGenerated, map[string]any{"task_id": taskID}); err != nil {
		return plugins.WrapError(err)
	}

	// the fragment-argument transform rewrites user spreads to point at its variant
	// documents (UserInfo_<hash>) and records the original name in fragment_ref.
	// the variants were just deleted, so restore any spread whose target is gone —
	// otherwise validation reports the user's own spread as an unknown fragment
	// (same protocol as reset_file_documents in houdini-lsp and the HMR handler)
	restoreSpreads, err := conn.Prepare(`
		UPDATE selections AS s
		SET field_name = s.fragment_ref
		WHERE s.fragment_ref IS NOT NULL
		  AND s.kind = 'fragment'
		  AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.name = s.field_name)
	`)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer restoreSpreads.Finalize()

	if err := p.DB.ExecStatement(restoreSpreads, nil); err != nil {
		return plugins.WrapError(err)
	}

	// deleting the documents cascades their selection_refs; sweep selections that
	// no longer participate in any document so they don't accumulate across runs
	deleteOrphans, err := conn.Prepare(`
		DELETE FROM selections
		WHERE NOT EXISTS (SELECT 1 FROM selection_refs WHERE parent_id = selections.id)
		  AND NOT EXISTS (SELECT 1 FROM selection_refs WHERE child_id = selections.id)
	`)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer deleteOrphans.Finalize()

	if err := p.DB.ExecStatement(deleteOrphans, nil); err != nil {
		return plugins.WrapError(err)
	}

	return nil
}
