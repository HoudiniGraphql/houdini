package artifacts

import (
	"context"
	"path"
	"strings"
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
) ([]string, error) {
	// load the project config to look up the default masking
	config, err := db.ProjectConfig(ctx)
	if err != nil {
		return nil, err
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

	// we need to build up the filepaths we generate
	filepaths := ThreadSafeSlice[string]{}

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
				fp, err := writeSelectionDocument(
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

				filepaths.Append(fp)

				// generate the artifacts for this document
				fp, err = generateTypescriptDefinition(collectedDefinitions, name, selection)
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
		return nil, errs
	}

	// if we got this far then we didn't have any errors
	// before we return the thread safe slice, we need to convert the filepaths to import paths
	importPaths := []string{}
	for _, fp := range filepaths.items {
		importPaths = append(
			importPaths,
			// to generate the import path, we can assume that the runtime directory is available
			// as the $houdini alias
			strings.Replace(
				fp,
				path.Join(config.ProjectRoot, config.RuntimeDir),
				"$houdini",
				1,
			),
		)
	}
	return importPaths, nil
}

// ThreadSafeSlice wraps a standard slice with a mutex for concurrent access.
type ThreadSafeSlice[T any] struct {
	mu    sync.Mutex
	items []T
}

// Append adds an item to the slice in a thread-safe manner.
func (ts *ThreadSafeSlice[T]) Append(item T) {
	ts.mu.Lock()         // Acquire a write lock
	defer ts.mu.Unlock() // Release the lock when the function returns
	ts.items = append(ts.items, item)
}

// Get returns the item at the specified index in a thread-safe manner.
func (ts *ThreadSafeSlice[T]) Get(index int) (T, bool) {
	ts.mu.Lock() // Acquire a read/write lock (for simplicity, a Mutex is used here)
	defer ts.mu.Unlock()
	if index >= 0 && index < len(ts.items) {
		return ts.items[index], true
	}
	var zero T
	return zero, false
}

// Len returns the length of the slice in a thread-safe manner.
func (ts *ThreadSafeSlice[T]) Len() int {
	ts.mu.Lock() // Acquire a read/write lock
	defer ts.mu.Unlock()
	return len(ts.items)
}
