package artifacts

import (
	"context"
	"sync"

	"github.com/spf13/afero"
	"zombiezen.com/go/sqlite"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins"
)

func GenerateDocumentArtifacts(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	conn *sqlite.Conn,
	collectedDefinitions *CollectedDocuments,
	fs afero.Fs,
	sortKeys bool,
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
	docNames := make(chan string, len(collectedDefinitions.TaskDocuments))

	// a wait group to orchestrate the draining
	var wg sync.WaitGroup

	// start consuming names off of the channel
	for range 1 {
		wg.Add(1)
		go func() {
			defer wg.Done()

			// we'll need to look some things up while generating artifacts so grab a connection
			// for this routine
			conn, err := db.Take(ctx)
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
			defer db.Put(conn)

			for name := range docNames {
				// we need to generate the flattened selection
				selection, err := FlattenSelection(
					ctx,
					collectedDefinitions,
					name,
					config.DefaultFragmentMasking,
					sortKeys,
				)
				if err != nil {
					errs.Append(plugins.WrapError(err))
					continue
				}

				// generate the selection artifact
				err = writeSelectionDocument(
					ctx,
					fs,
					db,
					conn,
					collectedDefinitions,
					name,
					selection,
					sortKeys,
				)
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
	for _, doc := range collectedDefinitions.TaskDocuments {
		// push the name from the query result onto the channel for processing
		docNames <- doc
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
