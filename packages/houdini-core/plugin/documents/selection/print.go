package selection

import (
	"context"
	"fmt"
	"runtime"
	"sync"

	"zombiezen.com/go/sqlite"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins"
)

func EnsureDocumentsPrinted(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	conn *sqlite.Conn,
	collectedDocuments map[string]*CollectedDocument,
) error {
	// we need to make sure that every document in the current task gets an updated stringified
	// version
	conn, err := db.Take(ctx)
	if err != nil {
		return err
	}
	defer db.Put(conn)

	// the documents we care about are those that fall in the current task
	documentSearch, err := conn.Prepare(`
    SELECT documents.name
    FROM documents 
      JOIN raw_documents ON documents.raw_document = raw_documents.id
    WHERE (raw_documents.current_task = $task_id OR $task_id is null)
  `)
	if err != nil {
		return plugins.WrapError(err)
	}

	// we want to parallelize the printing so we need a channel to push relevant document names
	// that we discover are part of the task
	docCh := make(chan string, len(collectedDocuments))
	errCh := make(chan *plugins.Error, len(collectedDocuments))
	var wg sync.WaitGroup
	for range runtime.NumCPU() {
		wg.Add(1)
		go printDocWorker(ctx, db, &wg, docCh, errCh, collectedDocuments)
	}

	// walk through the documents that are part of the current task
	err = db.StepStatement(ctx, documentSearch, func() {
		docCh <- documentSearch.ColumnText(0)
	})
	if err != nil {
		return plugins.WrapError(err)
	}

	// close the doc channel since no more results will be sent
	close(docCh)

	// wait for every document to be printed
	wg.Wait()

	// close the error channel since no more errors will be sent.
	close(errCh)

	return nil
}

func printDocWorker(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	wg *sync.WaitGroup,
	docChan <-chan string,
	errChan chan<- *plugins.Error,
	collectedDocuments map[string]*CollectedDocument,
) {
	// when we're done we need to signal the wait group
	defer wg.Done()

	// every worker needs a connection to the database
	conn, err := db.Take(ctx)
	if err != nil {
		errChan <- plugins.WrapError(err)
		return
	}
	defer db.Put(conn)

	// we need a statement to update the document
	update, err := conn.Prepare(`
    UPDATE documents SET printed = $printed WHERE name = $name
  `)
	if err != nil {
		errChan <- plugins.WrapError(err)
		return
	}
	defer update.Finalize()

	// consume document names from the channel
	for docName := range docChan {
		// look up the definition of the document we need to print
		doc, ok := collectedDocuments[docName]
		if !ok {
			errChan <- plugins.Errorf("document %v not found in collected documents", docName)
			continue
		}

		// start building up the string
		printed := fmt.Sprintf(`%s %s`, doc.Kind, doc.Name)

		// add fragment type conditions
		if doc.TypeCondition != nil {
			printed += fmt.Sprintf(` on %s`, *doc.TypeCondition)
		}

		// add document directives
		for _, directive := range doc.Directives {
			printed += fmt.Sprintf(` @%s%s `, directive.Name, printArguments(directive.Arguments))
		}

		// update the document with the printed version
		err = db.ExecStatement(update, map[string]any{"name": doc.Name, "printed": printed})
		if err != nil {
			errChan <- plugins.WrapError(err)
			continue
		}
	}
}

func printArguments(args []*CollectedArgument) string {
	if len(args) == 0 {
		return ""
	}
	result := "("

	// add directive arguments
	for _, arg := range args {
		result += fmt.Sprintf(`%s: %s`, arg.Name, printValue(arg.Value))
	}

	result += ")"

	return result
}

func printValue(value *CollectedArgumentValue) string {
	return ""
}
