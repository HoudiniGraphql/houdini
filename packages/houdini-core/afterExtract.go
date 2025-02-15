package main

import (
	"context"
	"fmt"
	"runtime"
	"strconv"

	"code.houdinigraphql.com/plugins"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/gqlerror"
	"github.com/vektah/gqlparser/v2/parser"
	"golang.org/x/sync/errgroup"
	"zombiezen.com/go/sqlite"
	"zombiezen.com/go/sqlite/sqlitex"
)

type PendingQuery struct {
	Filepath                 string
	ColumnOffset             int
	RowOffset                int
	Query                    string
	ID                       int
	InlineComponentField     bool
	InlineComponentFieldProp *string
}

// AfterExtract is called after all of the plugins have added their documents to the project.
// We'll use this plugin to parse each document and load it into the database.
func (p *HoudiniCore) AfterExtract(ctx context.Context) error {
	// sqlite only allows for one write at a time so there's no point in parallelizing this

	// the first thing we have to do is load the extracted queries
	err := p.afterExtract_loadDocuments(ctx)
	if err != nil {
		return err
	}

	errs := &plugins.ErrorList{}

	conn, err := p.DB.Take(context.Background())
	if err != nil {
		return err
	}
	defer p.DB.Put(conn)

	// write component field information to the database
	p.afterExtract_componentFields(conn, errs)

	// and replace runtime scalars with their schema-valid equivalents
	p.afterExtract_runtimeScalars(ctx, conn, errs)

	// if we have any errors collected, return them
	if errs.Len() > 0 {
		return errs
	}

	// we're done
	return nil
}

func (p *HoudiniCore) afterExtract_loadDocuments(ctx context.Context) error {
	// we want to process the documents in parallel so we'll pull down from the database
	// in one goroutine and then pass it a pool of workers who will parse the documents
	// and insert them into the database

	// create a buffered channel to hold queries.
	queries := make(chan PendingQuery, 100)

	// collect all errors we encounter
	errs := &plugins.ErrorList{}

	// start a pool of workers to process the documents
	wg, _ := errgroup.WithContext(ctx)
	for i := 0; i < runtime.NumCPU(); i++ {
		wg.Go(func() error {
			conn, err := p.DB.Take(context.Background())
			if err != nil {
				return err
			}
			defer p.DB.Put(conn)

			// each query gets wrapped in its own transaction
			close := sqlitex.Transaction(conn)
			commit := func(err error) error {
				close(&err)
				return err
			}

			var txErr error
			// consume queries until the channel is closed
			for query := range queries {
				// load the document into the database
				err := p.afterExtract_loadPendingQuery(query)
				if err != nil {
					txErr = err
					errs.Append(*err)
				}
			}

			// if we encountered any error, we need to rollback the transaction
			commit(txErr)

			// we're done
			return nil
		})
	}

	// grab a connection to the database and look for raw documents to process
	conn, err := p.DB.Take(context.Background())
	if err != nil {
		return err
	}
	// there's no close here because we don't want to hold up the connection while we wait for the workers

	// prepare the query we'll use to look for documents
	search, err := conn.Prepare(`
		SELECT
			raw_documents.id,
			content,
			(component_fields.document IS NOT NULL) AS inline_component_field,
			component_fields.prop,
			raw_documents.offset_column,
			raw_documents.offset_line,
			raw_documents.filepath
		FROM raw_documents
			LEFT JOIN component_fields ON
				raw_documents.id = component_fields.document
				AND component_fields.inline = true
	`)
	if err != nil {
		return err
	}
	defer search.Finalize()

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

		// build up the pending query
		query := PendingQuery{
			ID:                   search.ColumnInt(0),
			Query:                search.ColumnText(1),
			InlineComponentField: search.ColumnBool(2),
			ColumnOffset:         search.ColumnInt(4),
			RowOffset:            search.ColumnInt(5),
			Filepath:             search.ColumnText(6),
		}

		if !search.ColumnIsNull(3) {
			prop := search.ColumnText(3)
			query.InlineComponentFieldProp = &prop
		}

		select {
		// send the query to the workers
		case queries <- query:
			continue
		// if the context is cancelled, exit the loop.
		case <-ctx.Done():
			break
		}
	}

	// we're done with the connection (close before we wait for the workers)
	p.DB.Put(conn)

	// signal workers that no more queries are coming.
	close(queries)

	// wait for all workers to finish processing.
	if err := wg.Wait(); err != nil {
		return err
	}

	// propagate any errors we encountered
	if errs.Len() > 0 {
		return errs
	}

	// we're done
	return nil
}

