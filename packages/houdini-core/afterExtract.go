package main

import (
	"context"
	"fmt"
	"log"
	"runtime"

	"code.houdinigraphql.com/plugins"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
	"golang.org/x/sync/errgroup"
	"zombiezen.com/go/sqlite/sqlitex"
)

type PendingQuery struct {
	Query string
	ID    int
}

// AfterExtract is called after all of the plugins have added their documents to the project.
// We'll use this plugin to parse each document and load it into the database.
func (p *HoudiniCore) AfterExtract(ctx context.Context) error {
	// the first thing we have to do is load the extracted queries
	err := p.afterExtract_loadDocuments(ctx)
	if err != nil {
		return err
	}

	// now that we've parsed and loaded the extracted queries we need to handle component queries
	err = p.afterExtract_componentFields(ctx, p.DB)
	if err != nil {
		return err
	}

	// we're done
	return nil
}

func (p *HoudiniCore) afterExtract_loadDocuments(ctx context.Context) error {
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
			commit := func(err error) error {
				close(&err)
				return err
			}

			// prepare the statements we'll use to insert the document into the database
			insertStatements, finalize := p.prepareDocumentInsertStatements(db)
			defer finalize()

			// consume queries until the channel is closed
			for query := range queries {
				// load the document into the database
				err := p.afterExtract_loadPendingQuery(query, db, insertStatements)
				if err != nil {
					return commit(err)
				}
			}

			// if we got this far, we're good to commit the transaction without an error
			return commit(nil)
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

// afterExtract_loadPendingQuery parses the graphql query and inserts the ast into the database.
// it handles both operations and fragment definitions.
func (p *HoudiniCore) afterExtract_loadPendingQuery(query PendingQuery, db plugins.Database[PluginConfig], statements DocumentInsertStatements) error {
	// parse the query.
	parsed, err := parser.ParseQuery(&ast.Source{
		Input: query.Query,
	})
	if err != nil {
		fmt.Println("parsing error", query.Query)
		return err
	}

	// process operations.
	for _, operation := range parsed.Operations {
		// all operations must have a name
		if operation.Name == "" {
			return fmt.Errorf("operations must have a name")
		}

		// insert the operation into the "documents" table.
		// for operations, we set type_condition to null.
		if err := db.ExecStatement(
			statements.InsertDocument,
			operation.Name,
			query.ID,
			string(operation.Operation),
			nil,
		); err != nil {
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
			// add each selection to the database.
			if err := processSelection(db, statements, operation.Name, nil, sel, int64(i)); err != nil {
				return err
			}
		}

		// add document-level directives for the operation.
		for _, directive := range operation.Directives {
			if err := db.ExecStatement(statements.InsertDocumentDirective, operation.Name, directive.Name); err != nil {
				return err
			}
			docDirID := db.Conn.LastInsertRowID()
			for _, arg := range directive.Arguments {
				if err := db.ExecStatement(statements.InsertDocumentDirectiveArgument, docDirID, arg.Name, arg.Value.String()); err != nil {
					return err
				}
			}
		}
	}

	// process fragment definitions.
	for _, fragment := range parsed.Fragments {
		// insert the fragment into "documents".
		if err := db.ExecStatement(
			statements.InsertDocument,
			fragment.Name,
			query.ID,
			"fragment",
			fragment.TypeCondition,
		); err != nil {
			return err
		}

		// walk the fragment's selection set.
		for i, sel := range fragment.SelectionSet {
			// add each selection to the database.
			if err := processSelection(db, statements, fragment.Name, nil, sel, int64(i)); err != nil {
				return err
			}
		}

		// add document-level directives for the operation.
		for _, directive := range fragment.Directives {
			if err := db.ExecStatement(statements.InsertDocumentDirective, fragment.Name, directive.Name); err != nil {
				return err
			}
			docDirID := db.Conn.LastInsertRowID()
			for _, arg := range directive.Arguments {
				if err := db.ExecStatement(statements.InsertDocumentDirectiveArgument, docDirID, arg.Name, arg.Value.String()); err != nil {
					return err
				}
			}

		}
	}

	return nil
}

// processSelection walks down a selection set and  inserts a row into "selections"
// along with its arguments, directives, directive arguments, and any child selections.
func processSelection(db plugins.Database[PluginConfig], statements DocumentInsertStatements, documentName string, parent *int64, sel ast.Selection, fieldIndex int64) error {
	// we need to keep track of the id we create for this selection
	var selectionID int64

	// check on the type of the selection
	switch s := sel.(type) {

	case *ast.Field:
		// insert the field row.
		statements.InsertSelection.BindText(1, s.Name)
		if s.Alias != "" {
			statements.InsertSelection.BindText(2, s.Alias)
		} else {
			statements.InsertSelection.BindNull(2)
		}
		statements.InsertSelection.BindInt64(3, fieldIndex)
		statements.InsertSelection.BindText(4, "field")
		if err := db.ExecStatement(statements.InsertSelection); err != nil {
			return err
		}
		selectionID = db.Conn.LastInsertRowID()

		// handle any field arguments.
		for _, arg := range s.Arguments {
			if err := db.ExecStatement(
				statements.InsertSelectionArgument,
				selectionID,
				arg.Name,
				arg.Value.String(),
			); err != nil {
				return err
			}
		}

		// insert any directives on the field.
		err := processDirectives(db, statements, selectionID, s.Directives)
		if err != nil {
			return err
		}

		// walk down any nested selections
		for i, child := range s.SelectionSet {
			err := processSelection(db, statements, documentName, &selectionID, child, int64(i))
			if err != nil {
				return err
			}
		}

	case *ast.InlineFragment:
		fragType := s.TypeCondition
		if fragType == "" {
			fragType = "inline_fragment"
		}
		if err := db.ExecStatement(statements.InsertSelection, fragType, nil, fieldIndex, "inline_fragment"); err != nil {
			return err
		}
		selectionID = db.Conn.LastInsertRowID()

		// walk down any nested selections
		for i, child := range s.SelectionSet {
			err := processSelection(db, statements, documentName, &selectionID, child, int64(i))
			if err != nil {
				return err
			}
		}

		// process directives
		err := processDirectives(db, statements, selectionID, s.Directives)
		if err != nil {
			return err
		}

	case *ast.FragmentSpread:
		if err := db.ExecStatement(statements.InsertSelection, s.Name, nil, fieldIndex, "fragment"); err != nil {
			return err
		}
		selectionID = db.Conn.LastInsertRowID()

		// process any directives on the fragment spread.
		err := processDirectives(db, statements, selectionID, s.Directives)
		if err != nil {
			return err
		}
	default:
		return fmt.Errorf("unsupported selection type: %T", sel)
	}

	// if we get this far, we need to associate the selection with its parent
	if parent != nil {
		statements.InsertSelectionRef.BindInt64(1, *parent)
	} else {
		statements.InsertSelectionRef.BindNull(1)
	}
	statements.InsertSelectionRef.BindInt64(2, selectionID)
	statements.InsertSelectionRef.BindText(3, documentName)
	if err := db.ExecStatement(statements.InsertSelectionRef); err != nil {
		return err
	}

	// nothing went wrong
	return nil
}

func processDirectives(db plugins.Database[PluginConfig], statements DocumentInsertStatements, selectionID int64, directives []*ast.Directive) error {
	for _, directive := range directives {
		// insert the directive row
		if err := db.ExecStatement(statements.InsertSelectionDirective, selectionID, directive.Name); err != nil {
			return err
		}
		dirID := db.Conn.LastInsertRowID()

		// and the arguments to the directive
		for _, dArg := range directive.Arguments {
			statements.InsertSelectionDirectiveArgument.BindInt64(1, dirID)
			statements.InsertSelectionDirectiveArgument.BindText(2, dArg.Name)
			statements.InsertSelectionDirectiveArgument.BindText(3, dArg.Value.String())
			if err := db.ExecStatement(
				statements.InsertSelectionDirectiveArgument,
				dirID,
				dArg.Name,
				dArg.Value.String(),
			); err != nil {
				return err
			}
		}
	}

	return nil
}

// we need to look at anything tagged with @componentField and load the metadata into the database
func (p *HoudiniCore) afterExtract_componentFields(ctx context.Context, db plugins.Database[PluginConfig]) error {
	// we need statements to insert schema information
	_, finalizeSchemaStatements := p.prepareSchemaInsertStatements(db)
	defer finalizeSchemaStatements()

	// we need to consider operation directives and selection directives that reference @componentField
	search, err := db.Prepare(`
		SELECT
			type,
			selection_directive_arguments.value
		FROM
			selection_directives
			JOIN selection_directive_arguments on selection_directives.id = selection_directive_arguments.parent
			JOIN selections on selection_directives.selection_id = selections.id
		WHERE directive = ? AND selection_directive_arguments.name = ?
	`)
	if err != nil {
		return err
	}
	defer search.Finalize()

	// bind the id to the query
	search.BindText(1, "componentField")
	search.BindText(2, "name")

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

		// get the results
		// typ := search.ColumnText(0)
		// field := search.ColumnText(1)

	}

	// we're done
	return nil
}
