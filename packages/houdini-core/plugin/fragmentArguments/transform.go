package fragmentArguments

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"runtime"
	"sync"

	"golang.org/x/sync/syncmap"
	"zombiezen.com/go/sqlite"
	"zombiezen.com/go/sqlite/sqlitex"

	"code.houdinigraphql.com/packages/houdini-core/plugin/schema"
	"code.houdinigraphql.com/plugins"
)

// Transform is responsible for walking down a document's selection and replaces
// and fragment spreads with a corresponding fragment references that has the fragment
// arguments inlined
func Transform[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig]) error {
	// grab a connection to the database
	conn, err := db.Take(ctx)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer db.Put(conn)

	errs := &plugins.ErrorList{}

	// the idea is to build up a scope (a mapping from variable name to value) as we walk down.
	// a scope is the combination of variables passed to @with on the spread we run into
	// along with any default variables defined on the document

	// to begin, we need to start at the top looking at every operation and every fragment that does not have arguments
	// that contains the @with directive. these define the top-level of the traversal
	querySearch, err := conn.Prepare(`
    SELECT 
      documents.id,
      raw_documents.filepath,
      CASE 
      	WHEN document_variables.name is null THEN null 
      	ELSE 
          json_group_array(
          	json_object(
              'name', document_variables."name",
              'value', document_variables.default_value
          	)
          )
 	     END as scope
    FROM documents
      JOIN raw_documents ON documents.raw_document = raw_documents.id
      LEFT JOIN document_variables ON documents.id = document_variables.document
      LEFT JOIN selection_refs on selection_refs."document" = documents.id
      LEFT JOIN selection_directives ON selection_directives.selection_id = selection_refs.child_id
    WHERE (documents.type_condition IS NULL OR document_variables."name" IS NULL)
    	AND selection_directives.directive = 'with'
      AND (raw_documents.current_task = $task_id OR $task_id IS NULL)
    GROUP BY documents.id  
  `)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return errors.New(errs.Error())
	}
	defer querySearch.Finalize()

	// avoid circular references
	processedFragments := &syncmap.Map{}

	// we want to process the documents in parallel
	var wg sync.WaitGroup

	type docWithScope struct {
		DocID int64
		Scope map[string]int64
	}
	docs := make(chan docWithScope, 100)

	// sort a worker for each cpu
	for range runtime.NumCPU() {
		wg.Add(1)
		go func() {
			defer wg.Done()
			// each worker needs a standalone connection to the database
			conn, err := db.Take(ctx)
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
			defer db.Put(conn)

			// prepare the statements we'll use to modify the database
			statements, err := prepareTransformStatements[PluginConfig](conn)
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
			defer statements.Finalize()

			// consume documents we discover in the database
		DOC_LOOP:
			for {
				select {
				case <-ctx.Done():
					break DOC_LOOP
				case doc, ok := <-docs:
					if !ok {
						break DOC_LOOP
					}

					// wrap the processing in transaction
					commit := sqlitex.Transaction(conn)
					err = processDocument(ctx, db, conn, statements, doc.DocID, doc.Scope, processedFragments)
					commit(&err)
				}
			}
		}()
	}
	variableRefSearch, err := conn.Prepare(` 
    SELECT * from argument_values WHERE kind = 'Variable' AND raw = $variable AND document = $document LIMIT 1
  `)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return errors.New(errs.Error())
	}

	// walk through every document and start to transform
	err = db.StepStatement(ctx, querySearch, func() {
		filepath := querySearch.GetText("filepath")
		doc := docWithScope{
			DocID: querySearch.GetInt64("id"),
			Scope: map[string]int64{},
		}

		// the top level scope for this document is contained in the json array we get from the database
		scopeStr := querySearch.GetText("scope")
		scopeEntries := []struct {
			Name  string `json:"name"`
			Value int64  `json:"value"`
		}{}
		if scopeStr != "" {
			err = json.Unmarshal([]byte(scopeStr), &scopeEntries)
			if err != nil {
				errs.Append(plugins.WrapFilepathError(filepath, err))
				return
			}
		}
		for _, entry := range scopeEntries {
			// we need to find the variable value
			err = db.BindStatement(variableRefSearch, map[string]any{
				"document": doc.DocID,
				"variable": entry.Name,
			})
			db.StepStatement(ctx, variableRefSearch, func() {
				doc.Scope[entry.Name] = variableRefSearch.GetInt64("id")
			})
		}

		docs <- doc
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return errors.New(errs.Error())
	}

	// if we got this far, we're done walking through the database results so close the channel
	close(docs)

	// and wait for the workers to drain the results
	wg.Wait()

	// propagate any errors we ran into
	if errs.Len() > 0 {
		return errs
	}

	// we're done
	return nil
}

