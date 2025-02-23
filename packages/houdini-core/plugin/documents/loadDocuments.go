package documents

import (
	"context"
	"fmt"
	"runtime"

	"code.houdinigraphql.com/packages/houdini-core/plugin/schema"
	"code.houdinigraphql.com/plugins"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/gqlerror"
	"github.com/vektah/gqlparser/v2/parser"
	"golang.org/x/sync/errgroup"
	"zombiezen.com/go/sqlite"
	"zombiezen.com/go/sqlite/sqlitex"
)

func LoadDocuments[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig]) error {
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
			conn, err := db.Take(context.Background())
			if err != nil {
				return err
			}
			defer db.Put(conn)

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
				err := LoadPendingQuery(db, query)
				if err != nil {
					txErr = err
					errs.Append(err)
				}
			}

			// if we encountered any error, we need to rollback the transaction
			commit(txErr)

			// we're done
			return nil
		})
	}

	// grab a connection to the database and look for raw documents to process
	conn, err := db.Take(context.Background())
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
		WHERE raw_documents.current_task = $task_id OR $task_id IS NULL
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
	db.Put(conn)

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

// LoadPendingQuery parses the graphql query and inserts the ast into the database.
// it handles both operations and fragment definitions.
func LoadPendingQuery[PluginConfig any](db plugins.DatabasePool[PluginConfig], query PendingQuery) *plugins.Error {
	conn, err := db.Take(context.Background())
	if err != nil {
		return plugins.WrapError(err)
	}
	defer db.Put(conn)

	statements, err, finalize := PrepareDocumentInsertStatements(conn)
	if err != nil {
		return plugins.WrapError(err)
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
		return plugins.WrapError(err)
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
				if directive.Name != schema.ComponentFieldDirective {
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
				Name:          schema.ComponentFieldFragmentName(fragmentType, field),
				Directives:    inlineFragment.Directives,
				SelectionSet:  inlineFragment.SelectionSet,
			})

			// don't process the query (its really a fragment)
			continue
		}

		// insert the operation into the "documents" table.
		// for operations, we set type_condition to null.
		if err := db.ExecStatement(
			statements.InsertDocument,
			map[string]interface{}{
				"name":         operation.Name,
				"raw_document": query.ID,
				"kind":         string(operation.Operation),
			},
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
			variableType, typeModifiers := schema.ParseFieldType(variable.Type.String())

			// if there's a default value, bind it (we'll bind the rest later)
			var defaultValue interface{}
			if variable.DefaultValue != nil {
				defaultValue = variable.DefaultValue.String()
			}

			if err := db.ExecStatement(statements.InsertDocumentVariable, map[string]interface{}{
				"document":       operationID,
				"name":           variable.Variable,
				"type":           variableType,
				"type_modifiers": typeModifiers,
				"row":            int64(variable.Position.Line),
				"column":         int64(variable.Position.Column),
				"default_value":  defaultValue,
			}); err != nil {
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
				if err := db.ExecStatement(statements.InsertDocumentVariableDirective, map[string]interface{}{
					"parent":    variableID,
					"directive": directive.Name,
					"row":       int64(directive.Position.Line),
					"column":    int64(directive.Position.Column),
				}); err != nil {
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
					if err := db.ExecStatement(statements.InsertDocumentVariableDirectiveArgument, map[string]interface{}{
						"parent": varDirID,
						"name":   arg.Name,
						"value":  arg.Value.String(),
					}); err != nil {
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
			if err := processSelection(db, conn, query, operationID, statements, searchTypeStatement, operation.Name, nil, operationType, sel, int64(i)); err != nil {
				return err
			}
		}

		// add document-level directives for the operation.
		for _, directive := range operation.Directives {
			if err := db.ExecStatement(statements.InsertDocumentDirective, map[string]interface{}{
				"document":  operationID,
				"directive": directive.Name,
				"row":       directive.Position.Line,
				"column":    directive.Position.Column,
			}); err != nil {
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
				if err := db.ExecStatement(statements.InsertDocumentDirectiveArgument, map[string]interface{}{
					"parent": docDirID,
					"name":   arg.Name,
					"value":  arg.Value.String(),
				}); err != nil {
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
		if err := db.ExecStatement(
			statements.InsertDocument,
			map[string]interface{}{
				"name":           fragment.Name,
				"raw_document":   query.ID,
				"kind":           "fragment",
				"type_condition": fragment.TypeCondition,
			},
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
			if err := processSelection(db, conn, query, fragmentID, statements, searchTypeStatement, fragment.Name, nil, fragment.TypeCondition, sel, int64(i)); err != nil {
				return err
			}
		}

		// add document-level directives for the operation.
		for _, directive := range fragment.Directives {
			if err := db.ExecStatement(statements.InsertDocumentDirective, map[string]interface{}{
				"document":  fragmentID,
				"directive": directive.Name,
				"row":       directive.Position.Line,
				"column":    directive.Position.Column,
			}); err != nil {
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
				if err := db.ExecStatement(statements.InsertDocumentDirectiveArgument, map[string]interface{}{
					"parent": docDirID,
					"name":   arg.Name,
					"value":  arg.Value.String(),
				}); err != nil {
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

			// we might need to register arguments on fragment by looking for the @arguments directive
			if directive.Name == schema.ArgumentsDirective {
				// we need to find the arguments directive and then add the arguments to the database
				for _, arg := range directive.Arguments {
					// the argument needs to be an object type
					if arg.Value.Kind != ast.ObjectValue {
						return &plugins.Error{
							Message: "arguments directive must have an object value",
							Locations: []*plugins.ErrorLocation{
								{
									Filepath: query.Filepath,
									Line:     query.RowOffset + arg.Position.Line,
									Column:   query.ColumnOffset + arg.Position.Column,
								},
							},
						}
					}

					// the values we need to extract are the name, the type, and a default value
					argName := arg.Name
					var argType string
					var argDefault string
					var argDefaultValue *ast.Value

					// walk the object value and extract the values we need
					for _, field := range arg.Value.Children {
						switch field.Name {
						case "type":
							if field.Value.Kind != ast.StringValue {
								return &plugins.Error{
									Message: "fragment argument type must be a string",
									Locations: []*plugins.ErrorLocation{
										{
											Filepath: query.Filepath,
											Line:     query.RowOffset + field.Position.Line,
											Column:   query.ColumnOffset + field.Position.Column,
										},
									},
								}
							}
							argType = field.Value.Raw
						case "default":
							argDefault = field.Value.Raw
							argDefaultValue = field.Value
						}
					}

					// if we got this far and didn't find a name or type, we have a problem
					if argName == "" {
						return &plugins.Error{
							Message: "fragment arguments must have a name",
							Locations: []*plugins.ErrorLocation{
								{
									Filepath: query.Filepath,
									Line:     query.RowOffset + arg.Position.Line,
									Column:   query.ColumnOffset + arg.Position.Column,
								},
							},
						}
					}
					if argType == "" {
						return &plugins.Error{
							Message: "fragment arguments must have a type",
							Locations: []*plugins.ErrorLocation{
								{
									Filepath: query.Filepath,
									Line:     query.RowOffset + arg.Position.Line,
									Column:   query.ColumnOffset + arg.Position.Column,
								},
							},
						}
					}

					// before we insert the argument definition we need to confirm that the default value is valid
					if argDefault != "" {
						match, err := schema.ValueMatchesType(argType, argDefaultValue)
						if err != nil {
							return plugins.WrapError(err)
						}

						if !match {
							return &plugins.Error{
								Message: "default value does not match argument type",
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

					// we can now insert the argument into the database

					// parse the type of the variable.
					variableType, typeModifiers := schema.ParseFieldType(argType)
					if argDefault != "" {
						statements.InsertDocumentVariable.SetText("$defaultValue", argDefault)
					}
					if err := db.ExecStatement(statements.InsertDocumentVariable, map[string]interface{}{
						"document":       fragmentID,
						"name":           argName,
						"type":           variableType,
						"type_modifiers": typeModifiers,
						"row":            int64(arg.Position.Line),
						"column":         int64(arg.Position.Column),
					}); err != nil {
						return &plugins.Error{
							Message: "could not associate document variable",
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
	}

	return nil
}

// processSelection walks down a selection set and  inserts a row into "selections"
// along with its arguments, directives, directive arguments, and any child selections.
func processSelection[PluginConfig any](db plugins.DatabasePool[PluginConfig], conn *sqlite.Conn, query PendingQuery, documentID int64, statements DocumentInsertStatements, searchTypeStatement *sqlite.Stmt, documentName string, parent *int64, parentType string, sel ast.Selection, fieldIndex int64) *plugins.Error {
	// we need to keep track of the id we create for this selection
	var selectionID int64

	// check on the type of the selection
	switch s := sel.(type) {

	case *ast.Field:
		// insert the field row.
		if s.Alias != "" {
			statements.InsertSelection.BindText(2, s.Alias)
		}
		if err := db.ExecStatement(statements.InsertSelection, map[string]interface{}{
			"field_name": s.Name,
			"path_index": fieldIndex,
			"kind":       "field",
			"type":       fmt.Sprintf("%s.%s", parentType, s.Name),
		}); err != nil {
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

		// Process each argument for a field.
		for _, arg := range s.Arguments {
			// Use the new function to recursively process the argument value
			// and get its normalized ID.
			argValueID, err := processArgumentValue(db, conn, arg.Value, statements)
			if err != nil {
				return &plugins.Error{
					Message: "could not process argument value",
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

			// Insert the argument record that links the argument name to the processed value.
			if err := db.ExecStatement(
				statements.InsertSelectionArgument,
				map[string]interface{}{
					"selection_id": selectionID,
					"name":         arg.Name,
					"value":        argValueID,
					"row":          int64(arg.Position.Line),
					"column":       int64(arg.Position.Column),
				}); err != nil {
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
		pluginError := processDirectives(db, conn, query, statements, selectionID, s.Directives)
		if pluginError != nil {
			return pluginError
		}

		// walk down any nested selections
		for i, child := range s.SelectionSet {
			err := processSelection(db, conn, query, documentID, statements, searchTypeStatement, documentName, &selectionID, fieldType, child, int64(i))
			if err != nil {
				return err
			}
		}

	case *ast.InlineFragment:
		fragType := s.TypeCondition
		if fragType == "" {
			fragType = "inline_fragment"
		}
		if err := db.ExecStatement(statements.InsertSelection, map[string]interface{}{
			"field_name": fragType,
			"alias":      nil,
			"path_index": fieldIndex,
			"kind":       "inline_fragment",
		}); err != nil {
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
			err := processSelection(db, conn, query, documentID, statements, searchTypeStatement, documentName, &selectionID, fragType, child, int64(i))
			if err != nil {
				return err
			}
		}

		// process directives
		err := processDirectives(db, conn, query, statements, selectionID, s.Directives)
		if err != nil {
			return err
		}

	case *ast.FragmentSpread:
		if err := db.ExecStatement(statements.InsertSelection, map[string]interface{}{
			"field_name": s.Name,
			"alias":      nil,
			"path_index": fieldIndex,
			"kind":       "fragment",
		}); err != nil {
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
		err := processDirectives(db, conn, query, statements, selectionID, s.Directives)
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
		statements.InsertSelectionRef.SetInt64("$parent_id", *parent)
	}
	line := query.RowOffset
	column := query.ColumnOffset
	// we want to save the selection location in the document
	if position := sel.GetPosition(); position != nil {
		line += position.Line + query.RowOffset
		column = position.Column + query.ColumnOffset
	}
	if err := db.ExecStatement(statements.InsertSelectionRef, map[string]interface{}{
		"child_id": selectionID,
		"document": documentID,
		"row":      line,
		"column":   column,
	}); err != nil {
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

func processDirectives[PluginConfig any](db plugins.DatabasePool[PluginConfig], conn *sqlite.Conn, query PendingQuery, statements DocumentInsertStatements, selectionID int64, directives []*ast.Directive) *plugins.Error {
	for _, directive := range directives {
		// insert the directive row
		if err := db.ExecStatement(statements.InsertSelectionDirective, map[string]interface{}{
			"selection_id": selectionID,
			"directive":    directive.Name,
			"row":          directive.Position.Line,
			"column":       directive.Position.Column,
		}); err != nil {
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
			// Process the directive argument's value.
			argValueID, err := processArgumentValue(db, conn, dArg.Value, statements)
			if err != nil {
				return &plugins.Error{
					Message: "could not process directive argument value",
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

			// Insert the directive argument record.
			if err := db.ExecStatement(
				statements.InsertSelectionDirectiveArgument,
				map[string]interface{}{
					"parent": dirID,
					"name":   dArg.Name,
					"value":  argValueID,
				}); err != nil {
				return &plugins.Error{
					Message: "could not insert directive argument",
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

type PendingQuery struct {
	Filepath                 string
	ColumnOffset             int
	RowOffset                int
	Query                    string
	ID                       int
	InlineComponentField     bool
	InlineComponentFieldProp *string
}

// processArgumentValue inserts a parsed AST argument value into the database.
// It returns the database id of the inserted argument value so that parent/child
// relationships can be recorded. If the value is a List or Object, it will
// recursively process its children and insert rows into the argument_value_children table.
func processArgumentValue[PluginConfig any](db plugins.DatabasePool[PluginConfig], conn *sqlite.Conn, value *ast.Value, statements DocumentInsertStatements) (int64, *plugins.Error) {
	// Determine the kind string based on the AST value kind.
	var kindStr string
	switch value.Kind {
	case ast.Variable:
		kindStr = "Variable"
	case ast.IntValue:
		kindStr = "Int"
	case ast.FloatValue:
		kindStr = "Float"
	case ast.StringValue:
		kindStr = "String"
	case ast.BlockValue:
		kindStr = "Block"
	case ast.BooleanValue:
		kindStr = "Boolean"
	case ast.NullValue:
		kindStr = "Null"
	case ast.EnumValue:
		kindStr = "Enum"
	case ast.ListValue:
		kindStr = "List"
	case ast.ObjectValue:
		kindStr = "Object"
	default:
		return 0, &plugins.Error{Message: fmt.Sprintf("unsupported argument value kind: %d", value.Kind)}
	}

	// Insert the value itself into the argument_values table.
	err := db.ExecStatement(statements.InsertArgumentValue, map[string]interface{}{
		"kind":   kindStr,
		"raw":    value.Raw,
		"row":    int64(value.Position.Line),
		"column": int64(value.Position.Column),
	})
	if err != nil {
		return 0, plugins.WrapError(err)
	}

	// Get the id of the inserted value.
	parentID := conn.LastInsertRowID()

	// If the value is a List or Object, process its children.
	if kindStr == "List" || kindStr == "Object" {
		// value.Children is now a slice of ChildValue structs.
		for _, child := range value.Children {
			// Recursively process the child value.
			childID, err := processArgumentValue(db, conn, child.Value, statements)
			if err != nil {
				return 0, err
			}

			// For object children, use the provided field name.
			// For list items, the parser may leave Name empty.
			var nameParam interface{}
			if child.Name == "" {
				nameParam = nil
			} else {
				nameParam = child.Name
			}

			line := value.Position.Line
			column := value.Position.Column
			if child.Position != nil {
				line = child.Position.Line
				column = child.Position.Column
			}

			// Insert the relationship into argument_value_children.
			execErr := db.ExecStatement(
				statements.InsertArgumentValueChild,
				map[string]interface{}{
					"name":   nameParam,
					"parent": parentID,
					"value":  childID,
					"row":    int64(line),
					"column": int64(column),
				})
			if execErr != nil {
				return 0, plugins.WrapError(execErr)
			}
		}
	}

	return parentID, nil
}
