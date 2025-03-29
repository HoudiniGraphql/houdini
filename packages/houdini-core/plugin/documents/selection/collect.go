package selection

import (
	"context"
	"encoding/json"
	"fmt"
	"runtime"
	"strings"
	"sync"

	"zombiezen.com/go/sqlite"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins"
)

// CollectDocuments takes a document ID and grabs its full selection set along with the selection sets of
// all referenced fragments
func CollectDocuments(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
) (map[string]*CollectedDocument, error) {
	result := map[string]*CollectedDocument{}

	conn, err := db.Take(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Put(conn)

	// the first thing we have to do is id of every document that we care about
	docIDs := []int64{}

	// the documents we care about are those that fall in the current task as well as
	// any fragments that are referenced in a document that is in the current task
	documentSearch, err := conn.Prepare(`
    SELECT documents.id 
    FROM documents 
      JOIN raw_documents ON documents.raw_document = raw_documents.id
    WHERE (raw_documents.current_task = $task_id OR $task_id is null)

    UNION

    SELECT documents.id
    FROM selections 
      JOIN documents ON selections.field_name = documents."name" 
      JOIN selection_refs ON selection_refs.child_id = selections.id
      JOIN documents selection_docs ON selection_refs.document = selection_docs.id
      JOIN raw_documents ON selection_docs.raw_document = raw_documents.id
    WHERE selections.kind = 'fragment' AND (raw_documents.current_task = $task_id OR $task_id is null)
  `)
	if err != nil {
		return nil, err
	}
	err = db.StepStatement(ctx, documentSearch, func() {
		docIDs = append(docIDs, documentSearch.GetInt64("id"))
	})
	if err != nil {
		return nil, err
	}

	// now that we have the list of relevant documents we need to process we should collect their definitions
	// in principle there could be a large number of documents that need to be collected so we'll parallelize this
	// part of the proces

	// the batch size depends on how many there are. at the maximum, the batch size is nDocuments / nCpus
	// but if that's above 100, then we should cap it at 100
	batchSize := max(1, min(100, len(docIDs)/runtime.NumCPU()))

	// create a channel to send batches of ids to process
	batchCh := make(chan []int64, len(docIDs))
	// and a channel to send errors back
	errCh := make(chan *plugins.Error, len(docIDs))
	// and a channel to send collected documents back
	resultCh := make(chan []*CollectedDocument, len(docIDs))

	// create a pool of worker goroutines to process the documents
	var wg sync.WaitGroup
	for range runtime.NumCPU() {
		wg.Add(1)
		go collectDoc(ctx, db, &wg, batchCh, resultCh, errCh)
	}

	// partition the docIDs into batches and send them to the workers
	for i := 0; i < len(docIDs); i += batchSize {
		batchCh <- docIDs[i:min(i+batchSize, len(docIDs))]
	}

	// close the channel to signal no more batches are coming.
	close(batchCh)

	// wait for all workers to finish processing.
	wg.Wait()

	// close the error channel since no more errors will be sent.
	close(errCh)
	close(resultCh)

	// process any errors that occurred.
	errList := &plugins.ErrorList{}
	for err := range errCh {
		errList.Append(err)
	}
	// collect the results
	for docs := range resultCh {
		for _, doc := range docs {
			result[doc.Name] = doc
		}
	}

	// return any errors that were found
	if errList.Len() > 0 {
		return nil, errList
	}

	// if we got this far, we're done
	return result, nil
}

func collectDoc(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	wg *sync.WaitGroup,
	docIDs <-chan []int64,
	resultCh chan<- []*CollectedDocument,
	errCh chan<- *plugins.Error,
) {
	defer wg.Done()

	// hold onto a connection for the collection process
	conn, err := db.Take(ctx)
	if err != nil {
		errCh <- plugins.WrapError(err)
		return
	}
	defer db.Put(conn)

	for batch := range docIDs {
		// wrap each processing in a function so we have a defer context to avoid deadlocking the connection
		func(ids []int64) {
			// prepare the search statemetns
			statements, err := prepareCollectStatements(conn, ids)
			if err != nil {
				errCh <- plugins.WrapError(err)
				return
			}
			defer statements.Finalize()

			// first we need to recreate the selection set for every document that we were given in the batch

			// build up a mapping of document name to the collected version
			documents := map[string]*CollectedDocument{}
			// and in order to build up the correct tree structure we need a mapping of selection ID
			// to the actual selection
			selections := map[int64]*CollectedSelection{}

			// as a follow up, we need to recreate the arguments and directives that were assigned to the selection
			argumentValues := map[int64]*CollectedArgumentValue{}
			directiveArgumentsWithValues := []*CollectedDirectiveArgument{}
			selectionArgumentsWithValues := []*CollectedArgument{}
			documentArgumentsWithValues := []*CollectedOperationVariable{}

			// step through the selections and build up the tree
			err = db.StepStatement(ctx, statements.Search, func() {
				// pull out the columns we care about
				selectionID := statements.Search.GetInt64("id")
				documentName := statements.Search.GetText("document_name")
				documentID := statements.Search.GetInt64("document_id")
				kind := statements.Search.GetText("kind")
				fieldName := statements.Search.GetText("field_name")

				var alias *string
				if !statements.Search.IsNull("alias") {
					aliasValue := statements.Search.GetText("alias")
					alias = &aliasValue

				}

				// create the collected selection from the information we have
				selection := &CollectedSelection{
					FieldName: fieldName,
					Alias:     alias,
					Kind:      kind,
				}

				// save the ID in the selection map
				selections[selectionID] = selection

				// if there is no parent then we have a root selection
				if statements.Search.IsNull("parent_id") {
					// the selection is a root selection

					// this could be the first time we see the document
					doc, ok := documents[documentName]
					if !ok {
						doc = &CollectedDocument{
							ID:   documentID,
							Name: documentName,
						}
						documents[documentName] = doc
					}

				} else {
					// if we have a parent then we need to save it in the parent's children
					parentID := statements.Search.GetInt64("parent_id")
					parent, ok := selections[parentID]
					if !ok {
						errCh <- plugins.WrapError(fmt.Errorf("parent selection %v not found for selection %v", parentID, selectionID))
					}
					parent.Children = append(parent.Children, selection)
				}

				// if the selection is a fragment, we need to save the ID in the document's list of referenced fragments
				if kind == "fragment" {
					documents[documentName].ReferencedFragments = append(
						documents[documentName].ReferencedFragments,
						fieldName,
					)
				}

				// we need to build up any arguments and directives referenced but we will fill in the actual values later

				// arguments
				if !statements.Search.IsNull("arguments") {
					arguments := statements.Search.GetText("arguments")

					args := []*CollectedArgument{}
					if err := json.Unmarshal([]byte(arguments), &args); err != nil {
						errCh <- plugins.WrapError(err)
						return
					}

					// hold onto the valueID. we'll fill in the value later
					for _, arg := range args {
						if arg.ValueID != nil {
							argumentValues[*arg.ValueID] = nil
							selectionArgumentsWithValues = append(selectionArgumentsWithValues, arg)
						}
					}

					selection.Arguments = args
				}

				// directives get treated the same as arguments
				if !statements.Search.IsNull("directives") {
					directives := statements.Search.GetText("directives")

					dirs := []*CollectedDirective{}
					if err := json.Unmarshal([]byte(directives), &dirs); err != nil {
						errCh <- plugins.WrapError(err)
						return
					}

					// hold onto the valueID. we'll fill in the value later
					for _, dir := range dirs {
						for _, arg := range dir.Arguments {
							if arg.ValueID != nil {
								argumentValues[*arg.ValueID] = nil
								directiveArgumentsWithValues = append(
									directiveArgumentsWithValues,
									arg,
								)
							}
						}
					}

					selection.Directives = dirs
				}
			})
			if err != nil {
				errCh <- plugins.WrapError(err)
				return
			}

			// the next thing we have to do is look for document variables
			err = db.StepStatement(ctx, statements.DocumentVariables, func() {
				// every row we get corresponds to a document variable we care about
				name := statements.DocumentVariables.GetText("name")
				variableType := statements.DocumentVariables.GetText("type")
				modifiers := statements.DocumentVariables.GetText("type_modifiers")
				documentName := statements.DocumentVariables.GetText("document_name")

				// create the collected operation variable
				variable := &CollectedOperationVariable{
					Name:          name,
					Type:          variableType,
					TypeModifiers: modifiers,
					Directives:    []*CollectedDirective{},
				}

				// if there is a default value, we need to save the ID in the argument values
				if !statements.DocumentVariables.IsNull("default_value") {
					valueID := statements.DocumentVariables.GetInt64("default_value")
					argumentValues[valueID] = nil
					variable.DefaultValueID = &valueID
					documentArgumentsWithValues = append(documentArgumentsWithValues, variable)
				}

				// directives get treated the same as arguments
				if !statements.DocumentVariables.IsNull("directives") {
					directives := statements.DocumentVariables.GetText("directives")

					dirs := []*CollectedDirective{}
					if err := json.Unmarshal([]byte(directives), &dirs); err != nil {
						errCh <- plugins.WrapError(err)
						return
					}

					// hold onto the valueID. we'll fill in the value later
					for _, dir := range dirs {
						for _, arg := range dir.Arguments {
							if arg.ValueID != nil {
								argumentValues[*arg.ValueID] = nil
								directiveArgumentsWithValues = append(
									directiveArgumentsWithValues,
									arg,
								)
							}
						}
					}

					variable.Directives = dirs
				}

				// save the variable in the document's list of variables
				doc, ok := documents[documentName]
				if !ok {
					errCh <- plugins.WrapError(fmt.Errorf("document %v not found for variable %v", documentName, name))
				}
				doc.Variables = append(doc.Variables, variable)
			})
			if err != nil {
				errCh <- plugins.WrapError(err)
			}

			// if we've gotten this far then we have recreated the full selection apart from the nested argument structure

			// build up the list of documents we collected
			docs := []*CollectedDocument{}
			for _, doc := range documents {
				docs = append(docs, doc)
			}

			// send the result over the channel
			resultCh <- docs
		}(batch)
	}
}

type CollectStatements struct {
	Search            *sqlite.Stmt
	DocumentVariables *sqlite.Stmt
}

func prepareCollectStatements(conn *sqlite.Conn, docIDs []int64) (*CollectStatements, error) {
	// we are going to produce a version of the document that looks up a batch of documents
	// which means we need to produce enough ?'s to create a WHERE IN
	placeholders := make([]string, len(docIDs))
	for i := range docIDs {
		placeholders[i] = fmt.Sprintf("$document_%v", i)
	}

	// join the placeholders with commas and enclose in parentheses.
	whereIn := "(" + strings.Join(placeholders, ", ") + ")"

	search, err := conn.Prepare(fmt.Sprintf(`
    WITH 
      directive_args AS (
        SELECT
          selection_directive_arguments.parent AS directive_id,
          json_group_array(
            json_object(
            'name', selection_directive_arguments.name, 
            'value', selection_directive_arguments.value
            )
          ) AS directive_arguments
        FROM
          selection_directive_arguments
          JOIN selection_directives ON selection_directive_arguments.parent = selection_directives.id
          JOIN selection_refs ON selection_refs.child_id = selection_directives.selection_id
        WHERE
          selection_refs."document" IN %s
        GROUP BY
          selection_directive_arguments.parent
      ),
      directives_agg AS (
        SELECT
          sd.selection_id,
          json_group_array(
            json_object(
              'id', sd.id,
              'name', sd.directive,
              'arguments', json(IFNULL(da.directive_arguments, '[]'))
            )
          ) AS directives
        FROM selection_directives sd
          LEFT JOIN directive_args da ON da.directive_id = sd.id
          JOIN selection_refs ON selection_refs.child_id = sd.selection_id
        WHERE
          selection_refs."document" IN %s
        GROUP BY sd.selection_id
      ),
      arguments_agg AS (
        SELECT
          selection_arguments.selection_id,
          json_group_array(
            json_object(
              'name', selection_arguments.name,
              'value', selection_arguments.value
            )
          ) AS arguments
        FROM selection_arguments
          JOIN selection_refs ON selection_refs.child_id = selection_arguments.selection_id
        WHERE
          selection_refs."document" IN %s
        GROUP BY selection_arguments.selection_id
      ),
      selection_tree AS (
        -- Base case: root selections (those with a selection_ref that has no parent)
        SELECT 
          selections.id,
          selections.field_name,
          selections.alias,
          selections.kind,
          d.id AS document_id,
          d.name AS document_name,
          NULL AS parent_id,
          a.arguments,
          dct.directives
        FROM selections
        JOIN selection_refs 
          ON selection_refs.child_id = selections.id 
         AND selection_refs.parent_id IS NULL
        LEFT JOIN documents d 
          ON d.id = selection_refs.document
        LEFT JOIN directives_agg dct 
          ON dct.selection_id = selections.id
        LEFT JOIN arguments_agg a 
          ON a.selection_id = selections.id
        WHERE d.id IN %s
      
        UNION ALL
      
        -- Recursive case: child selections
        SELECT 
          selections.id,
          selections.field_name,
          selections.alias,
          selections.kind,
          st.document_id AS document_id,
          st.document_name AS document_name,
          st.id AS parent_id,
          a.arguments,
          dct.directives
        FROM selections
        JOIN selection_refs ON selection_refs.child_id = selections.id AND selection_refs.document IN %s
        JOIN selection_tree st ON selection_refs.parent_id = st.id
        LEFT JOIN directives_agg dct ON dct.selection_id = selections.id
        LEFT JOIN arguments_agg a ON a.selection_id = selections.id
      )
    SELECT id, document_name, document_id, kind, field_name, alias, arguments, directives, parent_id FROM selection_tree
    ORDER BY parent_id
  `, whereIn, whereIn, whereIn, whereIn, whereIn))
	if err != nil {
		return nil, err
	}

	documentVariables, err := conn.Prepare(fmt.Sprintf(`
    WITH 
    directive_args AS (
      SELECT
        document_variable_directive_arguments.parent AS variable_id,
        json_group_array(
           json_object(
             'name', document_variable_directive_arguments.name,
             'value', document_variable_directive_arguments.value
           )
        ) AS arguments
      FROM document_variable_directive_arguments
        JOIN document_variable_directives ON 
          document_variable_directive_arguments.parent = document_variable_directives.id
        JOIN document_variables ON document_variable_directives.parent = document_variables.id
      WHERE document_variables.document IN %s
      GROUP BY document_variable_directive_arguments.parent
    ),
    doc_directives AS (
      SELECT
        document_variable_directives.parent AS variable_id,
        json_group_array(
          json_object(
            'id', document_variable_directives.id,
            'name', document_variable_directives.directive,
            'arguments', json(IFNULL(directive_args.arguments, '[]'))
          )
        ) AS directives
      FROM document_variable_directives
        LEFT JOIN directive_args ON directive_args.variable_id = document_variable_directives.id
        JOIN document_variables ON document_variable_directives.parent = document_variables.id
      WHERE document_variables.document IN %s
      GROUP BY document_variable_directives.parent
    )
    SELECT 
      document_variables.*,
      documents.name AS document_name,
      doc_directives.directives AS directives
    FROM 
      document_variables 
      JOIN documents ON document_variables.document = documents.id
      LEFT JOIN doc_directives ON doc_directives.variable_id = document_variables.id
    WHERE documents.id in %s
    GROUP BY document_variables.id
  `, whereIn, whereIn, whereIn))
	if err != nil {
		return nil, err
	}

	// bind each document ID to the variables that were prepared
	for _, stmt := range []*sqlite.Stmt{search, documentVariables} {
		for i, id := range docIDs {
			stmt.SetInt64(fmt.Sprintf("$document_%v", i), id)
		}
	}

	return &CollectStatements{
		Search:            search,
		DocumentVariables: documentVariables,
	}, nil
}

func (s *CollectStatements) Finalize() {
	s.Search.Finalize()
	s.DocumentVariables.Finalize()
}

type CollectedDocument struct {
	ID                  int64
	Name                string
	Kind                string // "query", "mutation", "subscription", or "fragment"
	TypeCondition       *string
	Variables           []*CollectedOperationVariable
	Selections          []*CollectedSelection
	Directives          []*CollectedDirective
	ReferencedFragments []string
}

type CollectedSelection struct {
	FieldName  string
	Alias      *string
	Kind       string
	Arguments  []*CollectedArgument
	Directives []*CollectedDirective
	Children   []*CollectedSelection
}

type CollectedOperationVariable struct {
	Name           string
	Type           string
	TypeModifiers  string
	DefaultValue   *CollectedArgumentValue
	DefaultValueID *int64
	Directives     []*CollectedDirective
}

type CollectedArgument struct {
	Name    string `json:"name"`
	ValueID *int64 `json:"value"`
	Value   *CollectedArgumentValue
}

type CollectedArgumentValue struct {
	Kind     string
	Raw      string
	Children []*CollectedArgumentValueChildren
}

type CollectedArgumentValueChildren struct {
	Name  string
	Value *CollectedArgumentValue
}

type CollectedDirectiveArgument struct {
	Name    string `json:"name"`
	ValueID *int64 `json:"value"`
	Value   *CollectedArgumentValue
}

type CollectedDirective struct {
	Name      string                        `json:"name"`
	Arguments []*CollectedDirectiveArgument `json:"arguments"`
}
