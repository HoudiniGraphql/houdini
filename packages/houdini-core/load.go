package main

import (
	"context"
	"log"
	"runtime"

	"code.houdinigraphql.com/plugins"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
	"golang.org/x/sync/errgroup"
	"zombiezen.com/go/sqlite"
	"zombiezen.com/go/sqlite/sqlitex"
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
			// for now, we'll establish a database connection for each query so we can manage our prepared statements
			db, err := p.ConnectDB()
			if err != nil {
				return err
			}

			// each query gets wrapped in its own transaction
			close := sqlitex.Transaction(db.Conn)
			commit := func(err error) {
				close(&err)
			}

			// our prepared statements
			insertDocument := db.Conn.Prep("INSERT INTO documents (name, raw_document, kind, type_condition) VALUES (?, ?, ?, ?)")
			defer insertDocument.Finalize()
			insertDocumentVariable := db.Conn.Prep("INSERT INTO operation_variables (document, name, type, default_value) VALUES (?, ?, ?, ?)")
			defer insertDocumentVariable.Finalize()
			insertSelection := db.Conn.Prep("INSERT INTO selections (field_name, alias, path_index, kind) VALUES (?, ?, ?, ?)")
			defer insertSelection.Finalize()
			insertSelectionArgument := db.Conn.Prep("INSERT INTO selection_arguments (selection_id, name, value) VALUES (?, ?, ?)")
			defer insertSelectionArgument.Finalize()
			insertSelectionRef := db.Conn.Prep("INSERT INTO selection_refs (parent_id, child_id, document) VALUES (?, ?, ?)")
			defer insertSelectionRef.Finalize()
			insertSelectionDirective := db.Conn.Prep("INSERT INTO selection_directives (selection_id, directive) VALUES (?, ?)")
			defer insertSelectionDirective.Finalize()
			insertSelectionDirectiveArgument := db.Conn.Prep("INSERT INTO selection_directive_arguments (parent, name, value) VALUES (?, ?, ?)")
			defer insertSelectionDirectiveArgument.Finalize()

			// consume queries until the channel is closed
			for query := range queries {
				// load the document into the database
				err := p.loadPendingQuery(query, db, InsertStatements{
					InsertDocument:                   insertDocument,
					InsertDocumentVariable:           insertDocumentVariable,
					InsertSelection:                  insertSelection,
					InsertSelectionArgument:          insertSelectionArgument,
					InsertSelectionRef:               insertSelectionRef,
					InsertSelectionDirective:         insertSelectionDirective,
					InsertSelectionDirectiveArgument: insertSelectionDirectiveArgument,
				})
				if err != nil {
					commit(err)
					return err
				}
			}

			// if we got this far, we're good to commit the transaction
			commit(nil)

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

type InsertStatements struct {
	InsertDocument                   *sqlite.Stmt
	InsertDocumentVariable           *sqlite.Stmt
	InsertSelection                  *sqlite.Stmt
	InsertSelectionRef               *sqlite.Stmt
	InsertSelectionArgument          *sqlite.Stmt
	InsertSelectionDirective         *sqlite.Stmt
	InsertSelectionDirectiveArgument *sqlite.Stmt
}

// loadPendingQuery parses the graphql query and inserts the ast into the database.
// it handles both operations and fragment definitions.
func (p *HoudiniCore) loadPendingQuery(query PendingQuery, db plugins.Database[PluginConfig], statements InsertStatements) error {
	// parse the query.
	parsed, err := parser.ParseQuery(&ast.Source{
		Input: query.Query,
	})
	if err != nil {
		return err
	}

	// process operations.
	for _, operation := range parsed.Operations {
		// insert the operation into the "documents" table.
		// for operations, we set type_condition to null.
		statements.InsertDocument.BindText(1, operation.Name)
		statements.InsertDocument.BindInt64(2, int64(query.ID))
		statements.InsertDocument.BindText(3, string(operation.Operation))
		statements.InsertDocument.BindNull(4)
		if err := db.ExecStatement(statements.InsertDocument); err != nil {
			return err
		}

		// insert any variable definitions.
		for _, variable := range operation.VariableDefinitions {
			statements.InsertDocumentVariable.BindText(1, operation.Name)
			statements.InsertDocumentVariable.BindText(2, variable.Variable)
			statements.InsertDocumentVariable.BindText(3, variable.Type.String())
			if variable.DefaultValue != nil {
				statements.InsertDocumentVariable.BindText(4, variable.DefaultValue.String())
			} else {
				statements.InsertDocumentVariable.BindNull(4)
			}
			if err := db.ExecStatement(statements.InsertDocumentVariable); err != nil {
				return err
			}
		}

		// walk the selection set for the operation.
		for i, sel := range operation.SelectionSet {
			if _, err := processSelection(sel, operation.Name, i, statements, db); err != nil {
				return err
			}
		}
	}

	// process fragment definitions.
	for _, fragment := range parsed.Fragments {
		// insert the fragment into "documents".
		statements.InsertDocument.BindText(1, fragment.Name)
		statements.InsertDocument.BindInt64(2, int64(query.ID))
		// for fragments, the kind is "fragment".
		statements.InsertDocument.BindText(3, "fragment")
		if fragment.TypeCondition != "" {
			statements.InsertDocument.BindText(4, fragment.TypeCondition)
		} else {
			statements.InsertDocument.BindNull(4)
		}
		if err := db.ExecStatement(statements.InsertDocument); err != nil {
			return err
		}

		// walk the fragment's selection set.
		for i, sel := range fragment.SelectionSet {
			if _, err := processSelection(sel, fragment.Name, i, statements, db); err != nil {
				return err
			}
		}
	}

	return nil
}

// processselection recursively processes a selection (field, inline fragment, or fragment spread).
// it inserts a row into "selections" (now with a "kind" column) and then its arguments,
// directives, directive arguments, and any child selections.
func processSelection(sel ast.Selection, documentName string, index int, statements InsertStatements, db plugins.Database[PluginConfig]) (int64, error) {
	switch s := sel.(type) {

	// --- case 1. field ---
	case *ast.Field:
		// bind parameters for a field: name, alias, path_index, and kind ("field").
		statements.InsertSelection.BindText(1, s.Name)
		if s.Alias != "" {
			statements.InsertSelection.BindText(2, s.Alias)
		} else {
			statements.InsertSelection.BindNull(2)
		}
		statements.InsertSelection.BindInt64(3, int64(index))
		statements.InsertSelection.BindText(4, "field")
		if err := db.ExecStatement(statements.InsertSelection); err != nil {
			return 0, err
		}
		selectionID := db.Conn.LastInsertRowID()

		// insert field arguments.
		for _, arg := range s.Arguments {
			statements.InsertSelectionArgument.BindInt64(1, selectionID)
			statements.InsertSelectionArgument.BindText(2, arg.Name)
			statements.InsertSelectionArgument.BindText(3, arg.Value.String())
			if err := db.ExecStatement(statements.InsertSelectionArgument); err != nil {
				return 0, err
			}
		}

		// insert any directives on the field.
		for _, directive := range s.Directives {
			statements.InsertSelectionDirective.BindInt64(1, selectionID)
			statements.InsertSelectionDirective.BindText(2, directive.Name)
			if err := db.ExecStatement(statements.InsertSelectionDirective); err != nil {
				return 0, err
			}
			dirID := db.Conn.LastInsertRowID()
			for _, dArg := range directive.Arguments {
				statements.InsertSelectionDirectiveArgument.BindInt64(1, dirID)
				statements.InsertSelectionDirectiveArgument.BindText(2, dArg.Name)
				statements.InsertSelectionDirectiveArgument.BindText(3, dArg.Value.String())
				if err := db.ExecStatement(statements.InsertSelectionDirectiveArgument); err != nil {
					return 0, err
				}
			}
		}

		// process nested selections.
		for i, child := range s.SelectionSet {
			childID, err := processSelection(child, documentName, i, statements, db)
			if err != nil {
				return 0, err
			}
			statements.InsertSelectionRef.BindInt64(1, selectionID)
			statements.InsertSelectionRef.BindInt64(2, childID)
			statements.InsertSelectionRef.BindText(3, documentName)
			if err := db.ExecStatement(statements.InsertSelectionRef); err != nil {
				return 0, err
			}
		}
		return selectionID, nil

	// --- case 2. inline fragment ---
	case *ast.InlineFragment:
		// use the type condition if available; otherwise, default to "inline_fragment".
		fragType := s.TypeCondition
		if fragType == "" {
			fragType = "inline_fragment"
		}
		// bind parameters: field_name (type condition), alias (null), path_index, and kind ("inline_fragment").
		statements.InsertSelection.BindText(1, fragType)
		statements.InsertSelection.BindNull(2)
		statements.InsertSelection.BindInt64(3, int64(index))
		statements.InsertSelection.BindText(4, "inline_fragment")
		if err := db.ExecStatement(statements.InsertSelection); err != nil {
			return 0, err
		}
		selectionID := db.Conn.LastInsertRowID()

		// process directives on the inline fragment.
		for _, directive := range s.Directives {
			statements.InsertSelectionDirective.BindInt64(1, selectionID)
			statements.InsertSelectionDirective.BindText(2, directive.Name)
			if err := db.ExecStatement(statements.InsertSelectionDirective); err != nil {
				return 0, err
			}
			dirID := db.Conn.LastInsertRowID()
			for _, dArg := range directive.Arguments {
				statements.InsertSelectionDirectiveArgument.BindInt64(1, dirID)
				statements.InsertSelectionDirectiveArgument.BindText(2, dArg.Name)
				statements.InsertSelectionDirectiveArgument.BindText(3, dArg.Value.String())
				if err := db.ExecStatement(statements.InsertSelectionDirectiveArgument); err != nil {
					return 0, err
				}
			}
		}

		// recurse into nested selections.
		for i, child := range s.SelectionSet {
			childID, err := processSelection(child, documentName, i, statements, db)
			if err != nil {
				return 0, err
			}
			statements.InsertSelectionRef.BindInt64(1, selectionID)
			statements.InsertSelectionRef.BindInt64(2, childID)
			statements.InsertSelectionRef.BindText(3, documentName)
			if err := db.ExecStatement(statements.InsertSelectionRef); err != nil {
				return 0, err
			}
		}
		return selectionID, nil

	// --- case 3. fragment spread ---
	case *ast.FragmentSpread:
		// for fragment spreads, bind parameters with kind "fragment".
		// here we use the fragment's name as the field_name and set alias to null.
		statements.InsertSelection.BindText(1, s.Name)
		statements.InsertSelection.BindNull(2)
		statements.InsertSelection.BindInt64(3, int64(index))
		statements.InsertSelection.BindText(4, "fragment")
		if err := db.ExecStatement(statements.InsertSelection); err != nil {
			return 0, err
		}
		selectionID := db.Conn.LastInsertRowID()

		// process any directives on the fragment spread.
		for _, directive := range s.Directives {
			statements.InsertSelectionDirective.BindInt64(1, selectionID)
			statements.InsertSelectionDirective.BindText(2, directive.Name)
			if err := db.ExecStatement(statements.InsertSelectionDirective); err != nil {
				return 0, err
			}
			dirID := db.Conn.LastInsertRowID()
			for _, dArg := range directive.Arguments {
				statements.InsertSelectionDirectiveArgument.BindInt64(1, dirID)
				statements.InsertSelectionDirectiveArgument.BindText(2, dArg.Name)
				statements.InsertSelectionDirectiveArgument.BindText(3, dArg.Value.String())
				if err := db.ExecStatement(statements.InsertSelectionDirectiveArgument); err != nil {
					return 0, err
				}
			}
		}
		return selectionID, nil

	default:
		// for unknown selection types, do nothing.
		return 0, nil
	}
}