// afterExtract_loadPendingQuery parses the graphql query and inserts the ast into the database.
// it handles both operations and fragment definitions.
func (p *HoudiniCore) afterExtract_loadPendingQuery(query PendingQuery) *plugins.Error {
	conn, err := p.DB.Take(context.Background())
	if err != nil {
		err := plugins.WrapError(err)
		return &err
	}
	defer p.DB.Put(conn)

	statements, err, finalize := p.prepareDocumentInsertStatements(conn)
	if err != nil {
		err := plugins.WrapError(err)
		return &err
	}
	defer finalize()

	// parse the query.
	parsed, err := parser.ParseQuery(&ast.Source{
		Input: query.Query,
	})
	if err != nil {
		pluginErr := &plugins.Error{
			Message: fmt.Sprintf("failed to parse query: %v", err),
			Locations: []*plugins.ErrorLocation{
				{
					Filepath: query.Filepath,
					Line:     query.RowOffset,
					Column:   query.ColumnOffset,
				},
			},
		}

		// if the error encodes a specific location, add it to the returned value
		if gqlErr, ok := err.(*gqlerror.Error); ok {
			pluginErr.Locations[0].Line += gqlErr.Locations[0].Line
			pluginErr.Locations[0].Column += gqlErr.Locations[0].Line
		}

		return pluginErr
	}

	// look up the type of the field from the database
	searchTypeStatement, err := conn.Prepare(`SELECT type FROM type_fields WHERE id = ?`)
	if err != nil {
		pluginError := plugins.WrapError(err)
		return &pluginError
	}
	defer searchTypeStatement.Finalize()
	// process operations.
	for _, operation := range parsed.Operations {
		// all operations must have a name
		if operation.Name == "" && !query.InlineComponentField {
			return &plugins.Error{
				Message: "operations must have a name",
				Locations: []*plugins.ErrorLocation{
					{
						Filepath: query.Filepath,
						Line:     query.RowOffset + operation.Position.Line,
						Column:   query.ColumnOffset + operation.Position.Column,
					},
				},
			}
		}

		// if the operation is an inline component field and we don't have a prop then we need to bail
		if query.InlineComponentField && query.InlineComponentFieldProp == nil {
			return &plugins.Error{
				Message: "could not detect component field prop",
				Locations: []*plugins.ErrorLocation{
					{
						Filepath: query.Filepath,
						Line:     query.RowOffset + operation.Position.Line,
						Column:   query.ColumnOffset + operation.Position.Column,
					},
				},
			}
		}

		// if the operation is an inline component field then we need to actually treat it as a fragment
		// so let's grab the information we need and then add a fragment definition to the document
		if query.InlineComponentField {
			// the new document we are going to use is based on the inline query holding the selection
			// so make sure there is only one child and its an inline fragment
			if len(operation.SelectionSet) != 1 {
				return &plugins.Error{
					Message: fmt.Sprintf("componentFields must have one child found %d", len(operation.SelectionSet)),
					Locations: []*plugins.ErrorLocation{
						{
							Filepath: query.Filepath,
							Line:     query.RowOffset + operation.Position.Line,
							Column:   query.ColumnOffset + operation.Position.Column,
						},
					},
				}
			}
			inlineFragment, ok := operation.SelectionSet[0].(*ast.InlineFragment)
			if !ok {
				return &plugins.Error{
					Message: "componentFields must have an inline fragment",
					Locations: []*plugins.ErrorLocation{
						{
							Filepath: query.Filepath,
							Line:     query.RowOffset + operation.Position.Line,
							Column:   query.ColumnOffset + operation.Position.Column,
						},
					},
				}
			}

			// there needs to be a type condition on the inline fragment
			fragmentType := inlineFragment.TypeCondition
			if fragmentType == "" {
				line := query.RowOffset
				column := query.ColumnOffset
				if position := inlineFragment.Position; position != nil {
					line += position.Line
					column += position.Column
				}
				return &plugins.Error{
					Message: "componentFields inline fragments must have a type condition",
					Locations: []*plugins.ErrorLocation{
						{
							Filepath: query.Filepath,
							Line:     query.RowOffset + line,
							Column:   query.ColumnOffset + column,
						},
					},
				}
			}

			// the inline fragment must be decorated with @componentField
			hasDirective := false
			var field string
			for _, directive := range inlineFragment.Directives {
				if directive.Name != componentFieldDirective {
					continue
				}

				hasDirective = true
				var prop string

				// look for the two argument values
				for _, arg := range directive.Arguments {
					if arg.Name == "prop" {
						if arg.Value.Kind != ast.StringValue {
							return &plugins.Error{
								Message: "componentFields must have an inline fragment",
								Locations: []*plugins.ErrorLocation{
									{
										Filepath: query.Filepath,
										Line:     query.RowOffset + arg.Position.Line,
										Column:   query.ColumnOffset + arg.Position.Column,
									},
								},
							}
						}
						prop = arg.Value.Raw
						continue
					} else if arg.Name == "field" {
						if arg.Value.Kind != ast.StringValue {
							return &plugins.Error{
								Message: "componentField field argument must be a string",
								Locations: []*plugins.ErrorLocation{
									{
										Filepath: query.Filepath,
										Line:     query.RowOffset + arg.Position.Line,
										Column:   query.ColumnOffset + arg.Position.Column,
									},
								},
							}
						}
						field = arg.Value.Raw
						continue
					}
				}

				// if the directive doesn't have a prop specified then we should use what we have in the database
				if prop == "" {
					directive.Arguments = append(directive.Arguments, &ast.Argument{
						Name: "prop",
						Value: &ast.Value{
							Raw:  *query.InlineComponentFieldProp,
							Kind: ast.StringValue,
						},
					})

					prop = *query.InlineComponentFieldProp
				}

				if field == "" {
					return &plugins.Error{
						Message: "couldn't determine the field for component field",
						Locations: []*plugins.ErrorLocation{
							{
								Filepath: query.Filepath,
								Line:     query.RowOffset + inlineFragment.Position.Line,
								Column:   query.ColumnOffset + inlineFragment.Position.Column,
							},
						},
					}
				}
			}

			// if we got this far without finding the directive then we have a problem
			if !hasDirective {
				return &plugins.Error{
					Message: "componentFields must have @componentField directive",
					Locations: []*plugins.ErrorLocation{
						{
							Filepath: query.Filepath,
							Line:     query.RowOffset + inlineFragment.Position.Line,
							Column:   query.ColumnOffset + inlineFragment.Position.Column,
						},
					},
				}
			}

			// add a fragment definition to the document
			parsed.Fragments = append(parsed.Fragments, &ast.FragmentDefinition{
				TypeCondition: inlineFragment.TypeCondition,
				Name:          componentFieldFragmentName(fragmentType, field),
				Directives:    inlineFragment.Directives,
				SelectionSet:  inlineFragment.SelectionSet,
			})

			// don't process the query (its really a fragment)
			continue
		}

		// insert the operation into the "documents" table.
		// for operations, we set type_condition to null.
		if err := p.DB.ExecStatement(
			statements.InsertDocument,
			operation.Name,
			query.ID,
			string(operation.Operation),
			nil,
		); err != nil {
			return &plugins.Error{
				Message: "could not insert document",
				Detail:  err.Error(),
				Locations: []*plugins.ErrorLocation{
					{
						Filepath: query.Filepath,
						Line:     query.RowOffset + operation.Position.Line,
						Column:   query.ColumnOffset + operation.Position.Column,
					},
				},
			}
		}
		operationID := conn.LastInsertRowID()

		// insert any variable definitions.
		for _, variable := range operation.VariableDefinitions {
			// parse the type of the variable.
			variableType, typeModifiers := parseFieldType(variable.Type.String())

			statements.InsertDocumentVariable.BindInt64(1, operationID)
			statements.InsertDocumentVariable.BindText(2, variable.Variable)
			statements.InsertDocumentVariable.BindText(3, variableType)
			statements.InsertDocumentVariable.BindText(4, typeModifiers)
			if variable.DefaultValue != nil {
				statements.InsertDocumentVariable.BindText(5, variable.DefaultValue.String())
			} else {
				statements.InsertDocumentVariable.BindNull(5)
			}
			if err := p.DB.ExecStatement(statements.InsertDocumentVariable); err != nil {
				return &plugins.Error{
					Message: "could not associate document variable",
					Detail:  err.Error(),
					Locations: []*plugins.ErrorLocation{
						{
							Filepath: query.Filepath,
							Line:     query.RowOffset + operation.Position.Line,
							Column:   query.ColumnOffset + operation.Position.Column,
						},
					},
				}
			}

			variableID := conn.LastInsertRowID()

			// insert any directives on the variable.
			for _, directive := range variable.Directives {
				if err := p.DB.ExecStatement(statements.InsertDocumentVariableDirective, variableID, directive.Name); err != nil {
					return &plugins.Error{
						Message: "could not associate document variable directive",
						Detail:  err.Error(),
						Locations: []*plugins.ErrorLocation{
							{
								Filepath: query.Filepath,
								Line:     query.RowOffset + operation.Position.Line,
								Column:   query.ColumnOffset + operation.Position.Column,
							},
						},
					}
				}
				varDirID := conn.LastInsertRowID()
				for _, arg := range directive.Arguments {
					if err := p.DB.ExecStatement(statements.InsertDocumentVariableDirectiveArgument, varDirID, arg.Name, arg.Value.String()); err != nil {
						return &plugins.Error{
							Message: "could not insert document variable argument",
							Detail:  err.Error(),
							Locations: []*plugins.ErrorLocation{
								{
									Filepath: query.Filepath,
									Line:     query.RowOffset + operation.Position.Line,
									Column:   query.ColumnOffset + operation.Position.Column,
								},
							},
						}
					}
				}
			}
		}

		// TODO: support custom operation types
		// figure out the name of the root type for the operation.
		operationType := "Query"
		if operation.Operation == ast.Mutation {
			operationType = "Mutation"
		} else if operation.Operation == ast.Subscription {
			operationType = "Subscription"
		}

		// walk the selection set for the operation.
		for i, sel := range operation.SelectionSet {
			// add each selection to the database.
			if err := p.processSelection(conn, query, operationID, statements, searchTypeStatement, operation.Name, nil, operationType, sel, int64(i)); err != nil {
				return err
			}
		}

		// add document-level directives for the operation.
		for _, directive := range operation.Directives {
			if err := p.DB.ExecStatement(statements.InsertDocumentDirective, operationID, directive.Name); err != nil {
				return &plugins.Error{
					Message: "could not insert document directive",
					Detail:  err.Error(),
					Locations: []*plugins.ErrorLocation{
						{
							Filepath: query.Filepath,
							Line:     query.RowOffset + directive.Position.Line,
							Column:   query.ColumnOffset + directive.Position.Column,
						},
					},
				}
			}
			docDirID := conn.LastInsertRowID()
			for _, arg := range directive.Arguments {
				if err := p.DB.ExecStatement(statements.InsertDocumentDirectiveArgument, docDirID, arg.Name, arg.Value.String()); err != nil {
					return &plugins.Error{
						Message: "could not associate document variable directive argument",
						Detail:  err.Error(),
						Locations: []*plugins.ErrorLocation{
							{
								Filepath: query.Filepath,
								Line:     query.RowOffset + arg.Position.Line,
								Column:   query.ColumnOffset + arg.Position.Column,
							},
						},
					}
				}
			}
		}
	}

	// process fragment definitions.
	for _, fragment := range parsed.Fragments {
		// insert the fragment into "documents".
		if err := p.DB.ExecStatement(
			statements.InsertDocument,
			fragment.Name,
			query.ID,
			"fragment",
			fragment.TypeCondition,
		); err != nil {
			return &plugins.Error{
				Message: "could not insert fragment",
				Detail:  err.Error(),
				Locations: []*plugins.ErrorLocation{
					{
						Filepath: query.Filepath,
						Line:     query.RowOffset + fragment.Position.Line,
						Column:   query.ColumnOffset + fragment.Position.Column,
					},
				},
			}
		}

		fragmentID := conn.LastInsertRowID()

		// walk the fragment's selection set.
		for i, sel := range fragment.SelectionSet {
			// add each selection to the database.
			if err := p.processSelection(conn, query, fragmentID, statements, searchTypeStatement, fragment.Name, nil, fragment.TypeCondition, sel, int64(i)); err != nil {
				return err
			}
		}

		// add document-level directives for the operation.
		for _, directive := range fragment.Directives {
			if err := p.DB.ExecStatement(statements.InsertDocumentDirective, fragmentID, directive.Name); err != nil {
				return &plugins.Error{
					Message: "could not insert document directive",
					Detail:  err.Error(),
					Locations: []*plugins.ErrorLocation{
						{
							Filepath: query.Filepath,
							Line:     query.RowOffset + directive.Position.Line,
							Column:   query.ColumnOffset + directive.Position.Column,
						},
					},
				}
			}
			docDirID := conn.LastInsertRowID()
			for _, arg := range directive.Arguments {
				if err := p.DB.ExecStatement(statements.InsertDocumentDirectiveArgument, docDirID, arg.Name, arg.Value.String()); err != nil {
					return &plugins.Error{
						Message: "could not associate document directive argument",
						Detail:  err.Error(),
						Locations: []*plugins.ErrorLocation{
							{
								Filepath: query.Filepath,
								Line:     query.RowOffset + arg.Position.Line,
								Column:   query.ColumnOffset + arg.Position.Column,
							},
						},
					}
				}
			}

		}
	}

	return nil
}