func processDocument[PluginConfig any](
	ctx context.Context,
	db plugins.DatabasePool[PluginConfig],
	conn *sqlite.Conn,
	statements *transformStatements[PluginConfig],
	documentID int64,
	scope map[string]int64,
	processedFragments *syncmap.Map,
) error {
	// the first thing we have to do is apply any variables that show up in the
	// document and set any that aren't defined in the provided scope to a null value
	// and delete the variable value

	// we have to do this for variables that are referenced as selection arguments
	// and variables nested inside of structured values
	err := statements.ReplaceVariables(
		ctx,
		db,
		conn,
		statements.SelectionArgumentVariableSearch,
		statements.UpdateSelectionArgument,
		documentID,
		scope,
	)
	if err != nil {
		return err
	}
	err = statements.ReplaceVariables(
		ctx,
		db,
		conn,
		statements.ArgumentValueVariableSearch,
		statements.UpdateArgumentValue,
		documentID,
		scope,
	)
	if err != nil {
		return err
	}

	errs := &plugins.ErrorList{}

	// we need to keep track of every fragment we created and its associated scope to apply
	newFragments := map[string]FragmentSpec{}

	// now we have to walk through the document and replace any fragment spreads that have @with
	err = db.BindStatement(
		statements.WithSpreadsInDocument,
		map[string]any{"document": documentID},
	)
	if err != nil {
		return err
	}
	withSearch := statements.WithSpreadsInDocument
	err = db.StepStatement(ctx, withSearch, func() {
		selectionID := withSearch.GetInt64("selection_id")
		fragmentDocID := withSearch.GetInt64("fragment_doc_id")
		fragmentName := withSearch.GetText("fragment")
		withArgsStr := withSearch.GetText("with_args")
		docVariablesStr := withSearch.GetText("doc_variables")
		typeCondition := withSearch.GetText("type_condition")
		rawDocument := withSearch.GetInt64("raw_document")

		withArgs := []struct {
			Name  string `json:"name"`
			Value int64  `json:"value"`
			Kind  string `json:"kind"`
			Raw   string `json:"raw"`
		}{}
		if withArgsStr != "" {
			err = json.Unmarshal([]byte(withArgsStr), &withArgs)
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
		}

		type DocArg struct {
			Name         string `json:"name"`
			DefaultValue int64  `json:"default_value"`
			Raw          string `json:"raw"`
		}
		docArgs := []DocArg{}
		if docVariablesStr != "" {
			err = json.Unmarshal([]byte(docVariablesStr), &docArgs)
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
		}

		// our goal here is to replace the fragment spread with a reference to a fragment that
		// has the arguments inlined. this means cloning the fragment and modifying any selections in the resulting clone

		// the first thing we have to do is compute the set of values being passed to the processedFragments
		fragmentHashArgs := map[string]string{}
		documentScope := map[string]DocArg{}
		for _, arg := range docArgs {
			if arg.DefaultValue != 0 {
				documentScope[arg.Name] = arg
			}
		}
		fragmentScope := map[string]int64{}
		for _, arg := range withArgs {
			// if the argument kind is a variable then we have 2 options, we either use the
			// parent scope or we have a default value
			if arg.Kind == "Variable" {
				if docArg, ok := scope[arg.Name]; ok {
					fragmentScope[arg.Name] = docArg
					fragmentHashArgs[arg.Name] = arg.Name
				} else if fragmentArg, ok := documentScope[arg.Name]; ok {
					fragmentScope[arg.Name] = fragmentArg.DefaultValue
					fragmentHashArgs[arg.Name] = fragmentArg.Raw
				}
			} else {
				fragmentScope[arg.Name] = arg.Value
				fragmentHashArgs[arg.Name] = arg.Raw
			}
		}

		// the new fragment name gets suffixed with a hashed version of the arguments applied to the
		args, err := json.Marshal(fragmentHashArgs)
		if err != nil {
			errs.Append(plugins.WrapError(err))
			return
		}
		newFragmentName := fragmentName + "_" + murmurHash(string(args))

		// clone the fragment document with the new name
		fragmentID, err := cloneDocument(
			ctx,
			db,
			conn,
			fragmentDocID,
			rawDocument,
			newFragmentName,
			typeCondition,
			statements,
		)
		if err != nil {
			errs.Append(plugins.WrapError(err))
			return
		}

		// store the fragment and its scope
		newFragments[newFragmentName] = FragmentSpec{
			Name:  newFragmentName,
			ID:    fragmentID,
			Scope: fragmentScope,
		}

		// and finally update the selection to point to the new fragment
		err = db.ExecStatement(statements.UpdateSelectionFieldName, map[string]any{
			"selection_id": selectionID,
			"field_name":   newFragmentName,
		})
		if err != nil {
			fmt.Println(err)
			errs.Append(plugins.WrapError(err))
			return
		}
	})
	// propagate any errors
	if err != nil {
		return err
	}
	if errs.Len() > 0 {
		return errors.New(errs.Error())
	}

	// now we can process every fragment that we ran into
	for _, fragment := range newFragments {
		// if we've seeen the fragment already skip it
		if _, ok := processedFragments.Load(fragment.Name); ok {
			continue
		}

		// don't process the fragment again
		processedFragments.Store(fragment.Name, true)

		// process the fragment
		err = processDocument(
			ctx,
			db,
			conn,
			statements,
			fragment.ID,
			fragment.Scope,
			processedFragments,
		)
		if err != nil {
			errs.Append(plugins.WrapError(err))
		}
	}
	if errs.Len() > 0 {
		return errors.New(errs.Error())
	}

	// we're done here
	return nil
}

