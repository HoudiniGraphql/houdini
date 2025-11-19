package lists

import (
	"context"
	"encoding/json"
	"fmt"

	"zombiezen.com/go/sqlite"
	"zombiezen.com/go/sqlite/sqlitex"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/graphql"
)

type variableInfo struct {
	Variable string `json:"variable"`
	ID       int    `json:"id"`
}

type argumentInfo struct {
	Argument      string `json:"argument"`
	ID            int    `json:"id"`
	Value         int    `json:"value"`
	Kind          string `json:"kind"`
	Raw           string `json:"raw"`
	ExpectedType  string `json:"expected_type"`
	TypeModifiers string `json:"type_modifiers"`
}

type fieldArgumentSpec struct {
	Name string
	Kind string
}

type discoveredList struct {
	ID               int64
	RawDocument      int
	DocumentName     string
	DocumentType     string
	TypeCondition    string
	ListField        string
	FieldName        string
	FieldParentType  string
	FieldType        string
	ArgumentsToAdd   []fieldArgumentSpec
	Arguments        []argumentInfo
	ResolveQuery     string
	Keys             []fieldArgumentSpec
	SupportsForward  bool
	SupportsBackward bool
	Connection       bool
	CursorType       string
	Paginate         string
}

type paginationContext struct {
	context.Context
	conn                             *sqlite.Conn
	db                               plugins.DatabasePool[config.PluginConfig]
	insertDocument                   *sqlite.Stmt
	insertFragment                   *sqlite.Stmt
	insertDocumentVariable           *sqlite.Stmt
	insertSelectionArgument          *sqlite.Stmt
	insertSelection                  *sqlite.Stmt
	insertSelectionRef               *sqlite.Stmt
	insertArgumentValue              *sqlite.Stmt
	insertDocumentDirectives         *sqlite.Stmt
	insertDocumentDirectiveArgument  *sqlite.Stmt
	deleteSelectionArgument          *sqlite.Stmt
	insertSelectionDirective         *sqlite.Stmt
	insertSelectionDirectiveArgument *sqlite.Stmt
	copyArgumentValue                *sqlite.Stmt
	insertDiscoveredLists            *sqlite.Stmt
	copySelectionsQuery              *sqlite.Stmt
	copyChildSelectionsQuery         *sqlite.Stmt
	copyDirectiveQuery               *sqlite.Stmt
	getOriginalListQuery             *sqlite.Stmt
	getPaginatedFieldAliasQuery      *sqlite.Stmt
	getVariablesQuery                *sqlite.Stmt
}