// processSelection walks down a selection set and  inserts a row into "selections"
// along with its arguments, directives, directive arguments, and any child selections.
func (p *HoudiniCore) processSelection(conn *sqlite.Conn, query PendingQuery, documentID int64, statements DocumentInsertStatements, searchTypeStatement *sqlite.Stmt, documentName string, parent *int64, parentType string, sel ast.Selection, fieldIndex int64) *plugins.Error {
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
		statements.InsertSelection.BindText(5, fmt.Sprintf("%s.%s", parentType, s.Name))
		if err := p.DB.ExecStatement(statements.InsertSelection); err != nil {
			return &plugins.Error{
				Message: "could not add selection to database",
				Detail:  err.Error(),
				Locations: []*plugins.ErrorLocation{
					{
						Filepath: query.Filepath,
						Line:     query.RowOffset + s.Position.Line,
						Column:   query.ColumnOffset + s.Position.Column,
					},
				},
			}
		}
		selectionID = conn.LastInsertRowID()

		searchTypeStatement.BindText(1, fmt.Sprintf("%s.%s", parentType, s.Name))
		_, err := searchTypeStatement.Step()
		if err != nil {
			return &plugins.Error{
				Message: "could not find type for field",
				Detail:  err.Error(),
				Locations: []*plugins.ErrorLocation{
					{
						Filepath: query.Filepath,
						Line:     query.RowOffset + s.Position.Line,
						Column:   query.ColumnOffset + s.Position.Column,
					},
				},
			}
		}
		fieldType := searchTypeStatement.ColumnText(0)
		err = searchTypeStatement.Reset()
		if err != nil {
			return &plugins.Error{
				Message: "could not find type for field",
				Detail:  err.Error(),
				Locations: []*plugins.ErrorLocation{
					{
						Filepath: query.Filepath,
						Line:     query.RowOffset + s.Position.Line,
						Column:   query.ColumnOffset + s.Position.Column,
					},
				},
			}
		}

		// handle any field arguments.
		for _, arg := range s.Arguments {
			if err := p.DB.ExecStatement(
				statements.InsertSelectionArgument,
				selectionID,
				arg.Name,
				arg.Value.String(),
			); err != nil {
				return &plugins.Error{
					Message: "could not add selection argument to database",
					Detail:  err.Error(),
					Locations: []*plugins.ErrorLocation{
						{
							Filepath: query.Filepath,
							Line:     query.RowOffset + arg.Position.Line,
							Column:   query.ColumnOffset + arg.Position.Column,
						},
					},
				}
			}
		}

		// insert any directives on the field.
		pluginError := p.processDirectives(conn, query, statements, selectionID, s.Directives)
		if pluginError != nil {
			return pluginError
		}

		// walk down any nested selections
		for i, child := range s.SelectionSet {
			err := p.processSelection(conn, query, documentID, statements, searchTypeStatement, documentName, &selectionID, fieldType, child, int64(i))
			if err != nil {
				return err
			}
		}

	case *ast.InlineFragment:
		fragType := s.TypeCondition
		if fragType == "" {
			fragType = "inline_fragment"
		}
		if err := p.DB.ExecStatement(statements.InsertSelection, fragType, nil, fieldIndex, "inline_fragment", nil); err != nil {
			return &plugins.Error{
				Message: "Could not store inline fragment in database",
				Detail:  err.Error(),
				Locations: []*plugins.ErrorLocation{
					{
						Filepath: query.Filepath,
						Line:     query.RowOffset + s.Position.Line,
						Column:   query.ColumnOffset + s.Position.Column,
					},
				},
			}
		}
		selectionID = conn.LastInsertRowID()

		// walk down any nested selections
		for i, child := range s.SelectionSet {
			err := p.processSelection(conn, query, documentID, statements, searchTypeStatement, documentName, &selectionID, fragType, child, int64(i))
			if err != nil {
				return err
			}
		}

		// process directives
		err := p.processDirectives(conn, query, statements, selectionID, s.Directives)
		if err != nil {
			return err
		}

	case *ast.FragmentSpread:
		if err := p.DB.ExecStatement(statements.InsertSelection, s.Name, nil, fieldIndex, "fragment", nil); err != nil {
			return &plugins.Error{
				Message: "could not store fragment spread in database",
				Detail:  err.Error(),
				Locations: []*plugins.ErrorLocation{
					{
						Filepath: query.Filepath,
						Line:     query.RowOffset + s.Position.Line,
						Column:   query.ColumnOffset + s.Position.Column,
					},
				},
			}
		}
		selectionID = conn.LastInsertRowID()

		// process any directives on the fragment spread.
		err := p.processDirectives(conn, query, statements, selectionID, s.Directives)
		if err != nil {
			return err
		}
	default:
		return &plugins.Error{
			Message: fmt.Sprintf("unsupported selection type: %T", sel),
			Locations: []*plugins.ErrorLocation{
				{
					Filepath: query.Filepath,
					Line:     query.RowOffset + s.GetPosition().Line,
					Column:   query.ColumnOffset + s.GetPosition().Column,
				},
			},
		}
	}

	// if we get this far, we need to associate the selection with its parent
	if parent != nil {
		statements.InsertSelectionRef.BindInt64(1, *parent)
	} else {
		statements.InsertSelectionRef.BindNull(1)
	}
	statements.InsertSelectionRef.BindInt64(2, selectionID)
	statements.InsertSelectionRef.BindInt64(3, documentID)

	line := query.RowOffset
	column := query.ColumnOffset
	// we want to save the selection location in the document
	if position := sel.GetPosition(); position != nil {
		line = position.Line + query.RowOffset
		column = position.Column + query.ColumnOffset
		statements.InsertSelectionRef.BindInt64(4, int64(line))
		statements.InsertSelectionRef.BindInt64(5, int64(column))
	} else {
		statements.InsertSelectionRef.BindNull(4)
		statements.InsertSelectionRef.BindNull(5)
	}
	if err := p.DB.ExecStatement(statements.InsertSelectionRef); err != nil {
		return &plugins.Error{
			Message: "could not store selection ref",
			Detail:  err.Error(),
			Locations: []*plugins.ErrorLocation{
				{
					Filepath: query.Filepath,
					Line:     line,
					Column:   column,
				},
			},
		}
	}

	// nothing went wrong
	return nil
}

