package artifacts

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"runtime"
	"sort"
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
	conn *sqlite.Conn,
	sortKeys bool,
) (*CollectedDocuments, error) {
	result := &CollectedDocuments{
		Selections:      map[string]*CollectedDocument{},
		TaskDocuments:   []string{},
		PossibleTypes:   map[string]map[string]bool{},
		Implementations: map[string]map[string]bool{},
		InputTypes:      map[string]map[string]string{},
		EnumValues:      map[string][]string{},
	}

	// the first thing we have to do is id of every document that we care about
	docIDs := []int64{}

	// the documents we care about are those that fall in the current task as well as
	// any fragments that are referenced in a document that is in the current task
	documentSearch, err := conn.Prepare(`
    SELECT documents.id,
           documents.name,
           true  AS current
    FROM documents
    JOIN raw_documents
      ON documents.raw_document = raw_documents.id
    WHERE (raw_documents.current_task = $task_id OR $task_id IS NULL)

    UNION ALL

    SELECT documents.id,
           documents.name,
           false AS current
    FROM selections
      JOIN documents
        ON selections.field_name = documents.name
      JOIN selection_refs
        ON selection_refs.child_id = selections.id
      JOIN documents AS selection_docs
        ON selection_refs.document = selection_docs.id
      -- only consider selections in documents within the current task
      JOIN raw_documents
        ON selection_docs.raw_document = raw_documents.id
      -- but don't include any documents that were picked up because of the current task
      JOIN raw_documents AS doc_raw
        ON documents.raw_document = doc_raw.id
    WHERE selections.kind = 'fragment'
      AND (raw_documents.current_task = $task_id OR $task_id IS NULL)
      AND NOT (doc_raw.current_task   = $task_id OR $task_id IS NULL)
  `)
	if err != nil {
		return nil, err
	}
	err = db.StepStatement(ctx, documentSearch, func() {
		docIDs = append(docIDs, documentSearch.GetInt64("id"))
		if documentSearch.GetBool("current") {
			result.TaskDocuments = append(result.TaskDocuments, documentSearch.GetText("name"))
		}
	})
	if err != nil {
		return nil, err
	}

	// now that we have the list of relevant documents we need to process we should collect their definitions
	// in principle there could be a large number of documents that need to be collected so we'll parallelize this
	// part of the proces

	// the batch size depends on how many there are. at the maximum, the batch size is nDocuments / nCpus
	// but if that's above 100, then we should cap it at 100
	batchSize := max(1, min(100, len(docIDs)/runtime.NumCPU()+1))

	// create a channel to send batches of ids to process
	batchCh := make(chan []int64, len(docIDs))
	// we need a thread safe list to collect errors
	errList := &plugins.ErrorList{}
	// and a channel to send collected documents back
	resultCh := make(chan collectResult, len(docIDs))

	// create a pool of worker goroutines to process the documents
	var wg sync.WaitGroup
	for range runtime.NumCPU() {
		wg.Add(1)
		go collectDoc(ctx, db, &wg, batchCh, resultCh, errList, sortKeys)
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
	close(resultCh)

	// collect the results
	for docs := range resultCh {
		for _, doc := range docs.Documents {
			result.Selections[doc.Name] = doc
		}
		for typeName, members := range docs.PossibleTypes {
			if _, ok := result.PossibleTypes[typeName]; !ok {
				result.PossibleTypes[typeName] = map[string]bool{}
			}
			for _, member := range members {
				result.PossibleTypes[typeName][member] = true
			}
		}

		// copy the two input type maps
		maps.Copy(result.InputTypes, docs.InputTypes)
		maps.Copy(result.EnumValues, docs.EnumValues)
	}

	// if we got this far we can reverse the type mappings to get the implementations
	for typeName := range result.PossibleTypes {
		for member := range result.PossibleTypes[typeName] {
			if _, ok := result.Implementations[member]; !ok {
				result.Implementations[member] = map[string]bool{}
			}
			result.Implementations[member][typeName] = true
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
	resultCh chan<- collectResult,
	errs *plugins.ErrorList,
	sortKeys bool,
) {
	defer wg.Done()

	// hold onto a connection for the collection process
	conn, err := db.Take(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer db.Put(conn)

	for batch := range docIDs {
		// wrap each processing in a function so we have a defer context to avoid deadlocking the connection
		func(ids []int64) {
			// prepare the search statemetns
			statements, err := prepareCollectStatements(conn, ids)
			if err != nil {
				errs.Append(plugins.WrapError(err))
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
			argumentsWithValues := []*CollectedArgument{}
			documentArgumentsWithValues := []*CollectedOperationVariable{}

			// the insert order doesn't necessarily match the toposort order for fields when we've inserted fields
			// after the original loading so we need to hold onto a list of selections that need to be patched
			missingParents := map[int64][]*CollectedSelection{}

			// step through the selections and build up the tree
			err = db.StepStatement(ctx, statements.Search, func() {
				// pull out the columns we care about
				selectionID := statements.Search.GetInt64("id")
				documentName := statements.Search.GetText("document_name")
				documentID := statements.Search.GetInt64("document_id")
				kind := statements.Search.GetText("kind")
				fieldName := statements.Search.GetText("field_name")
				fieldType := statements.Search.GetText("type")
				fragmentRef := statements.Search.GetText("fragment_ref")
				listName := statements.Search.GetText("list_name")
				listType := statements.Search.GetText("list_type")
				listConnection := statements.Search.GetBool("list_connection")
				listPageSize := statements.Search.GetInt64("list_page_size")
				listTargetType := statements.Search.GetText("list_target_type")
				listEmbedded := statements.Search.GetBool("list_embedded")
				listMode := statements.Search.GetText("list_mode")

				if listMode == "" {
					listMode = "Infinite"
				}

				var typeModifiers *string
				if !statements.Search.IsNull("type_modifiers") {
					mods := statements.Search.GetText("type_modifiers")
					typeModifiers = &mods
				}

				var alias *string
				if !statements.Search.IsNull("alias") {
					aliasValue := statements.Search.GetText("alias")
					alias = &aliasValue
				}

				// create the collected selection from the information we have
				selection := &CollectedSelection{
					FieldName:     fieldName,
					FieldType:     fieldType,
					TypeModifiers: typeModifiers,
					Alias:         alias,
					Kind:          kind,
				}

				if fragmentRef != "" {
					selection.FragmentRef = &fragmentRef
				}

				if listName != "" {
					selection.List = &CollectedList{
						Name:       listName,
						Type:       listType,
						Connection: listConnection,
						PageSize:   int(listPageSize),
						Mode:       listMode,
						Embedded:   listEmbedded,
						TargetType: listTargetType,
					}
					if !statements.Search.IsNull("list_paginated") {
						selection.List.Paginated = true
						selection.List.SupportsBackward = statements.Search.GetBool(
							"list_supports_backward",
						)
						selection.List.SupportsForward = statements.Search.GetBool(
							"list_supports_forward",
						)
					}
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
							ID:            documentID,
							Name:          documentName,
							Kind:          statements.Search.GetText("document_kind"),
							TypeCondition: statements.Search.GetText("type_condition"),
							Hash:          statements.Search.GetText("hash"),
						}
						documents[documentName] = doc
					}

					// add the selection to the doc
					doc.Selections = append(doc.Selections, selection)

				} else {
					// if we have a parent then we need to save it in the parent's children
					parentID := statements.Search.GetInt64("parent_id")
					parent, ok := selections[parentID]
					if ok {
						parent.Children = append(parent.Children, selection)
					} else {
						if _, ok := missingParents[parentID]; !ok {
							missingParents[parentID] = []*CollectedSelection{}
						}

						missingParents[parentID] = append(missingParents[parentID], selection)
					}
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
						errs.Append(plugins.WrapError(err))
						return
					}

					// hold onto the valueID. we'll fill in the value later
					for _, arg := range args {
						if arg.ValueID != nil {
							argumentValues[*arg.ValueID] = nil
							argumentsWithValues = append(argumentsWithValues, arg)
						}
					}

					if sortKeys {
						sort.Slice(args, func(i, j int) bool {
							return args[i].Name < args[j].Name
						})
					}

					selection.Arguments = args
				}

				// directives get treated the same as arguments
				if !statements.Search.IsNull("directives") {
					directives := statements.Search.GetText("directives")

					dirs := []*CollectedDirective{}
					if err := json.Unmarshal([]byte(directives), &dirs); err != nil {
						errs.Append(plugins.WrapError(err))
						return
					}

					// hold onto the valueID. we'll fill in the value later
					for _, dir := range dirs {
						for _, arg := range dir.Arguments {
							if arg.ValueID != nil {
								argumentValues[*arg.ValueID] = nil
								argumentsWithValues = append(argumentsWithValues, arg)
							}
						}
					}

					selection.Directives = dirs
				}
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}

			// patch any missing parents
			for parentID, parentSelections := range missingParents {
				parent, ok := selections[parentID]
				if !ok {
					errs.Append(plugins.Errorf("Missing parent selection"))
				}
				for _, selection := range parentSelections {
					parent.Children = append(parent.Children, selection)
				}
			}

			if errs.Len() > 0 {
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
						errs.Append(plugins.WrapError(err))
						return
					}

					// hold onto the valueID. we'll fill in the value later
					for _, dir := range dirs {
						for _, arg := range dir.Arguments {
							if arg.ValueID != nil {
								argumentValues[*arg.ValueID] = nil
								argumentsWithValues = append(argumentsWithValues, arg)
							}
						}
					}

					variable.Directives = dirs
				}

				// save the variable in the document's list of variables
				doc, ok := documents[documentName]
				if !ok {
					errs.Append(
						plugins.WrapError(
							fmt.Errorf("document %v not found for variable %v", documentName, name),
						),
					)
					return
				}
				doc.Variables = append(doc.Variables, variable)
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
			if errs.Len() > 0 {
				return
			}

			// now we have to add document-level directives
			err = db.StepStatement(ctx, statements.DocumentDirectives, func() {
				directiveName := statements.DocumentDirectives.GetText("directive")
				documentName := statements.DocumentDirectives.GetText("document_name")
				internal := statements.DocumentDirectives.GetInt64("internal")

				// create the collected directive
				directive := &CollectedDirective{
					Name:      directiveName,
					Arguments: []*CollectedArgument{},
					Internal:  int(internal),
				}

				// if there are arguments then we need to add them
				if !statements.DocumentDirectives.IsNull("directive_arguments") {
					arguments := statements.DocumentDirectives.GetText("directive_arguments")
					// unmarshal the string into the directive struct
					if err := json.Unmarshal([]byte(arguments), &directive.Arguments); err != nil {
						errs.Append(plugins.WrapError(err))
						return
					}
				}

				// register any arguments that have values
				for _, arg := range directive.Arguments {
					if arg.ValueID != nil {
						argumentValues[*arg.ValueID] = nil
						argumentsWithValues = append(argumentsWithValues, arg)
					}
				}

				// add the directive to the document
				doc, ok := documents[documentName]
				if !ok {
					errs.Append(
						plugins.WrapError(
							fmt.Errorf(
								"document %v not found for directive %v",
								documentName,
								directiveName,
							),
						),
					)
					return
				}
				doc.Directives = append(doc.Directives, directive)
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
			if errs.Len() > 0 {
				return
			}

			// if we've gotten this far then we have recreated the full selection apart from
			// the nested argument structure
			valueIDs := []int64{}
			for id := range argumentValues {
				valueIDs = append(valueIDs, id)
			}
			// recreating the nested structure means we need a mapping of id to values
			values := map[int64]*CollectedArgumentValue{}
			argumentValueSearch, err := prepareArgumentValuesSearch(conn, valueIDs)
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
			defer argumentValueSearch.Finalize()

			err = db.StepStatement(ctx, argumentValueSearch, func() {
				// build up the argument value for the match
				value := &CollectedArgumentValue{
					Kind: argumentValueSearch.GetText("kind"),
					Raw:  argumentValueSearch.GetText("raw"),
				}

				// save the value in the map
				valueID := argumentValueSearch.GetInt64("id")
				values[valueID] = value

				// there is no parent so this ID must correspond to one of the values used in a document
				if argumentValueSearch.IsNull("parent") {
					_, ok := argumentValues[valueID]
					if !ok {
						errs.Append(
							plugins.WrapError(fmt.Errorf(
								"argument value %v not found in document %s",
								valueID,
								argumentValueSearch.GetText("document_name"),
							)),
						)
						return
					}

					argumentValues[valueID] = value
				} else {
					// if there is a parent, then we need to assign it with the field name
					parentID := argumentValueSearch.GetInt64("parent")
					parent, ok := values[parentID]
					if !ok {
						errs.Append(
							plugins.WrapError(
								fmt.Errorf("parent argument value %v not found for argument value %v",
									parentID,
									argumentValueSearch.GetInt64("id"),
								)),
						)
						return
					}
					parent.Children = append(parent.Children, &CollectedArgumentValueChildren{
						Name:  argumentValueSearch.GetText("name"),
						Value: value,
					})
				}
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
			if errs.Len() > 0 {
				return
			}

			// we now have collected values we can replace in our documents
			for _, arg := range argumentsWithValues {
				if arg.ValueID != nil {
					if value, ok := argumentValues[*arg.ValueID]; ok {
						arg.Value = value
					} else {
						errs.Append(
							plugins.WrapError(
								fmt.Errorf(
									"argument value %v not found for directive argument %v",
									*arg.ValueID,
									arg.Name,
								)),
						)
						return
					}
				}
			}
			for _, arg := range documentArgumentsWithValues {
				if arg.DefaultValueID != nil {
					if value, ok := argumentValues[*arg.DefaultValueID]; ok {
						arg.DefaultValue = value
					} else {
						errs.Append(
							plugins.WrapError(fmt.Errorf(
								"default value %v not found for document argument %v",
								*arg.DefaultValueID,
								arg.Name,
							)),
						)
						return
					}
				}
			}

			// build up the list of documents we collected
			docs := []*CollectedDocument{}
			for _, doc := range documents {
				docs = append(docs, doc)
			}

			// now we need to look up the type mappings for any types included in the documents we processed
			possibleTypes := map[string][]string{}
			err = db.StepStatement(ctx, statements.PossibleTypes, func() {
				typeName := statements.PossibleTypes.GetText("type")
				memberType := statements.PossibleTypes.GetText("member")

				if _, ok := possibleTypes[typeName]; !ok {
					possibleTypes[typeName] = []string{}
				}

				possibleTypes[typeName] = append(possibleTypes[typeName], memberType)
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}

			// up next, lets look up the input types
			inputTypes := map[string]map[string]string{}
			enumValues := map[string][]string{}
			err = db.StepStatement(ctx, statements.InputTypes, func() {
				typeName := statements.InputTypes.GetText("parent_type")
				fieldType := statements.InputTypes.GetText("field_type")
				fieldName := statements.InputTypes.GetText("field_name")
				kind := statements.InputTypes.GetText("kind")

				// depending on the kind we have to treat the result different
				switch kind {
				case "input":
					// the row could designate an input field

					// if this is the first time we've seen this type we need to initialize the map
					if _, ok := inputTypes[typeName]; !ok {
						inputTypes[typeName] = map[string]string{}
					}

					// add the field to the map
					inputTypes[typeName][fieldName] = fieldType

				case "enum":
					// the row could also mean an enum value
					enumValues[typeName] = append(enumValues[typeName], fieldName)
				}
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
			}

			// send the result over the channel
			resultCh <- collectResult{
				Documents:     docs,
				PossibleTypes: possibleTypes,
				InputTypes:    inputTypes,
				EnumValues:    enumValues,
			}
		}(batch)
	}
}

type CollectStatements struct {
	Search             *sqlite.Stmt
	DocumentVariables  *sqlite.Stmt
	DocumentDirectives *sqlite.Stmt
	PossibleTypes      *sqlite.Stmt
	InputTypes         *sqlite.Stmt
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
          selection_refs."document" IN %s AND selection_directive_arguments.document in %s
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
              'arguments', json(IFNULL(da.directive_arguments, '[]')),
              'internal', directives.internal
            )
          ) AS directives
        FROM selection_directives sd
          LEFT JOIN directive_args da ON da.directive_id = sd.id
          JOIN selection_refs ON selection_refs.child_id = sd.selection_id
          LEFT JOIN directives on sd.directive = directives.name
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
               AND selection_refs.document = selection_arguments.document
        WHERE
          selection_refs."document" IN %s
        GROUP BY selection_arguments.selection_id
      ),
      selection_tree AS (
        -- Base case: root selections (those with a selection_ref that has no parent)
        SELECT 
          selections.id,
          selections.field_name,
          selections.fragment_ref,
          type_fields.type_modifiers,
          selections.alias,
          selections.kind,
          d.id AS document_id,
          d.name AS document_name,
          d.kind AS document_kind,
          COALESCE(d.type_condition, types."name") AS type_condition,
          NULL AS parent_id,
          a.arguments,
          dct.directives,
          type_fields.type,
          d.id as document_id,
          d.hash,
          discovered_lists.name as list_name,
          discovered_lists.node_type as list_type,
          discovered_lists.connection as list_connection,
          discovered_lists.paginate as list_paginated,
          discovered_lists.supports_forward as list_supports_forward,
          discovered_lists.supports_backward as list_supports_backward,
          discovered_lists.page_size as list_page_size,
          discovered_lists.embedded as list_embedded,
          discovered_lists.mode as list_mode,
          discovered_lists.target_type as list_target_type
        FROM selections
          JOIN selection_refs 
            ON selection_refs.child_id = selections.id 
           AND selection_refs.parent_id IS NULL
           AND selection_refs.document IN %s

          LEFT JOIN documents d ON d.id = selection_refs.document
          LEFT JOIN directives_agg dct ON dct.selection_id = selections.id
          LEFT JOIN arguments_agg a ON a.selection_id = selections.id
          LEFT JOIN type_fields on selections.type = type_fields.id
          LEFT JOIN types on d.kind = types.operation
          LEFT JOIN discovered_lists on discovered_lists.list_field = selections.id
      
        UNION ALL
      
        -- Recursive case: child selections
        SELECT 
          selections.id,
          selections.field_name,
          selections.fragment_ref,
          type_fields.type_modifiers,
          selections.alias,
          selections.kind,
          st.document_id AS document_id,
          st.document_name AS document_name,
          st.kind AS document_kind,
          st.type_condition AS type_condition,
          st.id AS parent_id,
          a.arguments,
          dct.directives,
          type_fields.type,
          st.document_id AS document_id,
          st.hash,
          discovered_lists.name as list_name,
          discovered_lists.node_type as list_type,
          discovered_lists.connection as list_connection,
          discovered_lists.paginate as list_paginated,
          discovered_lists.supports_forward as list_supports_forward,
          discovered_lists.supports_backward as list_supports_backward,
          discovered_lists.page_size as list_page_size,
          discovered_lists.embedded as list_embedded,
          discovered_lists.mode as list_mode,
          discovered_lists.target_type as list_target_type
        FROM selection_refs 
          JOIN selection_tree st ON selection_refs.parent_id = st.id
          JOIN selections on selection_refs.child_id = selections.id

          LEFT JOIN type_fields on selections.type = type_fields.id
          LEFT JOIN directives_agg dct ON dct.selection_id = selections.id
          LEFT JOIN arguments_agg a ON a.selection_id = selections.id
          LEFT JOIN discovered_lists on discovered_lists.list_field = selections.id
        WHERE selection_refs.document = st.document_id
      )
    SELECT 
      id,
      document_name, 
      document_id, 
      kind, 
      field_name, 
      fragment_ref,
      type_modifiers, 
      alias, 
      arguments, 
      directives, 
      parent_id, 
      document_kind, 
      type_condition, 
      type,
      list_name,
      list_type,
      list_connection,
      list_paginated,
      list_supports_forward,
      list_supports_backward,
      list_page_size,
      list_embedded,
      list_mode,
      list_target_type
    FROM selection_tree
    ORDER BY parent_id ASC
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
            'arguments', json(IFNULL(directive_args.arguments, '[]')),
            'internal', directives.internal 
          )
        ) AS directives
      FROM document_variable_directives
        LEFT JOIN directive_args ON directive_args.variable_id = document_variable_directives.id
        JOIN document_variables ON document_variable_directives.parent = document_variables.id
        LEFT JOIN directives on document_variable_directives.directive = directives.name
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

	// we also need a query that looks up document-level directives
	documentDirectives, err := conn.Prepare(fmt.Sprintf(`
    WITH 
      doc_dir_args AS (
        SELECT
          document_directive_arguments.parent AS directive_id,
          json_group_array(
             json_object(
               'name', document_directive_arguments.name,
               'value', document_directive_arguments.value
             )
          ) AS directive_arguments
        FROM document_directive_arguments
        GROUP BY document_directive_arguments.parent
      )
    SELECT 
      dd.id,
      dd.directive,
      dd.row,
      dd.column,
      d.name AS document_name,
      IFNULL(dda.directive_arguments, '[]') AS directive_arguments,
      directives.internal
    FROM document_directives dd
      JOIN documents d ON dd.document = d.id
      LEFT JOIN doc_dir_args dda ON dda.directive_id = dd.id
      LEFT JOIN directives ON dd.directive = directives.name
    WHERE d.id in %s
  `, whereIn))
	if err != nil {
		return nil, err
	}

	// we need a query that looks up every abstract type that's used in
	// the set of documents
	possibleTypes, err := conn.Prepare(fmt.Sprintf(`
    SELECT DISTINCT possible_types."type", possible_types."member"
    FROM possible_types 
      LEFT JOIN type_fields ON possible_types."type" = type_fields."type"
      JOIN selections ON selections.type = type_fields.id 
        OR (selections.kind = 'inline_fragment' 
            AND (
              selections.field_name = possible_types."member" 
              OR selections.field_name = possible_types."type"
            )
        )
      JOIN selection_refs ON selection_refs.child_id = selections.id
    WHERE selection_refs.document IN %s
  `, whereIn))
	if err != nil {
		return nil, err
	}

	// a query to look up the type fields and enum values for every input used in the
	// documents we're interested in
	inputTypes, err := conn.Prepare(fmt.Sprintf(`
      WITH RECURSIVE
        -- define our columns (including a “visited” string to track cycles)
        argumentTypes(
          parent_type,
          field_name,
          field_type,
          type_modifiers,
          kind,
          visited_types
        ) AS (

          -- ─── base case 1: input‐object fields of the starting expected types ───
          SELECT
            tf.parent,                   -- parent_type
            tf.name,                     -- field_name
            tf.type,                     -- field_type
            tf.type_modifiers,           -- type_modifiers
            'input'     AS kind,         
            '|' || tf.parent || '|'      AS visited_types
          FROM argument_values av
          JOIN type_fields tf
            ON av.expected_type = tf.parent
          WHERE av."document" in %s

          UNION ALL

          -- ─── base case 2: enum values for those same starting types ───
          SELECT
            ev.parent,                   -- parent_type
            ev.value    AS field_name,   -- field_name (enum value)
            NULL        AS field_type,   -- enums don’t have nested fields
            NULL        AS type_modifiers,
            'enum'      AS kind,
            '|' || ev.parent || '|'      AS visited_types
          FROM argument_values av
          JOIN enum_values ev
            ON av.expected_type = ev.parent
          WHERE av."document" in %s

          UNION ALL

          -- ─── recursive step: for each discovered input‐object type, pull its fields ───
          SELECT
            tf.parent,
            tf.name, 
            tf.type, 
            tf.type_modifiers,
            'input'     AS kind,
            at.visited_types
              || tf.parent || '|'     
          FROM argumentTypes AS at
          JOIN type_fields tf
            ON tf.parent = at.field_type
          -- only recurse into types we haven’t seen yet
          WHERE instr(
            at.visited_types,
            '|' || tf.parent || '|'
          ) = 0
        )

      SELECT DISTINCT
        parent_type,
        field_name,
        field_type,
        type_modifiers,
        kind
      FROM argumentTypes
  `, whereIn, whereIn))
	if err != nil {
		return nil, err
	}

	// bind each document ID to the variables that were prepared
	for _, stmt := range []*sqlite.Stmt{search, documentVariables, documentDirectives, possibleTypes, inputTypes} {
		for i, id := range docIDs {
			stmt.SetInt64(fmt.Sprintf("$document_%v", i), id)
		}
	}

	return &CollectStatements{
		Search:             search,
		DocumentVariables:  documentVariables,
		DocumentDirectives: documentDirectives,
		PossibleTypes:      possibleTypes,
		InputTypes:         inputTypes,
	}, nil
}

func (s *CollectStatements) Finalize() {
	s.Search.Finalize()
	s.DocumentVariables.Finalize()
	s.DocumentDirectives.Finalize()
	s.PossibleTypes.Finalize()
	s.InputTypes.Finalize()
}

func prepareArgumentValuesSearch(conn *sqlite.Conn, valueIDs []int64) (*sqlite.Stmt, error) {
	placeholders := make([]string, len(valueIDs))
	for i := range valueIDs {
		placeholders[i] = fmt.Sprintf("$value_%v", i)
	}

	// join the placeholders with commas and enclose in parentheses.
	whereIn := "(" + strings.Join(placeholders, ", ") + ")"

	stmt, err := conn.Prepare(fmt.Sprintf(`
      WITH RECURSIVE all_values AS (
          -- Base case: Select the root argument values and their children
          SELECT
              argument_value_children.name,
              av.id,
              av.kind,
              av.raw,
              av.row,
              av.column,
              av.expected_type,
              av.expected_type_modifiers,
              av.document,
              documents.name AS document_name,
              argument_value_children.parent,
              av.id AS root_id  -- Track the root of the nested structure
          FROM argument_values av
          LEFT JOIN argument_value_children ON argument_value_children."value" = av.id
          JOIN documents ON av.document = documents.id

          UNION

          SELECT
              argument_value_children.name,
              av.id,
              av.kind,
              av.raw,
              av.row,
              av.column,
              av.expected_type,
              av.expected_type_modifiers,
              av.document,
              documents.name AS document_name,
              argument_value_children.parent,
              all_values.root_id  -- Carry over the root_id from the base case
          FROM argument_value_children
          JOIN all_values ON all_values.id = argument_value_children.parent  -- Join the recursive table to itself
          LEFT JOIN argument_value_children AS children ON children."value" = argument_value_children.id
          JOIN argument_values av ON argument_value_children."value" = av.id
          JOIN documents ON av.document = documents.id
      )
      SELECT * 
      FROM all_values 
      WHERE all_values.root_id IN %s  
      ORDER BY all_values.id
    `, whereIn))
	if err != nil {
		return nil, err
	}

	for i, id := range valueIDs {
		stmt.SetInt64(fmt.Sprintf("$value_%v", i), id)
	}

	// we're done
	return stmt, nil
}

type CollectedDocument struct {
	ID                  int64
	Name                string
	Kind                string // "query", "mutation", "subscription", or "fragment"
	TypeCondition       string
	Hash                string
	Variables           []*CollectedOperationVariable
	Selections          []*CollectedSelection
	Directives          []*CollectedDirective
	ReferencedFragments []string
	UnusedVariables     []string
}

type CollectedSelection struct {
	FieldName     string
	Alias         *string
	FieldType     string
	FragmentRef   *string
	TypeModifiers *string
	Kind          string
	Visible       bool
	List          *CollectedList
	Arguments     []*CollectedArgument
	Directives    []*CollectedDirective
	Children      []*CollectedSelection
}

type CollectedList struct {
	Name             string
	Type             string
	Connection       bool
	Paginated        bool
	SupportsForward  bool
	SupportsBackward bool
	PageSize         int
	Mode             string
	TargetType       string
	Embedded         bool
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
	Name       string `json:"name"`
	ValueID    *int64 `json:"value"`
	Value      *CollectedArgumentValue
	Directives []*CollectedDirective
}

type CollectedDirective struct {
	Internal  int                  `json:"internal"`
	Name      string               `json:"name"`
	Arguments []*CollectedArgument `json:"arguments"`
}

// func (c *CollectedDirective) Diff(target *CollectedDirective) bool {
//
// }

type CollectedArgumentValue struct {
	Kind     string
	Raw      string
	Children []*CollectedArgumentValueChildren
}

type CollectedArgumentValueChildren struct {
	Name  string
	Value *CollectedArgumentValue
}

type CollectedDocuments struct {
	TaskDocuments []string
	Selections    map[string]*CollectedDocument
	// PossibleTypes maps abtract types to concrete types that implement them
	PossibleTypes map[string]map[string]bool
	// Implementations maps concrete types to the abstract types it implements (its the inverse of PossibleTypes)
	Implementations map[string]map[string]bool
	// InputTypes holds a description of every field of every type used as an input
	// for every collected doc
	InputTypes map[string]map[string]string

	// EnumValues holds a list of enum values for every enum type used as an input
	EnumValues map[string][]string
}

type collectResult struct {
	Documents     []*CollectedDocument
	PossibleTypes map[string][]string
	InputTypes    map[string]map[string]string
	EnumValues    map[string][]string
}

// Clone creates a full, independent copy of a CollectedSelection tree,
// including all fields: Alias, FragmentRef, TypeModifiers, List, Arguments,
// Directives, and Children.
func (s *CollectedSelection) Clone(includeChildren bool) *CollectedSelection {
	clone := &CollectedSelection{
		FieldName:     s.FieldName,
		Alias:         nil,
		FieldType:     s.FieldType,
		FragmentRef:   nil,
		TypeModifiers: nil,
		Kind:          s.Kind,
		Visible:       s.Visible,
		List:          nil,
		Arguments:     nil,
		Directives:    nil,
		Children:      nil,
	}

	// clone pointer fields
	if s.Alias != nil {
		alias := *s.Alias
		clone.Alias = &alias
	}
	if s.FragmentRef != nil {
		frag := *s.FragmentRef
		clone.FragmentRef = &frag
	}
	if s.TypeModifiers != nil {
		mods := *s.TypeModifiers
		clone.TypeModifiers = &mods
	}

	// clone List (shallow or deep if supported)
	if s.List != nil {
		clone.List = s.List
	}

	// clone Arguments
	if len(s.Arguments) > 0 {
		clone.Arguments = make([]*CollectedArgument, len(s.Arguments))
		for i, arg := range s.Arguments {
			if arg != nil {
				argClone := *arg
				clone.Arguments[i] = &argClone
			}
		}
	}

	// clone Directives
	if len(s.Directives) > 0 {
		clone.Directives = make([]*CollectedDirective, len(s.Directives))
		for i, dir := range s.Directives {
			if dir != nil {
				dClone := *dir
				clone.Directives[i] = &dClone
			}
		}
	}

	// clone Children (handle cycles)
	if len(s.Children) > 0 && includeChildren {
		clone.Children = make([]*CollectedSelection, 0, len(s.Children))
		for _, child := range s.Children {
			if child != nil {
				clone.Children = append(clone.Children, child.Clone(includeChildren))
			}
		}
	}

	return clone
}
