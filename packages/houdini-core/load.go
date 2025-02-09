package main

import (
	"context"
	"log"
	"runtime"

	"code.houdinigraphql.com/plugins"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
	"golang.org/x/sync/errgroup"
)

type PendingQuery struct {
	Query string
	ID    int
}

// AfterExtract is called after all of the plugins have added their documents to the project.
// We'll use this plugin to parse each document and load it into the database.
func (p *HoudiniCore) AfterExtract(ctx context.Context) error {
	// we want to process the documents in parallel so we'll pull down from the database
	// in one goroutine and then pass it a pool of workers who will parse the documents
	// and insert them into the database

	// prepare the query we'll use to look for documents
	search, err := p.DB.Conn.Prepare("SELECT id, content FROM raw_documents")
	if err != nil {
		return err
	}
	defer search.Finalize()

	// create a buffered channel to hold queries.
	queries := make(chan PendingQuery, 100)
	wg, _ := errgroup.WithContext(ctx)

	// start a pool of workers to process the documents
	for i := 0; i < runtime.NumCPU(); i++ {
		wg.Go(func() error {
			// each goroutine needs its own database connection
			db, err := p.ConnectDB()
			if err != nil {
				return err
			}

			// consume queries until the channel is closed
			for query := range queries {
				// load the document into the database
				err := loadPendingQuery(db, query)
				if err != nil {
					return err
				}
			}

			// nothing went wrong
			return nil
		})
	}

	// consume rows from the database and send them to the workers
	for {
		// get the next row
		hasData, err := search.Step()
		if err != nil {
			return err
		}

		// if theres no more data to consume then we're done
		if !hasData {
			break
		}

		select {
		// send the query to the workers
		case queries <- PendingQuery{
			ID:    search.ColumnInt(0),
			Query: search.ColumnText(1),
		}:
			continue
		// if the context is cancelled, exit the loop.
		case <-ctx.Done():
			break
		}
	}

	// signal workers that no more queries are coming.
	close(queries)

	// wait for all workers to finish processing.
	if err := wg.Wait(); err != nil {
		log.Fatalf("processing terminated with error: %v", err)
	}

	// we're done
	return nil
}

func loadPendingQuery(db plugins.Database[PluginConfig], query PendingQuery) error {
	// parse the query
	_, err := parser.ParseQuery(&ast.Source{
		Input: query.Query,
	})
	if err != nil {
		return err
	}

	// fmt.Println(parsed)

	return nil
}