func PreparePaginationDocuments(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
) error {
	projectConfig, err := db.ProjectConfig(ctx)
	if err != nil {
		return plugins.WrapError(err)
	}

	conn, err := db.Take(ctx)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer db.Put(conn)

	close := sqlitex.Transaction(conn)
	commit := func(err error) error {
		close(&err)
		return err
	}

	// in order to prepare paginated documents to load we need add the necessary arguments and replace any references to the pagination fields
	// with the appropriate variable references. to pull this off, we need to look at the discovered lists and extract information about
	// variables that are defined on the document as well as arguments that are passed to the field that's marked with the paginate/list directive
	query, err := conn.Prepare(`
		SELECT
			raw_documents.id,
			selection_refs.document as document,
			documents.kind as document_kind,
			discovered_lists.list_field,
			json_group_array(
				DISTINCT json_object(
					'variable', document_variables."name",
					'id', document_variables.id
				)
			) FILTER (WHERE document_variables.id IS NOT NULL) as variables,
			json_group_array(
			DISTINCT json_object(
				'argument', selection_arguments."name",
				'id', selection_arguments.id,
				'value', selection_arguments."value",
				'kind', argument_values.kind,
				'raw', argument_values.raw,
				'expected_type', argument_values.expected_type,
				'type_modifiers', COALESCE(fragment_vars.type_modifiers, '')
			)
			) FILTER (WHERE selection_arguments.id IS NOT NULL) as arguments,
			discovered_lists.supports_forward,
			discovered_lists.supports_backward,
			discovered_lists."connection",
			selections.type,
			field_info.name as field_name,
			documents.name,
			CASE
				WHEN types.operation is not null THEN null
				WHEN documents.type_condition IS NOT NULL
					THEN COALESCE(type_configs.resolve_query, 'node')
				ELSE null
			END as resolve_query,
			CASE
				WHEN COUNT(tf.type) = 0 OR documents.type_condition is null THEN NULL
				ELSE json_group_array(
					DISTINCT json_object(
						'name', je.value,
						'kind', tf.type
					)
				)
			END as resolve_key_objects,
			documents.type_condition,
			discovered_lists.paginate,
      discovered_lists.cursor_type as cursor_type,
			field_info.parent as parent_type
		FROM discovered_lists
			JOIN documents on discovered_lists.document = documents.id
			JOIN raw_documents on documents.raw_document = raw_documents.id
			JOIN selections on discovered_lists.list_field = selections.id
			LEFT JOIN type_fields field_info on selections.type = field_info.id
			JOIN selection_refs on selection_refs.child_id = selections.id
		      AND selection_refs.document = documents.id
		  LEFT JOIN document_variables on document_variables."document" = selection_refs.document
		       AND document_variables."name" in ('first', 'last', 'limit', 'before', 'after', 'offset')
			LEFT JOIN selection_arguments on discovered_lists.list_field = selection_arguments.selection_id
          AND selection_arguments.document = documents.id
			LEFT JOIN argument_values on selection_arguments.value = argument_values.id
			LEFT JOIN document_variables fragment_vars on fragment_vars.document = documents.id
				AND fragment_vars.name = selection_arguments.name
			LEFT JOIN types on documents.type_condition = types."name"
			LEFT JOIN type_configs on documents.type_condition = type_configs."name"
			JOIN config
			CROSS JOIN json_each(COALESCE(type_configs.keys, config.default_keys)) AS je
			LEFT JOIN type_fields tf
				ON tf.parent = documents.type_condition
				AND tf.name = je.value
			LEFT JOIN documents existing_operations ON existing_operations.name = documents.name || $pagination_suffix
		WHERE (raw_documents.current_task = $task_id OR $task_id IS NULL)
	 	  AND documents.name NOT LIKE '%_paginated%'
		  AND existing_operations.id IS NULL
		  AND (documents.processed = false OR documents.processed IS NULL)
		GROUP BY discovered_lists.id
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}

	defer query.Finalize()
	err = db.BindStatement(query, map[string]any{
		"pagination_suffix": graphql.PaginationQuerySuffix,
	})
	if err != nil {
		return commit(plugins.WrapError(err))
	}

	// once we have a row, we'll need to insert variables and arguments into the document (and maybe extra documents)
	insertDocument, err := conn.Prepare(`
		INSERT INTO documents (name, kind, raw_document, internal, visible) VALUES ($name, 'query', $raw_document, false, false)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertDocument.Finalize()
	insertFragment, err := conn.Prepare(`
		INSERT INTO documents (name, kind, raw_document, type_condition, internal, visible) VALUES ($name, 'fragment', $raw_document, $type_condition, true, false)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertFragment.Finalize()
	insertDocumentVariable, err := conn.Prepare(`
		INSERT INTO document_variables (document, "name", type, type_modifiers, default_value, row, column) VALUES ($document, $name, $type, $type_modifiers, $default_value, 0, 0)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertDocumentVariable.Finalize()
	insertSelectionArgument, err := conn.Prepare(`
		INSERT INTO selection_arguments (selection_id, "name", "value", row, column, field_argument, document) VALUES ($selection_id, $name, $value, 0, 0, $field_argument, $document)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertSelectionArgument.Finalize()
	insertSelection, err := conn.Prepare(`
		INSERT INTO selections (field_name, kind, alias, type, fragment_args) VALUES ($field_name, $kind, $field_name, $type, $fragment_args)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertSelection.Finalize()

	insertSelectionRef, err := conn.Prepare(`
		INSERT INTO selection_refs (document, child_id, parent_id, row, column, path_index, internal) VALUES ($document, $child_id, $parent_id, 0, 0, 0, $internal)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertSelectionRef.Finalize()
	insertArgumentValue, err := conn.Prepare(`
		INSERT INTO argument_values (kind, raw, expected_type, document, row, column) VALUES ($kind, $raw, $expected_type, $document, 0, 0)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertArgumentValue.Finalize()
	insertDocumentDirectives, err := conn.Prepare(`
		INSERT INTO document_directives (document, directive, row, column) VALUES ($document, $directive, 0, 0)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertDocumentDirectives.Finalize()
	insertDocumentDirectiveArgument, err := conn.Prepare(`
		INSERT INTO document_directive_arguments (parent, name, value) VALUES ($document_directive, $argument, $value)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertDocumentDirectiveArgument.Finalize()

	// we might also need to delete an existing argument in place of the new one
	deleteSelectionArgument, err := conn.Prepare(`
		DELETE FROM selection_arguments WHERE id = $id
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer deleteSelectionArgument.Finalize()

	// we'll need to add selection directives
	insertSelectionDirective, err := conn.Prepare(`
		INSERT INTO selection_directives (selection_id, directive, row, column) VALUES ($selection, $directive, 0, 0)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertSelectionDirective.Finalize()
	// we'll need to add selection directive arguments
	insertSelectionDirectiveArgument, err := conn.Prepare(`
		INSERT INTO selection_directive_arguments (parent, name, value, document) VALUES ($parent, $name, $value, $document)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertSelectionDirectiveArgument.Finalize()
	// a query to copy argument values for defaults in generated query
	copyArgumentValue, err := conn.Prepare(`
    INSERT INTO argument_values (kind, raw, row, column, expected_type, document)
    SELECT kind, raw, row, column, expected_type, $document
    FROM argument_values where id = $id
  `)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer copyArgumentValue.Finalize()
	// statement to insert discovered lists entries
	insertDiscoveredLists, err := conn.Prepare(`
		INSERT INTO discovered_lists
      (
        name,
        node_type,
        edge_type,
        connection_type,
        document,
        connection,
        list_field,
        paginate,
        node,
        page_size,
        mode,
        embedded,
        target_type,
        supports_forward,
        supports_backward,
        cursor_type
      ) VALUES (
        $name,
        $node_type,
        $edge_type,
        $connection_type,
        $document,
        $connection,
        $list_field,
        $paginate,
        $node,
        $page_size,
        $mode,
        $embedded,
        $target_type,
        $supports_forward,
        $supports_backward,
        $cursor_type
      )
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertDiscoveredLists.Finalize()

	// statements for fragment pagination processing
	copySelectionsQuery, err := conn.Prepare(`
		INSERT INTO selection_refs (parent_id, child_id, document, row, column, path_index, internal)
		SELECT parent_id, child_id, $new_document, row, column, path_index, internal
		FROM selection_refs
		WHERE document = $original_document AND child_id != $paginated_field
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer copySelectionsQuery.Finalize()

	copyChildSelectionsQuery, err := conn.Prepare(`
		INSERT INTO selection_refs (parent_id, child_id, document, row, column, path_index, internal)
		SELECT $new_parent_id, child_id, $new_document, row, column, path_index, internal
		FROM selection_refs
		WHERE document = $original_document AND parent_id = $original_parent_id
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer copyChildSelectionsQuery.Finalize()

	copyDirectiveQuery, err := conn.Prepare(`
		INSERT INTO selection_directives (selection_id, directive, row, column)
		SELECT $new_selection_id, directive, row, column
		FROM selection_directives
		WHERE selection_id = $original_selection_id AND directive IN ('paginate', 'list')
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer copyDirectiveQuery.Finalize()

	getOriginalListQuery, err := conn.Prepare(`
		SELECT node_type, edge_type, connection_type, page_size, mode, node
		FROM discovered_lists
		WHERE document = $document AND list_field = $list_field
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer getOriginalListQuery.Finalize()

	getPaginatedFieldAliasQuery, err := conn.Prepare(`
		SELECT COALESCE(NULLIF(s.alias, s.field_name), s.field_name) as field_alias
		FROM selections s
		WHERE s.id = $list_field
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer getPaginatedFieldAliasQuery.Finalize()

	getVariablesQuery, err := conn.Prepare(`
		SELECT name, id
		FROM document_variables
		WHERE document = $document AND name IN ('first', 'last', 'limit', 'before', 'after', 'offset')
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer getVariablesQuery.Finalize()

	// create pagination context with all prepared statements
	paginationCtx := &paginationContext{
		conn:                             conn,
		db:                               db,
		Context:                          ctx,
		insertDocument:                   insertDocument,
		insertFragment:                   insertFragment,
		insertDocumentVariable:           insertDocumentVariable,
		insertSelectionArgument:          insertSelectionArgument,
		insertSelection:                  insertSelection,
		insertSelectionRef:               insertSelectionRef,
		insertArgumentValue:              insertArgumentValue,
		insertDocumentDirectives:         insertDocumentDirectives,
		insertDocumentDirectiveArgument:  insertDocumentDirectiveArgument,
		deleteSelectionArgument:          deleteSelectionArgument,
		insertSelectionDirective:         insertSelectionDirective,
		insertSelectionDirectiveArgument: insertSelectionDirectiveArgument,
		copyArgumentValue:                copyArgumentValue,
		insertDiscoveredLists:            insertDiscoveredLists,
		copySelectionsQuery:              copySelectionsQuery,
		copyChildSelectionsQuery:         copyChildSelectionsQuery,
		copyDirectiveQuery:               copyDirectiveQuery,
		getOriginalListQuery:             getOriginalListQuery,
		getPaginatedFieldAliasQuery:      getPaginatedFieldAliasQuery,
		getVariablesQuery:                getVariablesQuery,
	}

	// track processed discovered lists to avoid duplicates
	processedLists := make(map[string]discoveredList)

	errs := &plugins.ErrorList{}

	err = db.StepStatement(ctx, query, func() {
		// pull out the row values
		rawDocument := query.ColumnInt(0)
		document := query.ColumnInt64(1)
		docType := query.ColumnText(2)
		listField := query.ColumnText(3)
		variablesStr := query.ColumnText(4)
		argumentsStr := query.ColumnText(5)
		supportsForward := query.ColumnBool(6)
		supportsBackward := query.ColumnBool(7)
		connection := query.ColumnBool(8)
		fieldType := query.ColumnText(9)
		fieldName := query.ColumnText(10)
		documentName := query.ColumnText(11)
		resolveQuery := query.ColumnText(12)
		resolveKeys := query.ColumnText(13)
		typeCondition := query.ColumnText(14)
		cursorType := query.GetText("cursor_type")
		paginate := query.GetText("paginate")
		parentType := query.GetText("parent_type")

		if query.IsNull("paginate") {
			return
		}

		// create a unique key for this discovered list to avoid processing duplicates
		// use discovered_lists.id if available, otherwise fall back to composite key
		listKey := fmt.Sprintf("%s-%d-%s", listField, document, fieldName)
		if processedLists[listKey].ID != 0 {
			return // already processed this list
		}

		// unmarshal the variables
		var variables []variableInfo
		if err := json.Unmarshal([]byte(variablesStr), &variables); err != nil {
			errs.Append(plugins.WrapError(fmt.Errorf("failed to unmarshal variables: %v", err)))
			return
		}

		// unmarshal the arguments
		var arguments []argumentInfo
		if argumentsStr != "" {
			if err := json.Unmarshal([]byte(argumentsStr), &arguments); err != nil {
				errs.Append(plugins.WrapError(fmt.Errorf("failed to unmarshal arguments: %v", err)))
				return
			}
		}

		// unmarshal the keys to use when resolving this field
		keys := []fieldArgumentSpec{}
		if resolveKeys != "" {
			if err := json.Unmarshal([]byte(resolveKeys), &keys); err != nil {
				errs.Append(plugins.WrapError(fmt.Errorf("failed to unmarshal keys: %v", err)))
				return
			}
		}

		// determine which pagination arguments to add based on connection type and support
		argumentsToAdd := determinePaginationArguments(
			connection,
			supportsForward,
			supportsBackward,
			cursorType,
		)

		// save the list metadata
		processedLists[listKey] = discoveredList{
			ID:               document,
			RawDocument:      rawDocument,
			DocumentName:     documentName,
			DocumentType:     docType,
			TypeCondition:    typeCondition,
			ListField:        listField,
			FieldName:        fieldName,
			FieldParentType:  parentType,
			FieldType:        fieldType,
			ArgumentsToAdd:   argumentsToAdd,
			Arguments:        arguments,
			ResolveQuery:     resolveQuery,
			Keys:             keys,
			SupportsForward:  supportsForward,
			SupportsBackward: supportsBackward,
			Connection:       connection,
			CursorType:       cursorType,
			Paginate:         paginate,
		}
	})
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	if errs.Len() > 0 {
		return commit(errs)
	}

	// iterate over the rows. each row represents a field that is tagged with @paginate
	for _, list := range processedLists {
		// handle fragment vs query processing differently
		if list.DocumentType == "fragment" {
			// for fragments, create a new paginated fragment document
			_, err := processFragmentPagination(
				paginationCtx,
				projectConfig,
				list,
			)
			if err != nil {
				errs.Append(plugins.WrapError(err))
				continue
			}
			// skip the rest of the processing for fragments
			continue
		}

		// for queries, process pagination in-place
		err := processQueryPagination(
			paginationCtx,
			projectConfig,
			list,
		)
		if err != nil {
			errs.Append(plugins.WrapError(err))
			continue
		}
	}

	if errs.Len() > 0 {
		return commit(errs)
	}

	// we're done
	return commit(nil)
}

// createSelection creates a new selection without deduplication
// Pagination logic needs unique selections for each context
func (ctx *paginationContext) createSelection(params map[string]any) (int64, error) {
	// Always create new selections for pagination logic
	err := ctx.db.ExecStatement(ctx.insertSelection, params)
	if err != nil {
		return 0, err
	}

	return ctx.conn.LastInsertRowID(), nil
}

// determinePaginationArguments determines which pagination arguments to add based on connection type and support
func determinePaginationArguments(
	connection bool,
	supportsForward bool,
	supportsBackward bool,
	cursorType string,
) []fieldArgumentSpec {
	var argumentsToAdd []fieldArgumentSpec

	if connection {
		if supportsForward {
			argumentsToAdd = append(argumentsToAdd,
				fieldArgumentSpec{
					Name: "first",
					Kind: "Int",
				},
				fieldArgumentSpec{
					Name: "after",
					Kind: cursorType,
				},
			)
		}
		if supportsBackward {
			argumentsToAdd = append(argumentsToAdd,
				fieldArgumentSpec{
					Name: "last",
					Kind: "Int",
				},
				fieldArgumentSpec{
					Name: "before",
					Kind: cursorType,
				},
			)
		}
	} else {
		if supportsForward {
			argumentsToAdd = append(argumentsToAdd,
				fieldArgumentSpec{
					Name: "limit",
					Kind: "Int",
				},
				fieldArgumentSpec{
					Name: "offset",
					Kind: "Int",
				},
			)
		}
	}

	return argumentsToAdd
}

// processFragmentPagination creates a paginated fragment document and associated query document
func processFragmentPagination(
	ctx *paginationContext,
	projectConfig plugins.ProjectConfig,
	list discoveredList,
) (int64, error) {
	// create a new paginated fragment document
	paginatedFragmentName := list.DocumentName + "_paginated"
	err := ctx.db.ExecStatement(ctx.insertFragment, map[string]any{
		"name":           paginatedFragmentName,
		"type_condition": list.TypeCondition,
		"raw_document":   list.RawDocument,
	})
	if err != nil {
		return 0, err
	}
	paginatedFragmentID := ctx.conn.LastInsertRowID()

	// make sure that the new documents has all of the ncessary variables
	addedFragmentArgs := map[string]bool{}
	for _, arg := range list.Arguments {

		// copy default value if it exists
		var defaultValue any
		if arg.Value != 0 {
			err = ctx.db.ExecStatement(ctx.copyArgumentValue, map[string]any{
				"id":       arg.Value,
				"document": paginatedFragmentID,
			})
			if err != nil {
				return 0, err
			}
			defaultValue = ctx.conn.LastInsertRowID()
		}

		// add document variable
		err = ctx.db.ExecStatement(ctx.insertDocumentVariable, map[string]any{
			"document":       paginatedFragmentID,
			"name":           arg.Argument,
			"type":           arg.ExpectedType,
			"type_modifiers": arg.TypeModifiers,
			"default_value":  defaultValue,
		})
		if err != nil {
			return 0, err
		}

		addedFragmentArgs[arg.Argument] = true
	}

	for _, arg := range list.ArgumentsToAdd {
		// if we already added it, skip it
		if addedFragmentArgs[arg.Name] {
			continue
		}

		err = ctx.db.ExecStatement(ctx.insertDocumentVariable, map[string]any{
			"document": paginatedFragmentID,
			"name":     arg.Name,
			"type":     arg.Kind,
		})
		if err != nil {
			return 0, err
		}
		addedFragmentArgs[arg.Name] = true
	}
	// copy all selections from the original fragment EXCEPT the paginated field
	err = ctx.db.ExecStatement(ctx.copySelectionsQuery, map[string]any{
		"new_document":      paginatedFragmentID,
		"original_document": list.ID,
		"paginated_field":   list.ListField,
	})
	if err != nil {
		return 0, err
	}

	// create a new selection for the paginated field with pagination arguments
	newPaginatedSelectionID, err := ctx.createSelection(map[string]any{
		"field_name":    list.FieldName,
		"kind":          "field",
		"type":          list.FieldType,
		"fragment_args": nil,
	})
	if err != nil {
		return 0, err
	}

	// add the selection ref for the new paginated field
	err = ctx.db.ExecStatement(ctx.insertSelectionRef, map[string]any{
		"document": paginatedFragmentID,
		"child_id": newPaginatedSelectionID,
		"internal": false,
	})
	if err != nil {
		return 0, err
	}

	// add pagination arguments to the new selection
	for _, arg := range list.ArgumentsToAdd {
		// create the variable value
		err = ctx.db.ExecStatement(ctx.insertArgumentValue, map[string]any{
			"kind":          "Variable",
			"raw":           arg.Name,
			"expected_type": arg.Kind,
			"document":      paginatedFragmentID,
		})
		if err != nil {
			return 0, err
		}

		// add the argument to the field
		err = ctx.db.ExecStatement(ctx.insertSelectionArgument, map[string]any{
			"selection_id": newPaginatedSelectionID,
			"name":         arg.Name,
			"value":        ctx.conn.LastInsertRowID(),
			"field_argument": fmt.Sprintf(
				"%s.%s.%s",
				list.FieldParentType,
				list.FieldName,
				arg.Name,
			),
			"document": paginatedFragmentID,
		})
		if err != nil {
			return 0, err
		}
	}

	// add fragment arguments (non-pagination arguments) to the paginated field
	for _, arg := range list.Arguments {
		// skip pagination arguments as they're already handled above
		isPaginationArg := false
		for _, paginationArg := range list.ArgumentsToAdd {
			if arg.Argument == paginationArg.Name {
				isPaginationArg = true
				break
			}
		}
		if isPaginationArg {
			continue
		}

		// create the variable value
		err = ctx.db.ExecStatement(ctx.insertArgumentValue, map[string]any{
			"kind":          "Variable",
			"raw":           arg.Argument,
			"expected_type": arg.ExpectedType,
			"document":      paginatedFragmentID,
		})
		if err != nil {
			return 0, err
		}

		// add the argument to the field
		err = ctx.db.ExecStatement(ctx.insertSelectionArgument, map[string]any{
			"selection_id": newPaginatedSelectionID,
			"name":         arg.Argument,
			"value":        ctx.conn.LastInsertRowID(),
			"document":     paginatedFragmentID,
			"field_argument": fmt.Sprintf(
				"%s.%s.%s",
				list.FieldParentType,
				list.FieldName,
				arg.Argument,
			),
		})
		if err != nil {
			return 0, err
		}
	}

	// copy child selections of the paginated field
	err = ctx.db.ExecStatement(ctx.copyChildSelectionsQuery, map[string]any{
		"new_parent_id":      newPaginatedSelectionID,
		"new_document":       paginatedFragmentID,
		"original_document":  list.ID,
		"original_parent_id": list.ListField,
	})
	if err != nil {
		return 0, err
	}

	// copy the original pagination directive (@paginate or @list) to the new selection
	err = ctx.db.ExecStatement(ctx.copyDirectiveQuery, map[string]any{
		"new_selection_id":      newPaginatedSelectionID,
		"original_selection_id": list.ListField,
	})
	if err != nil {
		return 0, err
	}

	// create query document that uses the paginated fragment
	err = ctx.db.ExecStatement(ctx.insertDocument, map[string]any{
		"name":         graphql.FragmentPaginationQueryName(list.DocumentName),
		"raw_document": list.RawDocument,
	})
	if err != nil {
		return 0, err
	}
	queryDocumentID := ctx.conn.LastInsertRowID()

	// create fragment spread selection that references the paginated fragment
	fragmentSpreadID, err := ctx.createSelection(map[string]any{
		"field_name":    paginatedFragmentName,
		"kind":          "fragment",
		"type":          "",
		"fragment_args": nil,
	})
	if err != nil {
		return 0, err
	}

	// handle resolve query logic
	if list.ResolveQuery == "" {
		// no resolve query needed, add fragment spread directly to document
		err = ctx.db.ExecStatement(ctx.insertSelectionRef, map[string]any{
			"document": queryDocumentID,
			"child_id": fragmentSpreadID,
			"internal": false,
		})
		if err != nil {
			return 0, err
		}
	} else {
		// need to create a resolve query field first
		resolveSelectionID, err := ctx.createSelection(map[string]any{
			"field_name":    list.ResolveQuery,
			"kind":          "field",
			"type":          fmt.Sprintf("Query.%s", list.ResolveQuery),
			"fragment_args": nil,
		})
		if err != nil {
			return 0, err
		}

		// add resolve selection to document
		err = ctx.db.ExecStatement(ctx.insertSelectionRef, map[string]any{
			"document": queryDocumentID,
			"child_id": resolveSelectionID,
			"internal": false,
		})
		if err != nil {
			return 0, err
		}

		// add fragment spread as child of resolve selection
		err = ctx.db.ExecStatement(ctx.insertSelectionRef, map[string]any{
			"document":  queryDocumentID,
			"child_id":  fragmentSpreadID,
			"parent_id": resolveSelectionID,
			"internal":  true,
		})
		if err != nil {
			return 0, err
		}

		// add resolve query arguments (keys)
		for _, key := range list.Keys {
			// create variable value for resolve query argument
			err = ctx.db.ExecStatement(ctx.insertArgumentValue, map[string]any{
				"kind":          "Variable",
				"raw":           key.Name,
				"expected_type": key.Kind,
				"document":      queryDocumentID,
			})
			if err != nil {
				return 0, err
			}

			// add argument to resolve selection
			err = ctx.db.ExecStatement(ctx.insertSelectionArgument, map[string]any{
				"selection_id":   resolveSelectionID,
				"name":           key.Name,
				"value":          ctx.conn.LastInsertRowID(),
				"field_argument": fmt.Sprintf("Query.%s.%s", list.ResolveQuery, key.Name),
				"document":       queryDocumentID,
			})
			if err != nil {
				return 0, err
			}

			// add document variable for resolve query argument
			err = ctx.db.ExecStatement(ctx.insertDocumentVariable, map[string]any{
				"document":       queryDocumentID,
				"name":           key.Name,
				"type":           key.Kind,
				"type_modifiers": "!",
			})
			if err != nil {
				return 0, err
			}
		}
	}

	// add @with directive to fragment spread
	err = ctx.db.ExecStatement(ctx.insertSelectionDirective, map[string]any{
		"selection": fragmentSpreadID,
		"directive": graphql.WithDirective,
	})
	if err != nil {
		return 0, err
	}
	withDirectiveID := ctx.conn.LastInsertRowID()

	// add pagination arguments to @with directive and document variables
	addedQueryArgs := map[string]bool{}
	for _, arg := range list.ArgumentsToAdd {
		// create variable value for @with directive
		err = ctx.db.ExecStatement(ctx.insertArgumentValue, map[string]any{
			"kind":          "Variable",
			"raw":           arg.Name,
			"expected_type": arg.Kind,
			"document":      queryDocumentID,
		})
		if err != nil {
			return 0, err
		}

		// add argument to @with directive
		err = ctx.db.ExecStatement(ctx.insertSelectionDirectiveArgument, map[string]any{
			"parent":   withDirectiveID,
			"name":     arg.Name,
			"value":    ctx.conn.LastInsertRowID(),
			"document": queryDocumentID,
		})
		if err != nil {
			return 0, err
		}

		// find default value from original arguments
		var defaultValue any
		for _, appliedArg := range list.Arguments {
			if appliedArg.Argument == arg.Name {
				if appliedArg.Kind != "Variable" {
					err = ctx.db.ExecStatement(ctx.copyArgumentValue, map[string]any{
						"id":       appliedArg.Value,
						"document": queryDocumentID,
					})
					if err != nil {
						return 0, err
					}
					defaultValue = ctx.conn.LastInsertRowID()
				}
				break
			}
		}

		// copy default value if it exists
		if defaultValue != nil {
			err = ctx.db.ExecStatement(ctx.copyArgumentValue, map[string]any{
				"id":       defaultValue,
				"document": queryDocumentID,
			})
			if err != nil {
				return 0, err
			}
			defaultValue = ctx.conn.LastInsertRowID()
		}

		// add document variable
		err = ctx.db.ExecStatement(ctx.insertDocumentVariable, map[string]any{
			"document":       queryDocumentID,
			"name":           arg.Name,
			"type":           arg.Kind,
			"type_modifiers": "", // pagination arguments don't have type modifiers
			"default_value":  defaultValue,
		})
		if err != nil {
			return 0, err
		}

		addedQueryArgs[arg.Name] = true
	}

	// add fragment arguments (non-pagination arguments) to @with directive and document variables
	for _, arg := range list.Arguments {
		if addedQueryArgs[arg.Argument] {
			continue
		}
		// skip pagination arguments as they're already handled above
		isPaginationArg := false
		for _, paginationArg := range list.ArgumentsToAdd {
			if arg.Argument == paginationArg.Name {
				isPaginationArg = true
				break
			}
		}
		if isPaginationArg {
			continue
		}

		// create variable value for @with directive
		err = ctx.db.ExecStatement(ctx.insertArgumentValue, map[string]any{
			"kind":          "Variable",
			"raw":           arg.Argument,
			"expected_type": arg.ExpectedType,
			"document":      queryDocumentID,
		})
		if err != nil {
			return 0, err
		}

		// add argument to @with directive
		err = ctx.db.ExecStatement(ctx.insertSelectionDirectiveArgument, map[string]any{
			"parent":   withDirectiveID,
			"name":     arg.Argument,
			"value":    ctx.conn.LastInsertRowID(),
			"document": queryDocumentID,
		})
		if err != nil {
			return 0, err
		}

		// copy default value if it exists
		var defaultValue any
		if arg.Kind != "Variable" {
			err = ctx.db.ExecStatement(ctx.copyArgumentValue, map[string]any{
				"id":       arg.Value,
				"document": queryDocumentID,
			})
			if err != nil {
				return 0, err
			}
			defaultValue = ctx.conn.LastInsertRowID()
		}

		// add document variable
		err = ctx.db.ExecStatement(ctx.insertDocumentVariable, map[string]any{
			"document":       queryDocumentID,
			"name":           arg.Argument,
			"type":           arg.ExpectedType,
			"type_modifiers": arg.TypeModifiers, // preserve type modifiers from fragment arguments
			"default_value":  defaultValue,
		})
		if err != nil {
			return 0, err
		}
	}

	// add @dedupe directive to query document if not suppressed
	if !projectConfig.SuppressPaginationDeduplication {
		// add @dedupe directive to query document
		err = ctx.db.ExecStatement(ctx.insertDocumentDirectives, map[string]any{
			"document":  queryDocumentID,
			"directive": graphql.DedupeDirective,
		})
		if err != nil {
			return 0, err
		}
		dedupeDirectiveID := ctx.conn.LastInsertRowID()

		// add match argument to @dedupe directive
		err = ctx.db.ExecStatement(ctx.insertArgumentValue, map[string]any{
			"kind":          "Enum",
			"raw":           "Variables",
			"expected_type": "DedupeMatchMode",
			"document":      queryDocumentID,
		})
		if err != nil {
			return 0, err
		}

		err = ctx.db.ExecStatement(ctx.insertDocumentDirectiveArgument, map[string]any{
			"document_directive": dedupeDirectiveID,
			"argument":           "match",
			"value":              ctx.conn.LastInsertRowID(),
		})
		if err != nil {
			return 0, err
		}
	}

	// create discovered_lists entry for the pagination query
	// first, get the pagination metadata from the original fragment's discovered_lists entry
	var nodeType, edgeType, connectionType, mode string
	var pageSize, node int64

	err = ctx.db.BindStatement(ctx.getOriginalListQuery, map[string]any{
		"document":   list.ID,
		"list_field": list.ListField,
	})
	if err != nil {
		return 0, err
	}

	err = ctx.db.StepStatement(ctx, ctx.getOriginalListQuery, func() {
		nodeType = ctx.getOriginalListQuery.ColumnText(0)
		edgeType = ctx.getOriginalListQuery.ColumnText(1)
		connectionType = ctx.getOriginalListQuery.ColumnText(2)
		pageSize = ctx.getOriginalListQuery.ColumnInt64(3)
		mode = ctx.getOriginalListQuery.ColumnText(4)
		node = ctx.getOriginalListQuery.ColumnInt64(5)
	})
	if err != nil {
		return 0, err
	}

	// use the field from the base paginated fragment for the pagination query
	// the fragment variant will inherit the pagination metadata from the base fragment
	listFieldForQuery := newPaginatedSelectionID

	// store pagination metadata for the generated query document
	// ensure paginate is always non-null for pagination queries to get ::paginated suffix
	paginateValue := list.Paginate
	if paginateValue == "" {
		paginateValue = "forward" // default to forward pagination
	}
	// Determine the target type for fragment pagination queries
	// If the type condition has a custom resolve query in the config, use that type
	// Otherwise, default to "Node" which uses the node(id: $id) query field
	targetType := "Node" // default fallback
	if typeConfig, exists := projectConfig.TypeConfig[list.TypeCondition]; exists &&
		typeConfig.ResolveQuery != "" {
		targetType = list.TypeCondition
	}

	err = ctx.db.ExecStatement(ctx.insertDiscoveredLists, map[string]any{
		"name":              "",
		"node_type":         nodeType,
		"edge_type":         edgeType,
		"connection_type":   connectionType,
		"document":          paginatedFragmentID,
		"connection":        list.Connection,
		"list_field":        listFieldForQuery,
		"paginate":          paginateValue,
		"node":              node,
		"page_size":         pageSize,
		"mode":              mode,
		"embedded":          false,
		"target_type":       targetType,
		"supports_forward":  list.SupportsForward,
		"supports_backward": list.SupportsBackward,
		"cursor_type":       list.CursorType,
	})
	if err != nil {
		return 0, err
	}

	err = ctx.db.ExecStatement(ctx.insertDiscoveredLists, map[string]any{
		"name":              "",
		"node_type":         nodeType,
		"edge_type":         edgeType,
		"connection_type":   connectionType,
		"document":          queryDocumentID,
		"connection":        list.Connection,
		"list_field":        listFieldForQuery,
		"paginate":          paginateValue,
		"node":              node,
		"page_size":         pageSize,
		"mode":              mode,
		"embedded":          false,
		"target_type":       targetType,
		"supports_forward":  list.SupportsForward,
		"supports_backward": list.SupportsBackward,
		"cursor_type":       list.CursorType,
	})
	if err != nil {
		return 0, err
	}

	return queryDocumentID, nil
}

// processQueryPagination handles pagination processing for query documents
func processQueryPagination(
	ctx *paginationContext,
	projectConfig plugins.ProjectConfig,
	list discoveredList,
) error {
	// We need to get the variables from the database since they're not part of the discoveredList struct
	// Get variables for this document
	var variables []variableInfo
	err := ctx.db.BindStatement(ctx.getVariablesQuery, map[string]any{
		"document": list.ID,
	})
	if err != nil {
		return err
	}

	err = ctx.db.StepStatement(ctx, ctx.getVariablesQuery, func() {
		variables = append(variables, variableInfo{
			Variable: ctx.getVariablesQuery.ColumnText(0),
			ID:       ctx.getVariablesQuery.ColumnInt(1),
		})
	})
	if err != nil {
		return err
	}

	// now that the field has all of the arguments we need to define the corresponding variables
	// on the document
ARGUMENTS:
	for _, arg := range list.ArgumentsToAdd {
		// if the variable is already defined then we have a value ID to use as the default value
		var defaultValue any
		for _, appliedArg := range list.Arguments {
			if appliedArg.Argument == arg.Name {
				if appliedArg.Kind != "Variable" {
					defaultValue = appliedArg.Value
				}
				break
			}
		}

		// if the variable is already defined, skip it
		for _, variable := range variables {
			if variable.Variable == arg.Name {
				continue ARGUMENTS
			}
		}

		// add the variable to the document
		err := ctx.db.ExecStatement(ctx.insertDocumentVariable, map[string]any{
			"document":      list.ID,
			"name":          arg.Name,
			"type":          arg.Kind,
			"default_value": defaultValue,
		})
		if err != nil {
			return err
		}
	}

	// loop over the arguments and make sure the field document has the necessary variables defined
	for _, arg := range list.ArgumentsToAdd {
		// the argument might already be defined on the field, in which case we can just delete the row in the database
		// we'll replace it with the variable reference later
		for _, existingArg := range list.Arguments {
			if existingArg.Argument == arg.Name {

				// if the argument is already defined, we need to make sure that the type matches
				err := ctx.db.ExecStatement(
					ctx.deleteSelectionArgument,
					map[string]any{"id": existingArg.ID},
				)
				if err != nil {
					return err
				}

				break
			}
		}

		// create the variable value and make sure it is used inside of the document
		// with the paginated field
		err := ctx.db.ExecStatement(ctx.insertArgumentValue, map[string]any{
			"kind":          "Variable",
			"raw":           arg.Name,
			"expected_type": arg.Kind,
			"document":      list.ID,
		})
		if err != nil {
			return err
		}
		// add the argument to the field
		err = ctx.db.ExecStatement(ctx.insertSelectionArgument, map[string]any{
			"selection_id": list.ListField,
			"name":         arg.Name,
			"value":        ctx.conn.LastInsertRowID(),
			"field_argument": fmt.Sprintf(
				"%s.%s.%s",
				list.FieldParentType,
				list.FieldName,
				arg.Name,
			),
			"document": list.ID,
		})
		if err != nil {
			return err
		}
	}

	// for queries, the document that performs the query is the same document
	queryDocument := list.ID

	// if we aren't supposed to suppress the dedupe directive, we need to add it to the document
	if !projectConfig.SuppressPaginationDeduplication {
		// add the dedupe directive to the document
		err := ctx.db.ExecStatement(ctx.insertDocumentDirectives, map[string]any{
			"document":  queryDocument,
			"directive": graphql.DedupeDirective,
		})
		if err != nil {
			return err
		}

		directiveID := ctx.conn.LastInsertRowID()

		// set the match argument to Variables
		err = ctx.db.ExecStatement(ctx.insertArgumentValue, map[string]any{
			"kind":          "Enum",
			"raw":           "Variables",
			"expected_type": "DedupeMatchMode",
			"document":      queryDocument,
		})
		if err != nil {
			return err
		}

		err = ctx.db.ExecStatement(ctx.insertDocumentDirectiveArgument, map[string]any{
			"document_directive": directiveID,
			"argument":           "match",
			"value":              ctx.conn.LastInsertRowID(),
		})
		if err != nil {
			return err
		}
	}

	return nil
}
