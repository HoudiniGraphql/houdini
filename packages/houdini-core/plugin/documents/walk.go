package documents

import (
	"context"
	"fmt"
	"path/filepath"
	"sync"

	"github.com/spf13/afero"
	"golang.org/x/sync/errgroup"

	"code.houdinigraphql.com/plugins/glob"
	"code.houdinigraphql.com/plugins"
)

// Walk is responsible for walking down the project directory structure and
// extracting the raw graphql documents from the files. These files will be parsed in a
// later step to allow for other plugins to find additional documents we don't know about
func Walk[PluginConfig any](
	ctx context.Context,
	db plugins.DatabasePool[PluginConfig],
	fs afero.Fs,
) error {
	// load the project config
	config, err := db.ProjectConfig(ctx)
	if err != nil {
		return err
	}

	// build a glob walker that we can use to find all of the files
	walker := glob.NewWalker()
	for _, pattern := range config.Include {
		err = walker.AddInclude(pattern)
		if err != nil {
			return err
		}
	}
	for _, pattern := range config.Exclude {
		err = walker.AddExclude(pattern)
		if err != nil {
			return err
		}
	}

	// we might also need to include static runtimes
	conn, err := db.Take(ctx)
	if err != nil {
		return err
	}
	defer db.Put(conn)
	pluginSearch, err := conn.Prepare(`
		SELECT * from plugins WHERE include_static_runtime IS NOT NULL
	`)
	if err != nil {
		return err
	}
	defer pluginSearch.Finalize()
	err = db.StepStatement(ctx, pluginSearch, func() {
		name := pluginSearch.GetText("name")
		// The walker computes file paths relative to config.ProjectRoot, so the
		// include pattern must also be relative — not the absolute path returned
		// by PluginStaticRuntimeDirectory.
		relDir := filepath.ToSlash(filepath.Join(config.RuntimeDir, "plugins", name, "static"))
		err = walker.AddInclude(relDir + "/**")
	})
	if err != nil {
		return err
	}

	// The walker returns paths relative to config.ProjectRoot, but ProcessFile opens them
	// from the filesystem. Use a BasePathFs so that opening a relative path correctly
	// resolves against the project root on any afero backend (including MemMapFs in tests).
	rootedFs := afero.NewBasePathFs(fs, config.ProjectRoot)

	// and extract the documents that the walker finds. a full walk sees every
	// included file, so any leftover row is stale regardless of which file it
	// came from
	return extractDocuments(ctx, db, rootedFs, func(filePathsCh chan string) error {
		return walker.Walk(ctx, fs, config.ProjectRoot, func(fp string) error {
			// in case the context is canceled, stop early.
			select {
			case filePathsCh <- fp:
				return nil
			case <-ctx.Done():
				return ctx.Err()
			}
		})
	}, func(string) bool { return true })
}

func ExtractFromFilepaths[PluginConfig any](
	ctx context.Context,
	db plugins.DatabasePool[PluginConfig],
	fs afero.Fs,
	files []string,
) error {
	// load the project config
	config, err := db.ProjectConfig(ctx)
	if err != nil {
		return err
	}
	// build a glob walker that we can use to find all of the files
	walker := glob.NewWalker()
	for _, pattern := range config.Include {
		err = walker.AddInclude(pattern)
		if err != nil {
			return err
		}
	}
	for _, pattern := range config.Exclude {
		err = walker.AddExclude(pattern)
		if err != nil {
			return err
		}
	}

	root := config.ProjectRoot
	rootedFs := afero.NewBasePathFs(fs, root)

	// only rows belonging to the walked files can be considered stale — every
	// other file's rows simply weren't rediscovered because we didn't look
	included := map[string]bool{}

	// and extract the documents that the walker finds
	return extractDocuments(ctx, db, rootedFs, func(filePathsCh chan string) error {
		for _, fp := range files {
			rel, err := filepath.Rel(root, fp)
			if err != nil {
				return err
			}
			if !walker.Matches(rel) {
				continue
			}
			rel = filepath.ToSlash(rel)
			included[rel] = true
			select {
			case filePathsCh <- rel:
			case <-ctx.Done():
				return ctx.Err()
			}
		}

		return nil
	}, func(fp string) bool { return included[fp] })
}

