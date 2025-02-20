package documents

import (
	"context"
	"fmt"
	"runtime"
	"sync"

	"code.houdinigraphql.com/packages/houdini-core/glob"
	"code.houdinigraphql.com/plugins"
	"github.com/spf13/afero"
	"golang.org/x/sync/errgroup"
)

// Walk is responsible for walking down the project directory structure and
// extracting the raw graphql documents from the files. These files will be parsed in a
// later step to allow for other plugins to find additional documents we don't know about
func Walk[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], fs afero.Fs) error {
	// load the project config
	config, err := db.ProjectConfig(ctx)
	if err != nil {
		return err
	}

	// build a glob walker that we can use to find all of the files
	walker := glob.NewWalker()
	for _, pattern := range config.Include {
		walker.AddInclude(pattern)
	}
	for _, pattern := range config.Exclude {
		walker.AddExclude(pattern)
	}

	// channels for file paths and discovered documents
	filePathsCh := make(chan string, 100)
	resultsCh := make(chan DiscoveredDocument, 100)

	// create a cancellable context and an errgroup
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// we have a few goroutines that will be running to process the files so we'll
	// wrap them in an errgroup to make sure we can cancel them all if something goes wrong
	g, ctx := errgroup.WithContext(ctx)

	// a slice to collect errors while extracting
	errs := &plugins.ErrorList{}

	// file walker goroutine
	g.Go(func() error {
		// start the walk; each file path found is sent into filePathsCh.
		err := walker.Walk(ctx, fs, config.ProjectRoot, func(fp string) error {
			// in case the context is canceled, stop early.
			select {
			case filePathsCh <- fp:
				return nil
			case <-ctx.Done():
				return ctx.Err()
			}
		})
		// whether or not there was an error, close the channel
		// to signal that no more file paths will be sent.
		close(filePathsCh)

		// collect the error
		if err != nil {
			errs.Append(plugins.WrapError(fmt.Errorf("encountered error while looking for documents: %v", err)))
		}

		// we're done
		return nil
	})

	// file processing workers
	var procWG sync.WaitGroup
	for i := 0; i < runtime.NumCPU(); i++ {
		procWG.Add(1)
		go func() {
			defer procWG.Done()
			// read from filePathsCh until it is closed.
			for {
				select {
				case fp, ok := <-filePathsCh:
					if !ok {
						return // channel closed
					}
					// process the file
					if err := ProcessFile(fs, fp, resultsCh); err != nil {
						errs.Append(err)
					}
				case <-ctx.Done():
					return
				}
			}
		}()
	}

	// database writer goroutine
	g.Go(func() error {
		// build a connection to the database.
		conn, err := db.Take(ctx)
		if err != nil {
			errs.Append(plugins.WrapError(fmt.Errorf("failed to connect to db: %w", err)))
			return nil
		}
		defer db.Put(conn)

		// prepare the insert statements.
		insertRawStatement, err := conn.Prepare("INSERT INTO raw_documents (filepath, content, offset_column, offset_line) VALUES (?, ?, ?, ?)")
		if err != nil {
			errs.Append(plugins.WrapError(fmt.Errorf("failed to prepare statement: %w", err)))
			return nil
		}
		defer insertRawStatement.Finalize()
		insertComponentField, err := conn.Prepare("INSERT INTO component_fields (document, prop, inline) VALUES (?, ?, true)")
		if err != nil {
			errs.Append(plugins.WrapError(fmt.Errorf("failed to prepare statement: %w", err)))
			return nil
		}
		defer insertComponentField.Finalize()

		// consume discovered documents from resultsCh and write them to the database.
		for doc := range resultsCh {
			err := db.ExecStatement(insertRawStatement, doc.FilePath, doc.Content, doc.OffsetColumn, doc.OffsetRow)
			if err != nil {
				errs.Append(plugins.WrapError(fmt.Errorf("failed to insert raw document: %v", err)))
				return nil
			}
			documentID := conn.LastInsertRowID()

			// if the document has a component field prop, let's register it now as well.
			if doc.Prop != "" {
				err = db.ExecStatement(insertComponentField, documentID, doc.Prop)
				if err != nil {
					errs.Append(plugins.WrapError(fmt.Errorf("failed to insert component field: %v", err)))
					return nil
				}
			}
		}

		// we're done
		return nil
	})

	// once all file-processing workers are done, close the results channel. this will signal the gourotine above to finish
	go func() {
		procWG.Wait()
		close(resultsCh)
	}()

	// wait for the error group's goroutines (walker and writer) to finish.
	// any error returned will be propagated here.
	if err := g.Wait(); err != nil {
		return err
	}

	// if there were any errors during the extraction process, return them.
	if errs.Len() > 0 {
		return errs
	}

	// if we got here, everything completed successfully.
	return nil
}