func (p HoudiniCore) processDirectives(conn *sqlite.Conn, query PendingQuery, statements DocumentInsertStatements, selectionID int64, directives []*ast.Directive) *plugins.Error {
	for _, directive := range directives {
		// insert the directive row
		if err := p.DB.ExecStatement(statements.InsertSelectionDirective, selectionID, directive.Name); err != nil {
			return &plugins.Error{
				Message: "could not store selection directive in database",
				Detail:  err.Error(),
				Locations: []*plugins.ErrorLocation{
					{
						Filepath: query.Filepath,
						Line:     query.RowOffset + directive.Position.Line,
						Column:   query.ColumnOffset + directive.Position.Column,
					},
				},
			}
		}
		dirID := conn.LastInsertRowID()

		// and the arguments to the directive
		for _, dArg := range directive.Arguments {
			statements.InsertSelectionDirectiveArgument.BindInt64(1, dirID)
			statements.InsertSelectionDirectiveArgument.BindText(2, dArg.Name)
			statements.InsertSelectionDirectiveArgument.BindText(3, dArg.Value.String())
			if err := p.DB.ExecStatement(
				statements.InsertSelectionDirectiveArgument,
				dirID,
				dArg.Name,
				dArg.Value.String(),
			); err != nil {
				return &plugins.Error{
					Message: "could not store selection directive argument in database",
					Detail:  err.Error(),
					Locations: []*plugins.ErrorLocation{
						{
							Filepath: query.Filepath,
							Line:     query.RowOffset + dArg.Position.Line,
							Column:   query.ColumnOffset + dArg.Position.Column,
						},
					},
				}
			}
		}
	}

	return nil
}

