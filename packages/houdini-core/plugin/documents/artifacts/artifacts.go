package artifacts

import (
	"context"
	"runtime"
	"sync"

	"zombiezen.com/go/sqlite"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins"
)

func GenerateDocumentArtifacts(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	conn *sqlite.Conn,
	collectedDefinitions map[string]*CollectedDocument,
) error {
	// load the project config to look up the default masking
	config, err := db.ProjectConfig(ctx)
	if err != nil {
		return err
	}

	// there are a few things that we need to generate for each document:
	// - the selection artifact
	// - typescript types

	// we already have the selections collection so we just need the name of every document
	// in the current task

	// a place to collect errors
	errs := &plugins.ErrorList{}

	// a channel to push document names onto
	docNames := make(chan string, len(collectedDefinitions))

	// a wait group to orchestrate the draining
	var wg sync.WaitGroup

	// start consuming names off of the channel
	for range runtime.NumCPU() {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for name := range docNames {
				// we need to generate the flattened selection
				selection, err := FlattenSelection(
					ctx,
					collectedDefinitions,
					name,
					config.DefaultFragmentMasking,
					false,
				)
				if err != nil {
					errs.Append(plugins.WrapError(err))
					continue
				}

				// generate the selection artifact
				err = generateSelectionDocument(collectedDefinitions, name, selection)
				if err != nil {
					errs.Append(plugins.WrapError(err))
					continue
				}

				// generate the artifacts for this document
				err = generateTypescriptDefinition(collectedDefinitions, name, selection)
				if err != nil {
					errs.Append(plugins.WrapError(err))
					continue
				}
			}
		}()
	}

	// we need to look for every document in the current task
	query := `
    SELECT name
    FROM documents
      JOIN raw_documents on documents.raw_document = raw_documents.id
		WHERE raw_documents.current_task = $task_id OR $task_id IS NULL
  `
	err = db.StepQuery(ctx, query, map[string]any{}, func(stmt *sqlite.Stmt) {
		// push the name from the query result onto the channel for processing
		docNames <- stmt.GetText("name")
	})
	if err != nil {
		close(docNames)
		return err
	}

	// if we got this far then we're done processing the database so let's signal the workers
	// that no more names are coming
	close(docNames)

	// wait for the workers to finish
	wg.Wait()

	// if we have any errors we need to return them
	if errs.Len() > 0 {
		return errs
	}

	// if we got this far then we didn't have any errors
	return nil
}