func extractDocuments[PluginConfig any](
	ctx context.Context,
	db plugins.DatabasePool[PluginConfig],
	fs afero.Fs,
	walk func(chan string) error,
	// whether a leftover row for this filepath is stale (its file was walked but
	// the document wasn't rediscovered) — deleted files and changed contents
	stale func(string) bool,
) error {
	// channels for file paths and discovered documents
	filePathsCh := make(chan string, 100000)
	resultsCh := make(chan DiscoveredDocument, 100000)

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
		err := walk(filePathsCh)
		// whether or not there was an error, close the channel
		// to signal that no more file paths will be sent.
		close(filePathsCh)

		// collect the error
		if err != nil {
			errs.Append(
				plugins.WrapError(
					fmt.Errorf("encountered error while looking for documents: %v", err),
				),
			)
		}

		// we're done
		return nil
	})

	// file processing workers
	var procWG sync.WaitGroup
	for range 1 {
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

		// prepare the necessary statements.
		insertRawStatement, err := conn.Prepare(
			"INSERT INTO raw_documents (filepath, content, offset_column, offset_line) VALUES ($filepath, $content, $column, $row)",
		)
		if err != nil {
			errs.Append(plugins.WrapError(fmt.Errorf("failed to prepare statement: %w", err)))
			return nil
		}
		defer insertRawStatement.Finalize()

		deleteRawDocument, err := conn.Prepare(`
      DELETE FROM raw_documents WHERE id = $id
    `)
		if err != nil {
			errs.Append(plugins.WrapError(fmt.Errorf("failed to prepare statement: %w", err)))
			return nil
		}
		defer deleteRawDocument.Finalize()

		// foreign keys aren't enforced on this connection, so dependent documents
		// have to be removed explicitly alongside their raw document
		deleteDocuments, err := conn.Prepare(`
      DELETE FROM documents WHERE raw_document = $id
    `)
		if err != nil {
			errs.Append(plugins.WrapError(fmt.Errorf("failed to prepare statement: %w", err)))
			return nil
		}
		defer deleteDocuments.Finalize()

		rawDocumentSearch, err := conn.Prepare(
			`SELECT id, content, filepath, offset_line, offset_column from raw_documents`,
		)
		if err != nil {
			errs.Append(plugins.WrapError(fmt.Errorf("failed to prepare statement: %w", err)))
			return nil
		}
		defer rawDocumentSearch.Finalize()

		insertComponentField, err := conn.Prepare(
			"INSERT INTO component_fields (document, prop, inline, type_field) VALUES ($document, $prop, true, $type_field)",
		)
		if err != nil {
			errs.Append(plugins.WrapError(fmt.Errorf("failed to prepare statement: %w", err)))
			return nil
		}
		defer insertComponentField.Finalize()

		// before we start consuming new documents let's look at the current state of the raw_documents table
		// and build up a mapping from filepath -> content -> id
		// if there are entries left in this mapping then we need to delete the IDs
		type KnownDoc struct {
			Content string
			Row     int64
			Column  int64
		}
		unknown := map[string]map[KnownDoc]int64{}
		db.StepStatement(ctx, rawDocumentSearch, func() {
			filepath := rawDocumentSearch.GetText("filepath")
			id := rawDocumentSearch.GetInt64("id")
			doc := KnownDoc{
				Content: rawDocumentSearch.GetText("content"),
				Row:     rawDocumentSearch.GetInt64("offset_line"),
				Column:  rawDocumentSearch.GetInt64("offset_column"),
			}

			if _, ok := unknown[filepath]; !ok {
				unknown[filepath] = map[KnownDoc]int64{}
			}

			unknown[filepath][doc] = id
		})

		// consume discovered documents from resultsCh and write them to the database.
		for doc := range resultsCh {
			// we discovered a document, remove it from the list of unknowns
			if _, ok := unknown[doc.FilePath]; ok {
				docID := KnownDoc{
					Content: doc.Content,
					Row:     int64(doc.OffsetRow),
					Column:  int64(doc.OffsetColumn),
				}
				// if we already know the document, we can skip it
				if _, ok := unknown[doc.FilePath][docID]; ok {
					delete(unknown[doc.FilePath], docID)
					continue
				}
			}

			err := db.ExecStatement(insertRawStatement, map[string]any{
				"filepath": doc.FilePath,
				"content":  doc.Content,
				"row":      doc.OffsetRow,
				"column":   doc.OffsetColumn,
			})
			if err != nil {
				errs.Append(plugins.WrapError(fmt.Errorf("failed to insert raw document: %v", err)))
				return nil
			}
			documentID := conn.LastInsertRowID()

			// if the document has a component field prop, let's register it now as well.
			if doc.Prop != "" {
				err = db.ExecStatement(insertComponentField, map[string]any{
					"document": documentID,
					"prop":     doc.Prop,
				})
				if err != nil {
					errs.Append(
						plugins.WrapError(fmt.Errorf("failed to insert component field: %v", err)),
					)
					return nil
				}
			}
		}

		// anything left in the mapping is a raw document whose file no longer
		// produces it — the file was deleted or its contents changed. remove the
		// stale rows (and their documents) so they stop participating in
		// validation and generation.
		for path, docs := range unknown {
			if !stale(path) {
				continue
			}
			for _, id := range docs {
				if err := db.ExecStatement(deleteDocuments, map[string]any{"id": id}); err != nil {
					errs.Append(plugins.WrapError(fmt.Errorf("failed to delete stale documents: %v", err)))
					return nil
				}
				if err := db.ExecStatement(deleteRawDocument, map[string]any{"id": id}); err != nil {
					errs.Append(plugins.WrapError(fmt.Errorf("failed to delete stale raw document: %v", err)))
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