// we need to make a copy of the document under a new name so we can process any variables
func cloneDocument[PluginConfig any](
	ctx context.Context,
	db plugins.DatabasePool[PluginConfig],
	conn *sqlite.Conn,
	sourceDocument int64,
	sourceRawDocument int64,
	name string,
	typeCondition string,
	statements *transformStatements[PluginConfig],
) (int64, error) {
	// the first thing we have to do is create a new document with the correct name
	err := db.ExecStatement(statements.InsertFragment, map[string]any{
		"name":           name,
		"type_condition": typeCondition,
		"raw_document":   sourceRawDocument,
	})
	if err != nil {
		return 0, err
	}
	documentID := conn.LastInsertRowID()

	// we'll perform the copy in a few steps - the first is to look for any selections
	// in the parent document that don't have arguments and copy those by just duplicating the
	// selection_ref
	err = db.ExecStatement(statements.CopySelectionsNoArgs, map[string]any{
		"from": sourceDocument,
		"to":   documentID,
	})
	if err != nil {
		return 0, err
	}

	// now we need to copy the argument values for this document which requires recreating the nested
	// structure with  the rows we create
	type FoundChildValue struct {
		Name     string
		Value    int64
		Filepath string
	}
	foundRows := map[int64][]FoundChildValue{}

	errs := &plugins.ErrorList{}

	// we need a mapping of old argument value to new argument value
	valueMap := map[int64]int64{}

	err = db.BindStatement(statements.ArgumentValueSearch, map[string]any{
		"document": sourceDocument,
	})
	if err != nil {
		return 0, err
	}
	err = db.StepStatement(ctx, statements.ArgumentValueSearch, func() {
		id := statements.ArgumentValueSearch.GetInt64("id")
		kind := statements.ArgumentValueSearch.GetText("kind")
		raw := statements.ArgumentValueSearch.GetText("raw")
		row := statements.ArgumentValueSearch.GetInt64("row")
		column := statements.ArgumentValueSearch.GetInt64("column")
		expectedType := statements.ArgumentValueSearch.GetText("expected_type")
		expectedTypeModifiers := statements.ArgumentValueSearch.GetText("expected_type_modifiers")

		var children []FoundChildValue
		argValues := statements.ArgumentValueSearch.GetText("children")
		if argValues != "" {
			err = json.Unmarshal([]byte(argValues), &children)
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
		}

		// insert the new argument value
		err := db.ExecStatement(statements.InsertArgumentValue, map[string]any{
			"kind":           kind,
			"raw":            raw,
			"row":            row,
			"column":         column,
			"type":           expectedType,
			"type_modifiers": expectedTypeModifiers,
			"document":       documentID,
		})
		if err != nil {
			errs.Append(plugins.WrapError(err))
			return
		}

		newValue := conn.LastInsertRowID()

		// add the found child to the list
		foundRows[id] = children
		// and keep track of the mapping
		valueMap[id] = newValue
	})
	if err != nil {
		return 0, err
	}
	if errs.Len() > 0 {
		return 0, errors.New(errs.Error())
	}

	// we now have a mapping from old argument value to their copy for the new document
	for oldValue, children := range foundRows {
		newParent, ok := valueMap[oldValue]
		if !ok {
			locations := []*plugins.ErrorLocation{}
			if len(children) > 0 {
				locations = append(locations, &plugins.ErrorLocation{
					Line:     0,
					Column:   0,
					Filepath: children[0].Filepath,
				})
			}

			return 0, plugins.Error{
				Message: fmt.Sprintf(
					"could not find value when copying document argument values: %v",
					oldValue,
				),
				Locations: locations,
			}
		}

		// insert the argument value child
		for _, child := range children {
			newChild, ok := valueMap[child.Value]
			if !ok {
				return 0, plugins.Error{
					Message: fmt.Sprintf(
						"could not find child value when copying document argument values: %v",
						child.Value,
					),
					Locations: []*plugins.ErrorLocation{
						{Line: 0, Column: 0, Filepath: children[0].Filepath},
					},
				}
			}

			err = db.ExecStatement(statements.InsertArgumentValueChildren, map[string]any{
				"name":     child.Name,
				"parent":   newParent,
				"value":    newChild,
				"document": documentID,
				"row":      0,
				"column":   0,
			})
			if err != nil {
				return 0, plugins.Error{
					Message: fmt.Sprintf(
						"encountered error inserting argument value children: %v",
						err,
					),
					Locations: []*plugins.ErrorLocation{
						{Line: 0, Column: 0, Filepath: child.Filepath},
					},
				}
			}
		}
	}

	// we need to build up a mapping of source selection IDs with args
	// to the selection we insert when copying it so that we can patch selection refs
	selectionMap := map[int64]int64{}

	// now we have copies every structured argument for the new document
	// so now the only thing we need to do is copy over selection and directive arguments
	// to the new mapped values
	err = db.BindStatement(
		statements.SearchSelectionsWithArgs,
		map[string]any{
			"document": sourceDocument,
		},
	)
	if err != nil {
		return 0, err
	}
	err = db.StepStatement(ctx, statements.SearchSelectionsWithArgs, func() {
		// every row we get here is a selection with an argument that we need to copy
		selectionID := statements.SearchSelectionsWithArgs.GetInt64("id")
		pathIndex := statements.SearchSelectionsWithArgs.GetInt64("path_index")
		fieldName := statements.SearchSelectionsWithArgs.GetText("field_name")
		kind := statements.SearchSelectionsWithArgs.GetText("kind")
		alias := statements.SearchSelectionsWithArgs.GetText("alias")
		selectionType := statements.SearchSelectionsWithArgs.GetText("type")

		var parentID any
		if !statements.SearchSelectionsWithArgs.ColumnIsNull(0) {
			parentID = statements.SearchSelectionsWithArgs.GetInt64("parent_id")
		}
		argValues := []struct {
			Name          string `json:"name"`
			Value         int64  `json:"value"`
			FieldArgument string `json:"field_argument"`
		}{}
		argsStr := statements.SearchSelectionsWithArgs.GetText("args")
		if argsStr != "" {
			err := json.Unmarshal(
				[]byte(argsStr),
				&argValues,
			)
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
		}

		// the first thing to do is to insert a selection with the equivalent info
		err = db.ExecStatement(statements.InsertSelection, map[string]any{
			"field_name": fieldName,
			"alias":      alias,
			"kind":       kind,
			"type":       selectionType,
		})
		if err != nil {
			errs.Append(plugins.WrapError(err))
			return
		}

		// now we can grab the id of the selection we just inserted
		newSelectionID := conn.LastInsertRowID()
		selectionMap[selectionID] = newSelectionID

		// now we can add the selection_ref
		err = db.ExecStatement(statements.InsertSelectionRef, map[string]any{
			"parent_id":  parentID,
			"child_id":   newSelectionID,
			"document":   documentID,
			"row":        0,
			"column":     0,
			"path_index": pathIndex,
		})
		if err != nil {
			errs.Append(plugins.WrapError(err))
			return
		}

		// and now we can copy the selection arguments
		for _, arg := range argValues {
			err = db.ExecStatement(statements.InsertSelectionArgument, map[string]any{
				"selection_id":   newSelectionID,
				"name":           arg.Name,
				"value":          valueMap[arg.Value],
				"row":            0,
				"column":         0,
				"field_argument": arg.FieldArgument,
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
		}

		// next thing we have to do is copy the directives
		directives := []struct {
			Name      string `json:"name"`
			Arguments []struct {
				Name  string `json:"name"`
				Value int64  `json:"value"`
			} `json:"arguments"`
		}{}
		directivesStr := statements.SearchSelectionsWithArgs.GetText("directives")
		if directivesStr != "" {
			err = json.Unmarshal([]byte(directivesStr), &directives)
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
		}
	})
	if err != nil {
		return 0, err
	}
	if errs.Len() > 0 {
		return 0, errors.New(errs.Error())
	}

	// the only thing left to do is patch the selection refs whose parents have args
	for from, to := range selectionMap {
		err = db.ExecStatement(statements.UpdateSelectionRef, map[string]any{
			"from": from,
			"to":   to,
		})
		if err != nil {
			return 0, err
		}
	}

	return documentID, nil
}

type transformStatements[PluginConfig any] struct {
	WithSpreadsInDocument            *sqlite.Stmt
	DeleteValue                      *sqlite.Stmt
	InsertNullValue                  *sqlite.Stmt
	ArgumentValueVariableSearch      *sqlite.Stmt
	SelectionArgumentVariableSearch  *sqlite.Stmt
	UpdateArgumentValue              *sqlite.Stmt
	UpdateSelectionArgument          *sqlite.Stmt
	CopySelectionsNoArgs             *sqlite.Stmt
	InsertFragment                   *sqlite.Stmt
	ArgumentValueSearch              *sqlite.Stmt
	InsertArgumentValue              *sqlite.Stmt
	InsertArgumentValueChildren      *sqlite.Stmt
	SearchSelectionsWithArgs         *sqlite.Stmt
	InsertSelection                  *sqlite.Stmt
	InsertSelectionRef               *sqlite.Stmt
	InsertSelectionArgument          *sqlite.Stmt
	InsertSelectionDirective         *sqlite.Stmt
	InsertSelectionDirectiveArgument *sqlite.Stmt
	UpdateSelectionRef               *sqlite.Stmt
	UpdateSelectionFieldName         *sqlite.Stmt
	nullValue                        int64
}

func prepareTransformStatements[PluginConfig any](
	conn *sqlite.Conn,
) (*transformStatements[PluginConfig], error) {
	withSpreadsInDocument, err := conn.Prepare(`
    SELECT 
      parent_doc.name as document,
      selection_refs.id as selection_ref,
      selections.id as selection_id,
      selections.field_name as fragment,
      fragment_doc.id as fragment_doc_id,
      json_group_array(
        json_object(
          'name', selection_directive_arguments."name",
          'value', selection_directive_arguments."value",
          'kind', selection_arg_values.kind,
          'raw', selection_arg_values.raw
        )
      ) as with_args,
      CASE 
        WHEN document_variables.name IS NULL THEN NULL
        ELSE 
          json_group_array(
            json_object(
              'name', document_variables."name",
              'default_value', document_variables."default_value",
              'raw', document_variable_default_values."raw"
            )
          ) 
      END as doc_variables,
      fragment_doc.type_condition as type_condition,
      fragment_doc.raw_document as raw_document
    FROM selection_directives
      JOIN selections ON selection_directives.selection_id = selections.id
      JOIN selection_refs ON selection_refs.child_id = selections.id
      JOIN selection_directive_arguments ON selection_directives.id = selection_directive_arguments.parent
      JOIN argument_values as selection_arg_values ON selection_directive_arguments."value" = selection_arg_values.id
      JOIN documents as parent_doc ON selection_refs."document" = parent_doc.id
      JOIN documents as fragment_doc on selections.field_name = fragment_doc.name
      LEFT JOIN document_variables on fragment_doc.id = document_variables."document"
      LEFT JOIN argument_values as document_variable_default_values on document_variable_default_values.id = document_variables.default_value
    WHERE selection_directives.directive = $with_directive
      AND selections.kind = 'fragment'
    	AND selection_refs."document" = $document
    GROUP BY selection_directives.id, parent_doc.id
  `)
	if err != nil {
		return nil, err
	}
	withSpreadsInDocument.SetText("$with_directive", schema.WithDirective)

	deleteValue, err := conn.Prepare(`
    DELETE FROM argument_values WHERE id = $id
  `)
	if err != nil {
		return nil, err
	}

	insertNullValue, err := conn.Prepare(`
    INSERT INTO argument_values (kind, raw) VALUES ('Null', 'null')
  `)
	if err != nil {
		return nil, err
	}

	variableSearch, err := conn.Prepare(`
    SELECT 
      argument_value_children.id as parent, 
      argument_values.id as value,
      argument_values.raw as variable 
    FROM argument_values 
      JOIN argument_value_children on argument_value_children.value = argument_values.id
    WHERE argument_values.kind = 'Variable' AND argument_values.document = $document
  `)
	if err != nil {
		return nil, err
	}

	selectionArgVariables, err := conn.Prepare(`
    SELECT 
      selection_arguments.id as parent, 
      argument_values.id as value, 
      raw as variable
    FROM selection_arguments
      JOIN argument_values on selection_arguments.value = argument_values.id
    WHERE kind = 'Variable' AND document = $document
  `)
	if err != nil {
		return nil, err
	}

	updateSelectionArgument, err := conn.Prepare(`
    UPDATE selection_arguments SET value = $value WHERE id = $id
  `)
	if err != nil {
		return nil, err
	}

	updateArgumentValue, err := conn.Prepare(`
    UPDATE argument_value_children SET value = $value WHERE id = $id
  `)
	if err != nil {
		return nil, err
	}

	copySelectionsNoArgs, err := conn.Prepare(`
    INSERT INTO selection_refs (parent_id, child_id, path_index, document, row, column)
    SELECT 
        sr.parent_id,
        sr.child_id,
        sr.path_index,
        $to AS document,
        sr.row,
        sr.column
    FROM selection_refs sr
    LEFT JOIN selection_arguments sa ON sr.child_id = sa.selection_id
    WHERE sr.document = $from
      AND sa.selection_id IS NULL
  `)
	if err != nil {
		return nil, err
	}

	insertFragment, err := conn.Prepare(`
    INSERT INTO documents (name, type_condition, raw_document, kind) VALUES  ($name, $type_condition, $raw_document, 'fragment')
  `)
	if err != nil {
		return nil, err
	}

	argumentValueSearch, err := conn.Prepare(`
    SELECT 
      argument_values.*, 
      CASE WHEN argument_value_children."value" IS NULL 
        THEN null
        ELSE 
          json_group_array(
            json_object (
              'name', argument_value_children."name",
              'value', argument_value_children."value",
              'filepath', raw_documents.filepath
          )
        )
      END as children
    FROM argument_values 
      LEFT JOIN argument_value_children ON argument_value_children.parent = argument_values.id
      JOIN documents on argument_values.document = documents.id
      JOIN raw_documents on documents.raw_document = raw_documents.id
    WHERE documents.id = $document
    GROUP BY argument_values.id
  `)
	if err != nil {
		return nil, err
	}

	insertArgumentValue, err := conn.Prepare(`
    INSERT INTO argument_values (
      kind, 
      raw, 
      row, 
      column, 
      expected_type, 
      expected_type_modifiers, 
      document
    ) VALUES (
      $kind, 
      $raw, 
      $row, 
      $column, 
      $type,
      $type_modifiers,
      $document
    )
  `)
	if err != nil {
		return nil, err
	}

	insertArgumentValueChildren, err := conn.Prepare(`
    INSERT INTO argument_value_children (name, parent, value, row, column, document) VALUES ($name, $parent, $value, $row, $column, $document)
  `)
	if err != nil {
		return nil, err
	}

	searchSelectionsWithArgs, err := conn.Prepare(`
    SELECT 
      selection_refs.parent_id,
      selection_refs.*,
      selections.*,
      json_group_array(
        json_object(
          'name', selection_arguments.name,
          'value', selection_arguments.value,
          'field_argument', selection_arguments.field_argument
        )
      ) AS args,
      (
        SELECT json_group_array(
          json_object(
            'name', selection_directives.directive,
            'row', selection_directives.row,
            'column', selection_directives.column,
            'arguments', (
              SELECT json_group_array(
                json_object(
                  'name', selection_directive_arguments.name,
                  'value', selection_directive_arguments.value
                )
              )
              FROM selection_directive_arguments
              WHERE selection_directive_arguments.parent = selection_directives.id
            )
          )
        )
        FROM selection_directives
        WHERE selection_directives.selection_id = selections.id
      ) AS directives
    FROM selection_refs
      JOIN selections ON selection_refs.child_id = selections.id
      JOIN selection_arguments ON selections.id = selection_arguments.selection_id
    WHERE selection_refs.document = $document
    GROUP BY selections.id
  `)
	if err != nil {
		return nil, err
	}

	insertSelection, err := conn.Prepare(`
    INSERT INTO selections (field_name, alias, kind, type) VALUES ($field_name, $alias, $kind, $type)
  `)
	if err != nil {
		return nil, err
	}

	insertSelectionRef, err := conn.Prepare(`
    INSERT INTO selection_refs (parent_id, child_id, document, row, column, path_index) VALUES ($parent_id, $child_id, $document, $row, $column, $path_index)
`)
	if err != nil {
		return nil, err
	}

	insertSelectionArgument, err := conn.Prepare(`
    INSERT INTO selection_arguments (selection_id, name, value, row, column, field_argument) VALUES ($selection_id, $name, $value, $row, $column, $field_argument)
  `)
	if err != nil {
		return nil, err
	}
	insertSelectionDirective, err := conn.Prepare(`
    INSERT INTO selection_directives (selection_id, directive, row, column) VALUES ($selection_id, $directive, $row, $column)
  `)
	if err != nil {
		return nil, err
	}
	insertSelectionDirectiveArgument, err := conn.Prepare(`
    INSERT INTO selection_directive_arguments (parent, name, value) VALUES ($parent, $name, $value)
  `)
	if err != nil {
		return nil, err
	}

	updateSelectionRef, err := conn.Prepare(`
    UPDATE selection_refs SET parent_id = $to WHERE parent_id = $from
  `)
	if err != nil {
		return nil, err
	}

	updateSelectionFieldName, err := conn.Prepare(`
    UPDATE selections SET field_name = $field_name WHERE id = $selection_id
  `)
	if err != nil {
		return nil, err
	}

	return &transformStatements[PluginConfig]{
		WithSpreadsInDocument:            withSpreadsInDocument,
		DeleteValue:                      deleteValue,
		InsertNullValue:                  insertNullValue,
		ArgumentValueVariableSearch:      variableSearch,
		UpdateArgumentValue:              updateArgumentValue,
		SelectionArgumentVariableSearch:  selectionArgVariables,
		UpdateSelectionArgument:          updateSelectionArgument,
		CopySelectionsNoArgs:             copySelectionsNoArgs,
		InsertFragment:                   insertFragment,
		ArgumentValueSearch:              argumentValueSearch,
		InsertArgumentValue:              insertArgumentValue,
		InsertArgumentValueChildren:      insertArgumentValueChildren,
		SearchSelectionsWithArgs:         searchSelectionsWithArgs,
		InsertSelection:                  insertSelection,
		InsertSelectionRef:               insertSelectionRef,
		InsertSelectionArgument:          insertSelectionArgument,
		InsertSelectionDirective:         insertSelectionDirective,
		InsertSelectionDirectiveArgument: insertSelectionDirectiveArgument,
		UpdateSelectionRef:               updateSelectionRef,
		UpdateSelectionFieldName:         updateSelectionFieldName,
	}, nil
}

func (s *transformStatements[PluginConfig]) Finalize() {
	s.WithSpreadsInDocument.Finalize()
	s.DeleteValue.Finalize()
	s.InsertNullValue.Finalize()
	s.ArgumentValueVariableSearch.Finalize()
	s.SelectionArgumentVariableSearch.Finalize()
	s.UpdateSelectionArgument.Finalize()
	s.UpdateArgumentValue.Finalize()
	s.CopySelectionsNoArgs.Finalize()
	s.InsertFragment.Finalize()
	s.ArgumentValueSearch.Finalize()
	s.InsertArgumentValue.Finalize()
	s.InsertArgumentValueChildren.Finalize()
	s.SearchSelectionsWithArgs.Finalize()
	s.InsertSelection.Finalize()
	s.InsertSelectionRef.Finalize()
	s.InsertSelectionArgument.Finalize()
	s.InsertSelectionDirective.Finalize()
	s.InsertSelectionDirectiveArgument.Finalize()
	s.UpdateSelectionRef.Finalize()
}

func (s *transformStatements[PluginConfig]) ReplaceVariables(
	ctx context.Context,
	db plugins.DatabasePool[PluginConfig],
	conn *sqlite.Conn,
	search *sqlite.Stmt,
	update *sqlite.Stmt,
	documentID int64,
	scope map[string]int64,
) error {
	errs := &plugins.ErrorList{}

	db.BindStatement(search, map[string]any{"document": documentID})
	err := db.StepStatement(ctx, search, func() {
		parentValue := search.GetInt64("parent")
		variableName := search.GetText("variable")
		oldValue := search.GetInt64("value")

		// if the variable name is not defined in the scope then we need to delete the original
		// value and replace it with null otherwise we'll replace it with the scope value
		scopeValue, ok := scope[variableName]

		// if the scoped value is the same as the value then we're done here
		// this happens for variables contained in the document
		if ok && scopeValue == oldValue {
			return
		}

		// if the variable does not have a scoped value then we need to set it to null
		if !ok {
			if s.nullValue == 0 {
				// and we only want to insert a single null value per document
				err := db.ExecStatement(s.InsertNullValue, nil)
				if err != nil {
					errs.Append(plugins.WrapError(err))
					return
				}

				s.nullValue = conn.LastInsertRowID()
			}

			scopeValue = s.nullValue
		}

		// replace the argument value with the scoped one
		err := db.ExecStatement(update, map[string]any{"id": parentValue, "value": scopeValue})
		if err != nil {
			errs.Append(plugins.WrapError(err))
			return
		}

		// by now, the value passed to the scope will replace the old value so we need to delete it
		err = db.ExecStatement(s.DeleteValue, map[string]any{"id": oldValue})
		if err != nil {
			errs.Append(plugins.WrapError(err))
			return
		}
	})
	if err != nil {
		return err
	}
	if errs.Len() > 0 {
		return errors.New(errs.Error())
	}
	return nil
}

type FragmentSpec struct {
	Name  string
	ID    int64
	Scope map[string]int64
}
