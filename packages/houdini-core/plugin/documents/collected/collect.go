package collected

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

// directivesEqual compares two directives for equality based on name, internal flag, and arguments
func directivesEqual(a, b *Directive) bool {
	if a.Name != b.Name || a.Internal != b.Internal {
		return false
	}

	if len(a.Arguments) != len(b.Arguments) {
		return false
	}

	// Compare arguments by ValueID if available, otherwise by name
	for i, argA := range a.Arguments {
		argB := b.Arguments[i]
		if argA.Name != argB.Name {
			return false
		}

		// Compare ValueIDs if both are present
		if argA.ValueID != nil && argB.ValueID != nil {
			if *argA.ValueID != *argB.ValueID {
				return false
			}
		} else if argA.ValueID != argB.ValueID {
			// One is nil, the other is not
			return false
		}
	}

	return true
}

// CollectDocuments takes a document ID and grabs its full selection set along with the selection sets of
// all referenced fragments
func CollectDocuments(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	conn *sqlite.Conn,
	sortKeys bool,
) (*Documents, error) {
	result := &Documents{
		Selections:      map[string]*Document{},
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
					 documents.internal,
					 documents.visible,
           true  AS current
    FROM documents
    JOIN raw_documents
      ON documents.raw_document = raw_documents.id
    WHERE (raw_documents.current_task = $task_id OR $task_id IS NULL)

    UNION ALL

    SELECT DISTINCT documents.id,
           documents.name,
           false AS current,
					 documents.internal,
					 documents.visible
    FROM documents AS current_task_docs
      JOIN raw_documents AS current_task_raw
        ON current_task_docs.raw_document = current_task_raw.id
      JOIN selection_refs
        ON selection_refs.document = current_task_docs.id
      JOIN selections
        ON selection_refs.child_id = selections.id
        AND selections.kind = 'fragment'
      JOIN documents
        ON selections.field_name = documents.name
      JOIN raw_documents AS doc_raw
        ON documents.raw_document = doc_raw.id
    WHERE (current_task_raw.current_task = $task_id OR $task_id IS NULL)
      AND NOT (doc_raw.current_task = $task_id OR $task_id IS NULL)
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
	// but if that's above 500, then we should cap it at 500
	batchSize := max(1, min(500, len(docIDs)/runtime.NumCPU()+1))
	// round up to the nearest power of two so every batch produces the same SQL string, letting
	// SQLite reuse the compiled plan across batches (different placeholder counts = different SQL = cache miss)
	paddedBatchSize := nextPowerOfTwo(batchSize)

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
		go collectDoc(ctx, db, &wg, batchCh, resultCh, errList, sortKeys, paddedBatchSize)
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
	paddedBatchSize int,
) {
	defer wg.Done()

	// hold onto a connection for the collection process
	conn, err := db.Take(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer db.Put(conn)

	// Prepare statements once per worker with a fixed placeholder count. Every batch produces the
	// same SQL string so SQLite reuses the compiled plan. StepStatement calls ClearBindings after
	// each run, so unused slots stay NULL (which never matches real document IDs in an IN clause).
	statements, err := prepareCollectStatements(conn, paddedBatchSize)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer statements.Finalize()

	for batch := range docIDs {
		// wrap each processing in a function so we have a defer context to avoid deadlocking the connection
		func(ids []int64) {
			// bind this batch's IDs; unused placeholder slots remain NULL from the previous ClearBindings
			for _, stmt := range []*sqlite.Stmt{
				statements.Search,
				statements.DocumentVariables,
				statements.DocumentDirectives,
				statements.PossibleTypes,
				statements.InputTypes,
			} {
				for i, id := range ids {
					stmt.SetInt64(fmt.Sprintf("$document_%v", i), id)
				}
			}

			// first we need to recreate the selection set for every document that we were given in the batch

			// build up a mapping of document name to the collected version
			documents := map[string]*Document{}
			// and in order to build up the correct tree structure we need a mapping of selection ID
			// to the actual selection (selections can be shared across multiple documents)
			selections := map[int64]*Selection{}

			// as a follow up, we need to recreate the arguments and directives that were assigned to the selection
			argumentValues := map[int64]*ArgumentValue{}
			argumentsWithValues := []*Argument{}
			documentArgumentsWithValues := []*OperationVariable{}

			// the insert order doesn't necessarily match the toposort order for fields when we've inserted fields
			// after the original loading so we need to hold onto a list of selections that need to be patched
			missingParents := map[int64][]*Selection{}

			// track parent references for building paths on-demand
			parentRefs := map[int64]int64{} // maps child selection ID to parent selection ID

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
				fragmentArgs := statements.Search.GetText("fragment_args")
				// Get discovered_lists values
				listName := statements.Search.GetText("list_name")
				listType := statements.Search.GetText("list_type")
				listConnection := statements.Search.GetBool("list_connection")
				listPaginatedText := statements.Search.GetText("list_paginated")
				// paginate field is TEXT containing direction strings like "forward", "backward" for @paginate queries
				// For @list queries, this field is empty/null, so they are not paginated
				// Only @paginate queries get the paginate field set by the UPDATE statement in validatePaginateArgs
				listPaginated := listPaginatedText != ""
				listPageSize := statements.Search.GetInt64("list_page_size")
				listTargetType := statements.Search.GetText("list_target_type")
				listEmbedded := statements.Search.GetBool("list_embedded")
				listMode := statements.Search.GetText("list_mode")
				listCursorType := statements.Search.GetText("list_cursor_type")
				listSupportsForward := statements.Search.GetBool("list_supports_forward")
				listSupportsBackward := statements.Search.GetBool("list_supports_backward")
				componentFieldType := statements.Search.GetText("component_field_type")
				componentFieldField := statements.Search.GetText("component_field_field")
				componentFieldFragment := statements.Search.GetText("component_field_fragment")
				componentFieldProp := statements.Search.GetText("component_field_prop")
				internal := statements.Search.GetBool("internal")

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

				var description *string
				if !statements.Search.IsNull("description") {
					descValue := statements.Search.GetText("description")
					description = &descValue
				}

				// check if this selection already exists (shared across documents)
				selection, exists := selections[selectionID]
				if !exists {
					// create the collected selection from the information we have
					selection = &Selection{
						FieldName:     fieldName,
						FieldType:     fieldType,
						TypeModifiers: typeModifiers,
						Alias:         alias,
						Kind:          kind,
						Description:   description,
						Internal:      internal,
						Visible:       !internal, // Internal fields are not visible by default
					}

					// Load directives for the new selection
					if !statements.Search.IsNull("directives") {
						directives := statements.Search.GetText("directives")

						dirs := []*Directive{}
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
				} else {
					// Selection already exists, merge any additional directives
					if !statements.Search.IsNull("directives") {
						directives := statements.Search.GetText("directives")

						dirs := []*Directive{}
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

						// Merge directives, avoiding duplicates
						if len(dirs) > 0 {
							for _, newDir := range dirs {
								isDuplicate := false
								for _, existingDir := range selection.Directives {
									if directivesEqual(existingDir, newDir) {
										isDuplicate = true
										break
									}
								}
								if !isDuplicate {
									selection.Directives = append(selection.Directives, newDir)
								}
							}
						}
					}
				}

				if !exists {
					if fragmentRef != "" {
						selection.FragmentRef = &fragmentRef

						if fragmentArgs != "" {
							usedVariables := []string{}
							err = json.Unmarshal([]byte(fragmentArgs), &usedVariables)
							if err != nil {
								errs.Append(plugins.WrapError(err))
								return
							}
							selection.FragmentArgs = usedVariables
						}
					}

					// add the component field spec if we detected a match
					if componentFieldField != "" {
						selection.ComponentField = &ComponentFieldSpec{
							Type:     componentFieldType,
							Field:    componentFieldField,
							Fragment: componentFieldFragment,
							Prop:     componentFieldProp,
						}
					}

					if listType != "" {
						selection.List = &List{
							Name:             listName,
							Type:             listType,
							Connection:       listConnection,
							Paginated:        listPaginated, // true if this field has @paginate directive
							SupportsForward:  listSupportsForward,
							SupportsBackward: listSupportsBackward,
							PageSize:         int(listPageSize),
							Mode:             listMode,
							Embedded:         listEmbedded,
							TargetType:       listTargetType,
							CursorType:       listCursorType,
						}

						// if this is a paginated field, set document-level refetch
						if listPaginated { // indicates this field has @paginate directive
							// TODO: path building will be handled in artifact generation
							currentPath := []string{}

							// determine pagination method
							method := "offset"
							if listConnection {
								method = "cursor"
							}

							// determine direction
							direction := "forward"
							if listSupportsForward && listSupportsBackward {
								direction = "both"
							} else if listSupportsBackward {
								direction = "backward"
							}

							// find the document this selection belongs to
							doc := documents[documentName]
							if doc != nil && doc.Refetch == nil {
								doc.Refetch = &DocumentRefetch{
									Path:       currentPath,
									Method:     method,
									PageSize:   int(listPageSize),
									Mode:       listMode,
									TargetType: listTargetType,
									Embedded:   listEmbedded,
									Paginated:  true,
									Direction:  direction,
								}
							}
						}
					}

					// save the ID in the selection map
					selections[selectionID] = selection
				} else {
					// if this selection already exists, we need to merge the internal/visible flags
					// If the existing selection is internal but this reference is not internal,
					// then this field was explicitly requested by the user and should be visible
					if selection.Internal && !internal {
						selection.Internal = false
						selection.Visible = true
					}
					// If this reference is internal but the existing selection is not,
					// keep the existing non-internal status (user-requested takes precedence)

				}

				// if there is no parent then we have a root selection
				if statements.Search.IsNull("parent_id") {
					// the selection is a root selection

					// this could be the first time we see the document
					doc, ok := documents[documentName]
					if !ok {
						doc = &Document{
							ID:            documentID,
							Name:          documentName,
							Kind:          statements.Search.GetText("document_kind"),
							TypeCondition: statements.Search.GetText("type_condition"),
							Hash:          statements.Search.GetText("hash"),
							Internal:      statements.Search.GetBool("document_internal"),
							Visible:       statements.Search.GetBool("document_visible"),
						}
						documents[documentName] = doc
					}

					// check if this selection is already in the document's root selections to avoid duplicates
					selectionExists := false
					var existingSelection *Selection
					for _, existing := range doc.Selections {
						if existing == selection {
							selectionExists = true
							existingSelection = existing
							break
						}
						// Also check for field-level duplicates (same field name and alias)
						if existing.Kind == "field" && selection.Kind == "field" &&
							existing.FieldName == selection.FieldName &&
							((existing.Alias == nil && selection.Alias == nil) ||
								(existing.Alias != nil && selection.Alias != nil && *existing.Alias == *selection.Alias)) {
							selectionExists = true
							existingSelection = existing
							// Merge directives from the duplicate into the existing selection
							if len(selection.Directives) > 0 {
								for _, newDir := range selection.Directives {
									isDuplicate := false
									for _, existingDir := range existing.Directives {
										if directivesEqual(existingDir, newDir) {
											isDuplicate = true
											break
										}
									}
									if !isDuplicate {
										existing.Directives = append(existing.Directives, newDir)
									}
								}
							}
							break
						}
					}
					if !selectionExists {
						// add the selection to the doc
						doc.Selections = append(doc.Selections, selection)
					} else if existingSelection != nil {
						// Redirect future references to the existing selection
						selections[selectionID] = existingSelection
					}

				} else {
					// if we have a parent then we need to save it in the parent's children
					parentID := statements.Search.GetInt64("parent_id")
					// track parent reference for path building
					parentRefs[selectionID] = parentID

					parent, ok := selections[parentID]
					if ok {
						// Ensure we're using the canonical parent selection
						// In case this parent has been redirected to another selection
						canonicalParent := parent
						for canonicalParent != selections[parentID] {
							canonicalParent = selections[parentID]
						}
						// check if this child is already in the canonical parent's children to avoid duplicates
						childExists := false
						var existingChild *Selection
						for _, existing := range canonicalParent.Children {
							if existing == selection {
								childExists = true
								existingChild = existing
								break
							}
							// Also check for field-level duplicates (same field name and alias)
							if existing.Kind == "field" && selection.Kind == "field" &&
								existing.FieldName == selection.FieldName &&
								((existing.Alias == nil && selection.Alias == nil) ||
									(existing.Alias != nil && selection.Alias != nil && *existing.Alias == *selection.Alias)) {
								childExists = true
								existingChild = existing
								// Merge directives from the duplicate into the existing child
								if len(selection.Directives) > 0 {
									for _, newDir := range selection.Directives {
										isDuplicate := false
										for _, existingDir := range existing.Directives {
											if directivesEqual(existingDir, newDir) {
												isDuplicate = true
												break
											}
										}
										if !isDuplicate {
											existing.Directives = append(existing.Directives, newDir)
										}
									}
								}
								break
							}
						}
						if !childExists {
							canonicalParent.Children = append(canonicalParent.Children, selection)
						} else if existingChild != nil {
							// When redirecting to an existing child, we need to ensure that
							// any future children of this selection are properly linked to the existing child
							// This is important for shared selections like pageInfo across multiple documents
							selections[selectionID] = existingChild

							// Also ensure that the existing child maintains all necessary properties
							// from the current selection (like visibility flags)
							if !selection.Internal && existingChild.Internal {
								existingChild.Internal = false
								existingChild.Visible = true
							}
						}
					} else {
						if _, ok := missingParents[parentID]; !ok {
							missingParents[parentID] = []*Selection{}
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

					args := []*Argument{}
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
					// check if this child is already in the parent's children to avoid duplicates
					childExists := false
					for _, existingChild := range parent.Children {
						if existingChild == selection {
							childExists = true
							break
						}
						// Also check for field-level duplicates (same field name and alias)
						if existingChild.Kind == "field" && selection.Kind == "field" &&
							existingChild.FieldName == selection.FieldName &&
							((existingChild.Alias == nil && selection.Alias == nil) ||
								(existingChild.Alias != nil && selection.Alias != nil && *existingChild.Alias == *selection.Alias)) {
							childExists = true
							// Merge directives from the duplicate into the existing child
							if len(selection.Directives) > 0 {
								for _, newDir := range selection.Directives {
									isDuplicate := false
									for _, existingDir := range existingChild.Directives {
										if directivesEqual(existingDir, newDir) {
											isDuplicate = true
											break
										}
									}
									if !isDuplicate {
										existingChild.Directives = append(existingChild.Directives, newDir)
									}
								}
							}
							break
						}
					}
					if !childExists {
						parent.Children = append(parent.Children, selection)
					}
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
				variable := &OperationVariable{
					Name:          name,
					Type:          variableType,
					TypeModifiers: modifiers,
					Directives:    []*Directive{},
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

					dirs := []*Directive{}
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
				directive := &Directive{
					Name:      directiveName,
					Arguments: []*Argument{},
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

			// Process argument values in batches to avoid large SQL queries
			err = processArgumentValuesInBatches(ctx, db, conn, valueIDs, argumentValues, errs)
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
			docs := []*Document{}
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

func prepareCollectStatements(conn *sqlite.Conn, count int) (*CollectStatements, error) {
	// Build a fixed-size placeholder list. count is always a power of two so all batches
	// for this worker share the same SQL string and SQLite reuses the compiled plan.
	placeholders := make([]string, count)
	for i := range count {
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
          selections.fragment_args,
          type_fields.type_modifiers,
          selections.alias,
          selections.kind,
          type_fields.description,
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
          discovered_lists.target_type as list_target_type,
          discovered_lists.cursor_type as list_cursor_type,

          selection_refs.internal,
					d.internal as document_internal
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
          selections.fragment_args,
          type_fields.type_modifiers,
          selections.alias,
          selections.kind,
          type_fields.description,
          st.document_id AS document_id,
          st.document_name AS document_name,
          st.kind AS document_kind,
          st.type_condition AS type_condition,
          st.id AS parent_id,
          a.arguments,
          dct.directives,
          type_fields.type,
          st.document_id AS document_id,
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
          discovered_lists.target_type as list_target_type,
          discovered_lists.cursor_type as list_cursor_type,

          selection_refs.internal,
					d.internal as document_internal
        FROM selection_refs
          JOIN selection_tree st ON selection_refs.parent_id = st.id
          JOIN selections on selection_refs.child_id = selections.id
          LEFT JOIN documents d ON d.id = st.document_id

          LEFT JOIN type_fields on selections.type = type_fields.id
          LEFT JOIN directives_agg dct ON dct.selection_id = selections.id
          LEFT JOIN arguments_agg a ON a.selection_id = selections.id
          LEFT JOIN discovered_lists on discovered_lists.list_field = selections.id
        WHERE selection_refs.document = st.document_id
      )
    SELECT
      selection_tree.id,
      document_name,
      document_id,
      kind,
      field_name,
      fragment_ref,
      type_modifiers,
      alias,
      description,
      arguments,
      directives,
      parent_id,
      document_kind,
      type_condition,
      selection_tree.type,
      hash,
      list_name,
      list_type,
      list_connection,
      list_paginated,
      list_supports_forward,
      list_supports_backward,
      list_page_size,
      list_embedded,
      list_mode,
      list_target_type,
      list_cursor_type,
      component_fields.type as component_field_type,
      component_fields.prop as component_field_prop,
      component_fields.field as component_field_field,
      component_fields.fragment as component_field_fragment,
      selection_tree.internal,
			document_internal,
			fragment_args
    FROM selection_tree
      LEFT JOIN component_fields ON selection_tree.kind = 'fragment' AND component_fields.fragment = selection_tree.field_name
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
	// the set of documents. Split into UNION branches (no OR in JOIN) so
	// SQLite can use indexes on each branch independently.
	possibleTypes, err := conn.Prepare(fmt.Sprintf(`
    -- Case 1: abstract type appears as the declared type of a field in the selection set
    SELECT DISTINCT pt."type", pt."member"
    FROM possible_types pt
      JOIN type_fields tf ON pt."type" = tf."type"
      JOIN selections s ON s.type = tf.id
      JOIN selection_refs sr ON sr.child_id = s.id
    WHERE sr.document IN %s

    UNION

    -- Case 2: inline fragment whose type condition matches a concrete member name
    SELECT DISTINCT pt."type", pt."member"
    FROM possible_types pt
      JOIN selections s ON s.kind = 'inline_fragment' AND s.field_name = pt."member"
      JOIN selection_refs sr ON sr.child_id = s.id
    WHERE sr.document IN %s

    UNION

    -- Case 3: inline fragment whose type condition matches the abstract type itself
    SELECT DISTINCT pt."type", pt."member"
    FROM possible_types pt
      JOIN selections s ON s.kind = 'inline_fragment' AND s.field_name = pt."type"
      JOIN selection_refs sr ON sr.child_id = s.id
    WHERE sr.document IN %s

    UNION

    -- Case 4: named fragment spread in the batch whose type condition is itself abstract
    -- (needed so merge.go can recognise the fragment's TypeCondition as abstract when
    -- it synthesises an inline fragment from the spread)
    SELECT DISTINCT pt."type", pt."member"
    FROM possible_types pt
      JOIN documents d ON d.type_condition = pt."type"
      JOIN selections s ON s.kind = 'fragment' AND s.field_name = d.name
      JOIN selection_refs sr ON sr.child_id = s.id
    WHERE sr.document IN %s

    UNION

    -- Case 5: named fragment spread in the batch whose type condition is a concrete member
    SELECT DISTINCT pt."type", pt."member"
    FROM possible_types pt
      JOIN documents d ON d.type_condition = pt."member"
      JOIN selections s ON s.kind = 'fragment' AND s.field_name = d.name
      JOIN selection_refs sr ON sr.child_id = s.id
    WHERE sr.document IN %s
  `, whereIn, whereIn, whereIn, whereIn, whereIn))
	if err != nil {
		return nil, err
	}

	// a query to look up the type fields and enum values for every input used in the
	// documents we're interested in
	inputTypes, err := conn.Prepare(fmt.Sprintf(`
      WITH RECURSIVE
        argumentTypes(
          parent_type,
          field_name,
          field_type,
          type_modifiers,
          kind
        ) AS (

          -- ─── base case 1: input‐object fields of the starting expected types ───
          SELECT
            tf.parent,
            tf.name,
            tf.type,
            tf.type_modifiers,
            'input' AS kind
          FROM argument_values av
          JOIN type_fields tf
            ON av.expected_type = tf.parent
          WHERE av."document" in %s

          UNION

          -- ─── base case 2: enum values for those same starting types ───
          SELECT
            ev.parent,
            ev.value    AS field_name,
            NULL        AS field_type,
            NULL        AS type_modifiers,
            'enum'      AS kind
          FROM argument_values av
          JOIN enum_values ev
            ON av.expected_type = ev.parent
          WHERE av."document" in %s

          UNION

          -- ─── base case 2b: enum values for types used as field types in selections ───
          SELECT
            ev.parent,
            ev.value    AS field_name,
            NULL        AS field_type,
            NULL        AS type_modifiers,
            'enum'      AS kind
          FROM selections s
          JOIN selection_refs sr ON sr.child_id = s.id
          JOIN type_fields tf ON s.type = tf.id
          JOIN enum_values ev ON tf.type = ev.parent
          WHERE sr.document in %s

          UNION

          -- ─── recursive step: pull fields of each newly discovered input type ───
          -- UNION (not UNION ALL) lets SQLite deduplicate rows, terminating the
          -- recursion naturally when no new (parent_type, field_name, ...) tuples
          -- are produced, even for schemas with cyclic or self-referencing types.
          SELECT
            tf.parent,
            tf.name,
            tf.type,
            tf.type_modifiers,
            'input' AS kind
          FROM argumentTypes AS at
          JOIN type_fields tf
            ON tf.parent = at.field_type
        )

      SELECT DISTINCT
        parent_type,
        field_name,
        field_type,
        type_modifiers,
        kind
      FROM argumentTypes
  `, whereIn, whereIn, whereIn))
	if err != nil {
		return nil, err
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

func nextPowerOfTwo(n int) int {
	if n <= 1 {
		return 1
	}
	p := 1
	for p < n {
		p <<= 1
	}
	return p
}

// processArgumentValuesInBatches processes argument values in fixed-size batches
// to avoid creating extremely large SQL queries with hundreds of placeholders
func processArgumentValuesInBatches[PluginConfig any](
	ctx context.Context,
	db plugins.DatabasePool[PluginConfig],
	conn *sqlite.Conn,
	valueIDs []int64,
	argumentValues map[int64]*ArgumentValue,
	errs *plugins.ErrorList,
) error {
	const batchSize = 1000

	if len(valueIDs) == 0 {
		return nil
	}

	// Global map to track all values across batches - this is crucial for parent-child relationships
	allValues := map[int64]*ArgumentValue{}

	// Track pending parent-child relationships that need to be resolved after all batches
	type pendingRelationship struct {
		childValue *ArgumentValue
		parentID   int64
		fieldName  string
	}
	pendingRelationships := []pendingRelationship{}

	// Process valueIDs in batches
	for i := 0; i < len(valueIDs); i += batchSize {
		end := min(i+batchSize, len(valueIDs))
		batch := valueIDs[i:end]

		stmt, err := prepareArgumentValuesSearch(conn, batch)
		if err != nil {
			return err
		}

		// Collect values from this batch
		err = db.StepStatement(ctx, stmt, func() {
			// build up the argument value for the match
			value := &ArgumentValue{
				Kind: stmt.GetText("kind"),
				Raw:  stmt.GetText("raw"),
			}

			// save the value in the global map
			valueID := stmt.GetInt64("id")
			allValues[valueID] = value

			// there is no parent so this ID must correspond to one of the values used in a document
			if stmt.IsNull("parent") {
				_, ok := argumentValues[valueID]
				if !ok {
					errs.Append(
						plugins.WrapError(fmt.Errorf(
							"argument value %v not found in document %s",
							valueID,
							stmt.GetText("document_name"),
						)),
					)
					return
				}

				argumentValues[valueID] = value
			} else {
				// Store parent-child relationship info for later processing
				// We can't process it immediately because the parent might be in a different batch
				parentID := stmt.GetInt64("parent")
				fieldName := stmt.GetText("name")

				// Try to find parent in current batch first
				if parent, ok := allValues[parentID]; ok {
					parent.Children = append(parent.Children, &ArgumentValueChildren{
						Name:  fieldName,
						Value: value,
					})
				} else {
					// Parent not found yet - store for later processing
					pendingRelationships = append(pendingRelationships, pendingRelationship{
						childValue: value,
						parentID:   parentID,
						fieldName:  fieldName,
					})
				}
			}
		})

		// Finalize the statement after processing this batch
		stmt.Finalize()

		if err != nil {
			return err
		}
		if errs.Len() > 0 {
			return nil // Return early if there are errors
		}
	}

	// Second pass: resolve any pending parent-child relationships
	for _, pending := range pendingRelationships {
		if parent, ok := allValues[pending.parentID]; ok {
			parent.Children = append(parent.Children, &ArgumentValueChildren{
				Name:  pending.fieldName,
				Value: pending.childValue,
			})
		} else {
			errs.Append(
				plugins.WrapError(
					fmt.Errorf("parent argument value %v not found for argument value",
						pending.parentID,
					)),
			)
		}
	}

	return nil
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
          -- Base case: seed argument values are always roots (parent=NULL).
          -- We do NOT follow upward parent links here because a seed may be a
          -- shared value (e.g. a Null literal) that is also a child in other
          -- documents' argument_value_children trees. Following those upward
          -- references would produce phantom pending relationships to parents
          -- that are unreachable in the current batch.
          SELECT
              NULL AS name,
              av.id,
              av.kind,
              av.raw,
              av.row,
              av.column,
              av.expected_type,
              av.expected_type_modifiers,
              av.document,
              documents.name AS document_name,
              NULL AS parent,
              av.id AS root_id
          FROM argument_values av
          JOIN documents ON av.document = documents.id
          WHERE av.id IN %s

          UNION

          -- Recursive case: descend into children of already-visited values.
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
              all_values.root_id
          FROM argument_value_children
          JOIN all_values ON all_values.id = argument_value_children.parent
          JOIN argument_values av ON argument_value_children."value" = av.id
          JOIN documents ON av.document = documents.id
      )
      SELECT *
      FROM all_values
      WHERE all_values.root_id IN %s
      ORDER BY all_values.id
    `, whereIn, whereIn))
	if err != nil {
		return nil, err
	}

	for i, id := range valueIDs {
		stmt.SetInt64(fmt.Sprintf("$value_%v", i), id)
	}

	// we're done
	return stmt, nil
}



type collectResult struct {
	Documents     []*Document
	PossibleTypes map[string][]string
	InputTypes    map[string]map[string]string
	EnumValues    map[string][]string
}