// we need to look at anything tagged with @componentField and load the metadata into the database
// this includes:
// - populate prop, fields, etc for non-inline component fields
// - adding internal fields to the type definitions
// note: we'll hold on doing the actual injection of fragments til after we've validated
// everything to ensure that error messages make sense
func (p *HoudiniCore) afterExtract_componentFields(conn *sqlite.Conn, errs *plugins.ErrorList) {
	// we need statements to insert schema information
	_, finalizeSchemaStatements := p.prepareSchemaInsertStatements(conn)
	defer finalizeSchemaStatements()

	// we need to look at every @componentField directive (which should only only be on fragment definitions at this point)
	// and look at the prop and field values

	type ComponentFieldData struct {
		RawDocumentID int
		Type          string
		Prop          string
		Field         string
	}
	documentInfo := map[int]*ComponentFieldData{}

	search, err := conn.Prepare(`
		SELECT
			documents.raw_document,
			documents.type_condition,
			document_directive_arguments.name,
			document_directive_arguments.value
		FROM
			document_directives
				JOIN documents on document_directives.document = documents.id
				JOIN document_directive_arguments on document_directive_arguments.parent = document_directives.id
		WHERE
			document_directives.directive = ?
	`)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer search.Finalize()
	search.BindText(1, componentFieldDirective)

	// step through every result
	for {
		hasData, err := search.Step()
		if err != nil {
			errs.Append(plugins.WrapError(err))
			return
		}
		if !hasData {
			break
		}

		// if this is the first time we see this document, we need to create a new entry
		rawDocumentID := search.ColumnInt(0)
		document, ok := documentInfo[rawDocumentID]
		if !ok {
			document = &ComponentFieldData{}
			documentInfo[rawDocumentID] = document
		}

		// pull out the information
		document.Type = search.ColumnText(1)
		document.RawDocumentID = rawDocumentID

		// strip the quotes
		unquoted, err := strconv.Unquote(search.ColumnText(3))
		if err != nil {
			errs.Append(plugins.WrapError(err))
			continue
		}

		switch search.ColumnText(2) {
		case "prop":
			document.Prop = unquoted
		case "field":
			document.Field = unquoted
		}
	}

	// a statement to insert component fields information as an upsert (so we don't override existing discovered inline fields)
	insertComponentField, err := conn.Prepare(`
		INSERT INTO component_fields
			(document, prop, field, type, inline)
		VALUES
			(?, ?, ?, ?, false)
		ON CONFLICT(document) DO UPDATE SET
  			prop = excluded.prop,
  			field = excluded.field,
  			type = excluded.type
	`)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer insertComponentField.Finalize()

	// a statement to insert internal fields into the type definitions
	insertInternalField, err := conn.Prepare(`
		INSERT INTO type_fields (id, parent, name, type, internal) VALUES (?, ?, ?, ?, true)
	`)
	if err != nil {
		errs.Append(plugins.Error{
			Message: "could not prepare statement to insert internal fields",
			Detail:  err.Error(),
		})
		errs.Append(plugins.WrapError(err))
		return
	}
	defer insertInternalField.Finalize()

	// process the data we've collected
	for _, data := range documentInfo {
		// make sure that we have the component field information loaded
		err = p.DB.ExecStatement(insertComponentField, data.RawDocumentID, data.Prop, data.Field, data.Type)
		if err != nil {
			errs.Append(plugins.WrapError(err))
			continue
		}

		// add the internal field to the type
		err = p.DB.ExecStatement(insertInternalField, fmt.Sprintf("%s.%s", data.Type, data.Field), data.Type, data.Field, "Component")
		if err != nil {
			errs.Append(plugins.WrapError(err))
			continue
		}
	}

	// we're done
	return
}

