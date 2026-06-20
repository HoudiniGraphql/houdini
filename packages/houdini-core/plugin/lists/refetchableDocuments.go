package lists

import (
	"context"
	"encoding/json"
	"fmt"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/graphql"
)

// refetchableFragment captures everything we need to generate the embedded query
// for a fragment tagged with @refetchable.
type refetchableFragment struct {
	ID            int64
	Name          string
	RawDocument   int
	TypeCondition string
	ResolveQuery  string
	Keys          []fieldArgumentSpec
}

// refetchableArg is an @arguments declaration on the fragment. These need to be
// forwarded to the generated query (as document variables) and passed back into
// the fragment via @with so they can be supplied at refetch time.
type refetchableArg struct {
	Name          string
	Type          string
	TypeModifiers string
	DefaultValue  int64 // argument_values id, 0 if there is no default
}

// PrepareRefetchableDocuments looks for every fragment tagged with @refetchable and
// generates an embedded query (named <Fragment>_Refetch_Query) that re-fetches the
// fragment by id. This is the same wrapper @paginate generates for paginated
// fragments — node(id:) { ...Fragment @with(...) } — but without any list/pagination
// semantics. The generated query gets a refetch_meta row so the artifact picks up a
// "refetch" block with paginated: false.
func PrepareRefetchableDocuments(
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

	close := db.Transaction(conn)
	commit := func(err error) error {
		close(&err)
		return err
	}

	// find every fragment marked @refetchable that hasn't already been processed,
	// along with the query used to resolve its type by id (node by default) and the
	// key fields (with their types) needed to look it up.
	query, err := conn.Prepare(`
		SELECT
			documents.id,
			documents.name,
			documents.raw_document,
			documents.type_condition,
			COALESCE(type_configs.resolve_query, 'node') as resolve_query,
			CASE
				WHEN COUNT(tf.type) = 0 THEN NULL
				ELSE json_group_array(
					DISTINCT json_object('name', je.value, 'kind', tf.type)
				)
			END as resolve_keys
		FROM documents
			JOIN raw_documents on documents.raw_document = raw_documents.id
			JOIN document_directives on document_directives.document = documents.id
				AND document_directives.directive = $refetchable_directive
			LEFT JOIN type_configs on documents.type_condition = type_configs."name"
			JOIN config
			CROSS JOIN json_each(COALESCE(type_configs.keys, config.default_keys)) AS je
			LEFT JOIN type_fields tf
				ON tf.parent = documents.type_condition
				AND tf.name = je.value
			LEFT JOIN documents existing_operations ON existing_operations.name = documents.name || $refetch_suffix
		WHERE (raw_documents.current_task = $task_id OR $task_id IS NULL)
			AND documents.kind = 'fragment'
			AND existing_operations.id IS NULL
			AND (documents.processed = false OR documents.processed IS NULL)
		GROUP BY documents.id
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer query.Finalize()
	err = db.BindStatement(query, map[string]any{
		"refetchable_directive": graphql.RefetchableDirective,
		"refetch_suffix":        graphql.RefetchQuerySuffix,
	})
	if err != nil {
		return commit(plugins.WrapError(err))
	}

	// the @arguments declared on a fragment are stored as document_variables.
	getArguments, err := conn.Prepare(`
		SELECT "name", "type", type_modifiers, default_value
		FROM document_variables
		WHERE document = $document
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer getArguments.Finalize()

	// statements for building the generated query (mirrors paginationDocuments.go)
	insertDocument, err := conn.Prepare(`
		INSERT INTO documents (name, kind, raw_document, internal, visible) VALUES ($name, 'query', $raw_document, false, false)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertDocument.Finalize()
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
	insertSelectionArgument, err := conn.Prepare(`
		INSERT INTO selection_arguments (selection_id, "name", "value", row, column, field_argument, document) VALUES ($selection_id, $name, $value, 0, 0, $field_argument, $document)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertSelectionArgument.Finalize()
	insertArgumentValue, err := conn.Prepare(`
		INSERT INTO argument_values (kind, raw, expected_type, document, row, column) VALUES ($kind, $raw, $expected_type, $document, 0, 0)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertArgumentValue.Finalize()
	insertDocumentVariable, err := conn.Prepare(`
		INSERT INTO document_variables (document, "name", type, type_modifiers, default_value, row, column) VALUES ($document, $name, $type, $type_modifiers, $default_value, 0, 0)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertDocumentVariable.Finalize()
	insertSelectionDirective, err := conn.Prepare(`
		INSERT INTO selection_directives (selection_id, directive, row, column) VALUES ($selection, $directive, 0, 0)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertSelectionDirective.Finalize()
	insertSelectionDirectiveArgument, err := conn.Prepare(`
		INSERT INTO selection_directive_arguments (parent, name, value, document) VALUES ($parent, $name, $value, $document)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertSelectionDirectiveArgument.Finalize()
	copyArgumentValue, err := conn.Prepare(`
		INSERT INTO argument_values (kind, raw, row, column, expected_type, document)
		SELECT kind, raw, row, column, expected_type, $document
		FROM argument_values where id = $id
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer copyArgumentValue.Finalize()
	insertRefetchMeta, err := conn.Prepare(`
		INSERT INTO refetch_meta
			(document, selection, target_type)
		VALUES
			($document, $selection, $target_type)
	`)
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	defer insertRefetchMeta.Finalize()

	// collect the matching fragments first so we don't generate while iterating.
	fragments := []refetchableFragment{}
	errs := &plugins.ErrorList{}
	err = db.StepStatement(ctx, query, func() {
		frag := refetchableFragment{
			ID:            query.ColumnInt64(0),
			Name:          query.ColumnText(1),
			RawDocument:   query.ColumnInt(2),
			TypeCondition: query.ColumnText(3),
			ResolveQuery:  query.ColumnText(4),
		}

		if !query.IsNull("resolve_keys") {
			if err := json.Unmarshal([]byte(query.GetText("resolve_keys")), &frag.Keys); err != nil {
				errs.Append(plugins.WrapError(fmt.Errorf("failed to unmarshal refetchable keys: %v", err)))
				return
			}
		}

		fragments = append(fragments, frag)
	})
	if err != nil {
		return commit(plugins.WrapError(err))
	}
	if errs.Len() > 0 {
		return commit(errs)
	}

	for _, frag := range fragments {
		// gather the fragment's @arguments (stored as document variables)
		args := []refetchableArg{}
		err = db.BindStatement(getArguments, map[string]any{"document": frag.ID})
		if err != nil {
			return commit(plugins.WrapError(err))
		}
		err = db.StepStatement(ctx, getArguments, func() {
			arg := refetchableArg{
				Name:          getArguments.ColumnText(0),
				Type:          getArguments.ColumnText(1),
				TypeModifiers: getArguments.ColumnText(2),
			}
			if !getArguments.IsNull("default_value") {
				arg.DefaultValue = getArguments.ColumnInt64(3)
			}
			args = append(args, arg)
		})
		if err != nil {
			return commit(plugins.WrapError(err))
		}

		err = generateRefetchableQuery(ctx, db, conn, projectConfig, statementsForRefetch{
			insertDocument:                   insertDocument,
			insertSelection:                  insertSelection,
			insertSelectionRef:               insertSelectionRef,
			insertSelectionArgument:          insertSelectionArgument,
			insertArgumentValue:              insertArgumentValue,
			insertDocumentVariable:           insertDocumentVariable,
			insertSelectionDirective:         insertSelectionDirective,
			insertSelectionDirectiveArgument: insertSelectionDirectiveArgument,
			copyArgumentValue:                copyArgumentValue,
			insertRefetchMeta:                insertRefetchMeta,
		}, frag, args)
		if err != nil {
			errs.Append(plugins.WrapError(err))
			continue
		}
	}

	if errs.Len() > 0 {
		return commit(errs)
	}

	return commit(nil)
}

type statementsForRefetch struct {
	insertDocument                   plugins.Stmt
	insertSelection                  plugins.Stmt
	insertSelectionRef               plugins.Stmt
	insertSelectionArgument          plugins.Stmt
	insertArgumentValue              plugins.Stmt
	insertDocumentVariable           plugins.Stmt
	insertSelectionDirective         plugins.Stmt
	insertSelectionDirectiveArgument plugins.Stmt
	copyArgumentValue                plugins.Stmt
	insertRefetchMeta                plugins.Stmt
}

func generateRefetchableQuery(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	conn plugins.Conn,
	projectConfig plugins.ProjectConfig,
	stmts statementsForRefetch,
	frag refetchableFragment,
	args []refetchableArg,
) error {
	// create the query that embeds the fragment
	err := db.ExecStatement(stmts.insertDocument, map[string]any{
		"name":         graphql.FragmentRefetchQueryName(frag.Name),
		"raw_document": frag.RawDocument,
	})
	if err != nil {
		return err
	}
	queryDocumentID := conn.LastInsertRowID()

	// the resolve field that looks the entity up by id (node by default)
	err = db.ExecStatement(stmts.insertSelection, map[string]any{
		"field_name":    frag.ResolveQuery,
		"kind":          "field",
		"type":          fmt.Sprintf("Query.%s", frag.ResolveQuery),
		"fragment_args": nil,
	})
	if err != nil {
		return err
	}
	resolveSelectionID := conn.LastInsertRowID()

	err = db.ExecStatement(stmts.insertSelectionRef, map[string]any{
		"document": queryDocumentID,
		"child_id": resolveSelectionID,
		"internal": false,
	})
	if err != nil {
		return err
	}

	// spread the original fragment underneath the resolve field
	err = db.ExecStatement(stmts.insertSelection, map[string]any{
		"field_name":    frag.Name,
		"kind":          "fragment",
		"type":          "",
		"fragment_args": nil,
	})
	if err != nil {
		return err
	}
	fragmentSpreadID := conn.LastInsertRowID()

	err = db.ExecStatement(stmts.insertSelectionRef, map[string]any{
		"document":  queryDocumentID,
		"child_id":  fragmentSpreadID,
		"parent_id": resolveSelectionID,
		"internal":  true,
	})
	if err != nil {
		return err
	}

	// node() returns an interface and external fragment spreads are masked by
	// default; expose the fragment's fields through the wrapper.
	err = db.ExecStatement(stmts.insertSelectionDirective, map[string]any{
		"selection": fragmentSpreadID,
		"directive": graphql.DisableMaskDirective,
	})
	if err != nil {
		return err
	}

	// the resolve field's key arguments (id) become query variables
	for _, key := range frag.Keys {
		err = db.ExecStatement(stmts.insertArgumentValue, map[string]any{
			"kind":          "Variable",
			"raw":           key.Name,
			"expected_type": key.Kind,
			"document":      queryDocumentID,
		})
		if err != nil {
			return err
		}
		err = db.ExecStatement(stmts.insertSelectionArgument, map[string]any{
			"selection_id":   resolveSelectionID,
			"name":           key.Name,
			"value":          conn.LastInsertRowID(),
			"field_argument": fmt.Sprintf("Query.%s.%s", frag.ResolveQuery, key.Name),
			"document":       queryDocumentID,
		})
		if err != nil {
			return err
		}
		err = db.ExecStatement(stmts.insertDocumentVariable, map[string]any{
			"document":       queryDocumentID,
			"name":           key.Name,
			"type":           key.Kind,
			"type_modifiers": "!",
			"default_value":  nil,
		})
		if err != nil {
			return err
		}
	}

	// forward the fragment's @arguments via @with so they can be supplied at refetch time
	if len(args) > 0 {
		err = db.ExecStatement(stmts.insertSelectionDirective, map[string]any{
			"selection": fragmentSpreadID,
			"directive": graphql.WithDirective,
		})
		if err != nil {
			return err
		}
		withDirectiveID := conn.LastInsertRowID()

		for _, arg := range args {
			// the @with argument references a query variable of the same name
			err = db.ExecStatement(stmts.insertArgumentValue, map[string]any{
				"kind":          "Variable",
				"raw":           arg.Name,
				"expected_type": arg.Type,
				"document":      queryDocumentID,
			})
			if err != nil {
				return err
			}
			err = db.ExecStatement(stmts.insertSelectionDirectiveArgument, map[string]any{
				"parent":   withDirectiveID,
				"name":     arg.Name,
				"value":    conn.LastInsertRowID(),
				"document": queryDocumentID,
			})
			if err != nil {
				return err
			}

			// copy the @arguments default (if any) onto the query variable
			var defaultValue any
			if arg.DefaultValue != 0 {
				err = db.ExecStatement(stmts.copyArgumentValue, map[string]any{
					"id":       arg.DefaultValue,
					"document": queryDocumentID,
				})
				if err != nil {
					return err
				}
				defaultValue = conn.LastInsertRowID()
			}

			err = db.ExecStatement(stmts.insertDocumentVariable, map[string]any{
				"document":       queryDocumentID,
				"name":           arg.Name,
				"type":           arg.Type,
				"type_modifiers": arg.TypeModifiers,
				"default_value":  defaultValue,
			})
			if err != nil {
				return err
			}
		}
	}

	// the target type used to resolve the entity: "Node" via node(id:) by default,
	// or the fragment's type when it has a custom resolve query configured.
	targetType := "Node"
	if typeConfig, exists := projectConfig.TypeConfig[frag.TypeCondition]; exists &&
		typeConfig.ResolveQuery != "" {
		targetType = frag.TypeCondition
	}

	// record a refetch_meta row for the generated query so the artifact emits a
	// "refetch" block (paginated: false). this is the list-less analog of a
	// discovered_lists row — it carries refetch metadata only, keyed by the
	// node(id:)/resolve selection the block attaches to.
	err = db.ExecStatement(stmts.insertRefetchMeta, map[string]any{
		"document":    queryDocumentID,
		"selection":   resolveSelectionID,
		"target_type": targetType,
	})
	if err != nil {
		return err
	}

	return nil
}