// we need to replace runtime scalars with their static equivalents and add the runtime scalar directive
func (p *HoudiniCore) afterExtract_runtimeScalars(ctx context.Context, conn *sqlite.Conn, errs *plugins.ErrorList) {
	// load the project configuration
	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}

	// wrap the operations in a transaction
	close := sqlitex.Transaction(conn)
	commit := func(err error) error {
		close(&err)
		return err
	}

	// we need a list of all the runtime scalars
	runtimeScalars := ""
	for scalar := range projectConfig.RuntimeScalars {
		runtimeScalars += `'` + scalar + `',`
	}
	if runtimeScalars == "" {
		runtimeScalars = ","
	}

	// we need to look at every operation variable that has a runtime scalar for its type
	search, err := conn.Prepare(fmt.Sprintf(`
		SELECT
			operation_variables.id,
			operation_variables.type
		FROM operation_variables WHERE type in (%s)
	`, runtimeScalars[:len(runtimeScalars)-1]))
	if err != nil {
		errs.Append(plugins.WrapError(err))
		commit(err)
		return
	}
	defer search.Finalize()

	// and a query to update the type of the variable
	updateType, err := conn.Prepare(`
		UPDATE operation_variables SET type = ? WHERE id = ?
	`)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		commit(err)
		return
	}
	defer updateType.Finalize()

	// and some statements to insert the runtime scalar directives
	insertDocumentVariableDirective, err := conn.Prepare("INSERT INTO operation_variable_directives (parent, directive) VALUES (?, ?)")
	if err != nil {
		errs.Append(plugins.WrapError(err))
		commit(err)
		return
	}
	defer insertDocumentVariableDirective.Finalize()
	// and scalar directive arguments
	insertDocumentVariableDirectiveArgument, err := conn.Prepare("INSERT INTO operation_variable_directive_arguments (parent, name, value) VALUES (?, ?, ?)")
	if err != nil {
		errs.Append(plugins.WrapError(err))
		commit(err)
		return
	}
	defer insertDocumentVariableDirectiveArgument.Finalize()

	for {
		hasData, err := search.Step()
		if err != nil {
			errs.Append(plugins.WrapError(err))
			commit(err)
			return
		}
		if !hasData {
			break
		}

		// pull the query results out
		variablesID := search.ColumnInt(0)
		variableType := search.ColumnText(1)

		// we need to update the type of the variable
		err = p.DB.ExecStatement(updateType, projectConfig.RuntimeScalars[variableType], variablesID)
		if err != nil {
			errs.Append(plugins.WrapError(err))
			commit(err)
			return
		}

		// we also need to add a directive to the variable
		err = p.DB.ExecStatement(insertDocumentVariableDirective, variablesID, runtimeScalarDirective)
		if err != nil {
			errs.Append(plugins.WrapError(err))
			commit(err)
			return
		}
		directiveID := conn.LastInsertRowID()

		// and the arguments to the directive
		err = p.DB.ExecStatement(insertDocumentVariableDirectiveArgument, directiveID, "type", variableType)
		if err != nil {
			errs.Append(plugins.WrapError(err))
			commit(err)
			return
		}
	}

	// we're done (commit the transaction)
	commit(nil)
}
