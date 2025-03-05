package lists

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"code.houdinigraphql.com/packages/houdini-core/plugin/schema"
	"code.houdinigraphql.com/plugins"
	"zombiezen.com/go/sqlite"
)

func ValidateConflictingPrependAppend[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	query := `
	SELECT
	  rd.filepath,
	  rd.offset_line AS row,
	  rd.offset_column AS column,
	  d.name AS documentName,
	  GROUP_CONCAT(DISTINCT sd.directive) AS directives
	FROM selection_directives sd
	  JOIN selection_refs sr ON sr.child_id = sd.selection_id
	  JOIN documents d ON d.id = sr.document
	  JOIN raw_documents rd ON rd.id = d.raw_document
	WHERE sd.directive IN ($prepend, $append)
		AND (rd.current_task = $task_id OR $task_id IS NULL)
	GROUP BY sd.selection_id, rd.filepath, rd.offset_line, rd.offset_column, d.name
	HAVING COUNT(DISTINCT sd.directive) > 1
	`
	bindings := map[string]interface{}{
		"prepend": schema.PrependDirective,
		"append":  schema.AppendDirective,
	}
	err := db.StepQuery(ctx, query, bindings, func(stmt *sqlite.Stmt) {
		filepath := stmt.ColumnText(0)
		row := int(stmt.ColumnInt(1))
		column := int(stmt.ColumnInt(2))
		documentName := stmt.ColumnText(3)
		directives := stmt.ColumnText(4)
		errs.Append(&plugins.Error{
			Message: fmt.Sprintf("@prepend and @append cannot appear on the same fragment in document %q (found: %s)", documentName, directives),
			Kind:    plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{
				{Filepath: filepath, Line: row, Column: column},
			},
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateConflictingParentIDAllLists[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	query := `
		SELECT
			rd.filepath,
			rd.offset_line AS row,
			rd.offset_column AS column,
			d.name AS documentName,
			GROUP_CONCAT(DISTINCT sd.directive) AS directives
		FROM selection_directives sd
			JOIN selection_refs sr ON sr.child_id = sd.selection_id
			JOIN documents d ON d.id = sr.document
			JOIN raw_documents rd ON rd.id = d.raw_document
		WHERE sd.directive IN ($parentID, $allLists)
			AND (rd.current_task = $task_id OR $task_id IS NULL)
		GROUP BY sd.selection_id, rd.filepath, rd.offset_line, rd.offset_column, d.name
		HAVING COUNT(DISTINCT sd.directive) > 1
	`
	bindings := map[string]interface{}{
		"parentID": schema.ParentIDDirective,
		"allLists": schema.AllListsDirective,
	}
	err := db.StepQuery(ctx, query, bindings, func(stmt *sqlite.Stmt) {
		filepath := stmt.ColumnText(0)
		row := int(stmt.ColumnInt(1))
		column := int(stmt.ColumnInt(2))
		documentName := stmt.ColumnText(3)
		directives := stmt.ColumnText(4)
		errs.Append(&plugins.Error{
			Message: fmt.Sprintf("@parentID cannot appear alongside @allLists in document %q (found: %s)", documentName, directives),
			Kind:    plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{
				{Filepath: filepath, Line: row, Column: column},
			},
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func validateConflictingPaginateListDirectives[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	query := `
		SELECT
			rd.filepath,
			rd.offset_line AS row,
			rd.offset_column AS column
		FROM selection_directives sd
			JOIN selection_refs sr ON sr.child_id = sd.selection_id
			JOIN documents d ON d.id = sr.document
			JOIN raw_documents rd ON rd.id = d.raw_document
		WHERE sd.directive IN ($list_directive, $paginate_directive)
			AND (rd.current_task = $task_id OR $task_id IS NULL)
		GROUP BY sd.selection_id, rd.filepath, rd.offset_line, rd.offset_column, d.name
		HAVING COUNT(DISTINCT sd.directive) > 1
	`
	bindings := map[string]interface{}{
		"list_directive":     schema.ListDirective,
		"paginate_directive": schema.PaginationDirective,
	}
	err := db.StepQuery(ctx, query, bindings, func(stmt *sqlite.Stmt) {
		filepath := stmt.ColumnText(0)
		row := int(stmt.ColumnInt(1))
		column := int(stmt.ColumnInt(2))
		errs.Append(&plugins.Error{
			Message: fmt.Sprintf("@list is unnecessary on a field annotated with @paginate, simply use the 'name' parameter on @paginate instead"),
			Kind:    plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{
				{Filepath: filepath, Line: row, Column: column},
			},
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidatePaginateTypeCondition[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	// This query returns documents that use @paginate (via selection_directives)
	// and that have a non-empty type_condition, but that are invalid—
	// meaning the type condition neither implements Node nor has a valid resolve_query.
	query := `
		SELECT DISTINCT
			d.name AS documentName,
			d.type_condition,
			rd.filepath,
			sd.row,
			sd.column
		FROM documents d
			JOIN raw_documents rd ON rd.id = d.raw_document
			JOIN selection_refs sr ON sr.document = d.id
			JOIN selection_directives sd ON sd.selection_id = sr.child_id
			LEFT JOIN possible_types pt ON pt.type = 'Node' AND d.type_condition = pt.member
			LEFT JOIN type_configs tc ON tc.resolve_query IS NOT NULL AND d.type_condition = tc.name
		WHERE d.kind = 'fragment'
			AND sd.directive = $paginate_directive
			AND pt.member IS NULL
			AND tc.name IS NULL
			AND (rd.current_task = $task_id OR $task_id IS NULL)
	`
	bindings := map[string]interface{}{
		"paginate_directive": schema.PaginationDirective,
	}
	err := db.StepQuery(ctx, query, bindings, func(stmt *sqlite.Stmt) {
		docName := stmt.ColumnText(0)
		typeCondition := stmt.ColumnText(1)
		filepath := stmt.ColumnText(2)
		row := int(stmt.ColumnInt(3))
		column := int(stmt.ColumnInt(4))

		errs.Append(&plugins.Error{
			Message: fmt.Sprintf("Document %q uses @%s but its type condition %q is invalid. It must either implement Node or have a type_configs entry with a valid resolve_query", docName, schema.PaginationDirective, typeCondition),
			Kind:    plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{
				{Filepath: filepath, Line: row, Column: column},
			},
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateSinglePaginateDirective[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	// This query retrieves every usage of the paginate directive along with document and location info.
	query := `
	SELECT
	  d.id AS documentID,
	  d.name AS documentName,
	  rd.filepath,
	  rd.offset_line AS row,
	  rd.offset_column AS column
	FROM selection_directives sd
	  JOIN selection_refs sr ON sr.child_id = sd.selection_id
	  JOIN documents d ON d.id = sr.document
	  JOIN raw_documents rd ON rd.id = d.raw_document
	WHERE sd.directive = $paginate_directive
		AND (rd.current_task = $task_id OR $task_id IS NULL)
	`
	bindings := map[string]interface{}{
		"paginate_directive": schema.PaginationDirective,
	}
	// We'll group usages in memory by documentID.
	type usage struct {
		documentID   int64
		documentName string
		filepath     string
		row          int
		column       int
	}
	groups := make(map[int64][]usage)

	// Iterate over all rows.
	db.StepQuery(ctx, query, bindings, func(stmt *sqlite.Stmt) {
		uid := stmt.ColumnInt64(0)
		u := usage{
			documentID:   uid,
			documentName: stmt.ColumnText(1),
			filepath:     stmt.ColumnText(2),
			row:          int(stmt.ColumnInt(3)),
			column:       int(stmt.ColumnInt(4)),
		}
		groups[uid] = append(groups[uid], u)
	})

	// Now, for each document that has more than one paginate directive, report an error.
	for _, usages := range groups {
		if len(usages) > 1 {
			// Build a list of location strings.
			var locStrs []string
			for _, u := range usages {
				locStrs = append(locStrs, fmt.Sprintf("%s:%d:%d", u.filepath, u.row, u.column))
			}
			// Use the document name from the first
			docName := usages[0].documentName
			errs.Append(&plugins.Error{
				Message: fmt.Sprintf("@%s can only appear once in a document; found %d occurrences in document %q at locations: %s", schema.PaginationDirective, len(usages), docName, strings.Join(locStrs, "; ")),
				Kind:    plugins.ErrorKindValidation,
			})
		}
	}
}

// we have a few things that we need to validate about lists and along the way confirm that we don't have any unknown directives or fragments
//   - name must be a static argument (it can't be a variable)
//   - the same name can't be used more than once globally
//   - if we run into a list operation we need to confirm that if it requires a @parentID by looking up until the root of the document for a list.
//     if we run into a list, then there needs to be a parent id
//   - targets with @paginate must have a valid key (either the default keys apply or there is a custom entry in the type_configs table)
//   - every fragment spread needs to reference a document with kind = fragment or end in one of the operation prefixes
//   - every directive must be known or reference a delete operation

func ValidateParentID[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	projectConfig, err := db.ProjectConfig(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}

	// if the default target is allLists, we dont need to verify anything
	if projectConfig.DefaultListTarget == "all" {
		return
	}

	// we need the name argument of every instance of @paginate whose parent is a list at some point in the chain
	// to do this, we'll build a recursive query that starts at pagination directives joined with the table
	// with directive_argments filtered for the name argument and keep walking until we see a parent whose type modifiers include ]
	query := `
		-- Build up a list of parents that require a parentID
		WITH RECURSIVE pagination_parents AS (
			-- Base case: start with depth 1 and initialize a path for cycle detection
			SELECT
				s.id,
				0 AS has_match,
				argument_values.raw AS list_name,
				1 AS depth,
				',' || s.id || ',' AS path
			FROM selection_directives sd
				JOIN selections s ON sd.selection_id = s.id
				JOIN selection_refs sr ON s.id = sr.child_id
				JOIN documents doc ON sr.document = doc.id
				JOIN selection_directive_arguments da ON sd.id = da.parent
				JOIN argument_values ON da.value = argument_values.id
			WHERE sd.directive IN ($paginate_directive , $list_directive)
				AND da.name = 'name'
				AND doc.kind = 'query'

			UNION ALL

			-- Recursive step: only continue if depth is less than 2 and no cycles occur
			SELECT
				p.id,
				CASE WHEN tf.type_modifiers LIKE '%]%' THEN 1 ELSE 0 END AS has_match,
				sh.list_name,
				sh.depth + 1,
				sh.path || p.id || ','
			FROM pagination_parents sh
				JOIN selection_refs sr ON sr.child_id = sh.id
				JOIN selections p ON p.id = sr.parent_id
				JOIN type_fields tf ON p.type = tf.id
			WHERE sh.has_match = 0
				AND sh.depth < 2    -- Ensures that recursion stops once depth reaches 2
				AND instr(sh.path, ',' || p.id || ',') = 0   -- Prevents cycles
			),

		-- There are 2 categories of fragment spreads that require a parentID:
		--    - if the operation is in a query document contained within a field
		--    - if the operation is in a fragment definition
		constrained_lists AS (
			-- Get the first parent where the match is found
			SELECT list_name
				FROM pagination_parents
				WHERE has_match = 1

			UNION

			-- look for list operations in fragments
			SELECT
				argument_values.raw AS list_name
			FROM selection_directives sd
				JOIN selections s ON sd.selection_id = s.id
				JOIN selection_refs sr ON s.id = sr.child_id
				JOIN documents doc ON sr.document = doc.id
				JOIN selection_directive_arguments da ON sd.id = da.parent
				JOIN argument_values ON da.value = argument_values.id
			WHERE sd.directive IN ($paginate_directive , $list_directive)
				AND da.name = 'name'
				AND doc.kind = 'fragment'
		),

		-- Define a table of acceptable suffixes
		suffixes(sfx) AS (
			VALUES ($insert_prefix), ($toggle_prefix), ($remove_prefix)
		),

		-- precompute the list of operation names that could refer to a constrainted list
		operation_names AS (
			SELECT
				mp.list_name,
				mp.list_name || s.sfx AS expected_field_name
			FROM constrained_lists mp
			CROSS JOIN suffixes s
		)

		-- Find all fragment spreads that refer to a list operation on a constrained list and don't have a target directive
		SELECT DISTINCT
			o_names.list_name,
			sr.row,
			sr.column,
			rd.filepath
		FROM operation_names o_names
			JOIN selections f ON f.field_name = o_names.expected_field_name
			JOIN selection_refs sr ON sr.child_id = f.id
			JOIN documents d ON sr.document = d.id
			JOIN raw_documents rd ON d.raw_document = rd.id
			LEFT JOIN selection_directives sd2 ON sd2.selection_id = f.id AND sd2.directive in ($parentID_directive, $allLists_directive)
		WHERE f.kind = 'fragment'
			AND (rd.current_task = $task_id OR $task_id IS NULL)
		AND sd2.id IS NULL
	`
	bindings := map[string]interface{}{
		"paginate_directive": schema.PaginationDirective,
		"list_directive":     schema.ListDirective,
		"insert_prefix":      schema.ListOperationSuffixInsert,
		"toggle_prefix":      schema.ListOperationSuffixToggle,
		"remove_prefix":      schema.ListOperationSuffixRemove,
		"parentID_directive": schema.ParentIDDirective,
		"allLists_directive": schema.AllListsDirective,
	}

	// every result is a list that requires a parent id but doesn't have one
	err = db.StepQuery(ctx, query, bindings, func(stmt *sqlite.Stmt) {
		errs.Append(&plugins.Error{
			Message: fmt.Sprintf("operations on %q requires a parentID", stmt.ColumnText(0)),
			Kind:    plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{
				{
					Filepath: stmt.ColumnText(3),
					Line:     int(stmt.ColumnInt(1)),
					Column:   int(stmt.ColumnInt(2)),
				},
			},
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func DiscoverListsThenValidate[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	// if paginate and list appear on the same node then it will produce a confusing error message so let's check that first
	validateConflictingPaginateListDirectives(ctx, db, errs)
	if errs.Len() > 0 {
		return
	}

	// the first thing we need to do is get a list of all the operations by looking at the name arguments of @list and @paginate
	// directives
	query := `
		WITH list_names AS (
			SELECT
				argument_values.raw AS list_name,
				selection_directives.row,
				selection_directives.column,
				raw_documents.id as raw_document,
				selections.id AS selection_id,
				selection_directives.directive as directive
			FROM selection_directives
				JOIN selections ON selection_directives.selection_id = selections.id
				JOIN selection_refs ON selections.id = selection_refs.child_id
				JOIN documents ON selection_refs.document = documents.id
				JOIN raw_documents ON documents.raw_document = raw_documents.id
				LEFT JOIN selection_directive_arguments
					ON selection_directives.id = selection_directive_arguments.parent
					AND selection_directive_arguments.name = 'name'
				LEFT JOIN argument_values ON selection_directive_arguments.value = argument_values.id
			WHERE selection_directives.directive in ($paginate_directive, $list_directive)
				AND (raw_documents.current_task = $task_id OR $task_id IS NULL)
		),
		base AS (
			-- Get the declared type (and its type_modifiers) for the original selection.
			SELECT
				ln.*,
				s.type AS base_type,
				tf.type_modifiers,
				tf.type AS base_list_type,
				ln.raw_document,
				ln.directive as directive
			FROM list_names ln
			JOIN selections s ON ln.selection_id = s.id
			JOIN type_fields tf ON s.type = tf.id
		),
		edges AS (
			-- If the base type is not already a list (i.e. no ']' in type_modifiers),
			-- then find the child selection with field_name = 'edges'.
			SELECT
				b.selection_id,
				s_edges.id AS edges_id,
				b.raw_document
			FROM base b
			JOIN selection_refs sr ON sr.parent_id = b.selection_id
			JOIN selections s_edges ON s_edges.id = sr.child_id
			WHERE s_edges.field_name = 'edges' AND b.type_modifiers NOT LIKE '%]%'
		),
		-- From the "edges" selection, find the child selection with field_name = 'node'
		-- and join to type_fields to get its type.
		node AS (
			SELECT
				e.selection_id,
				s_node.id AS node_id,
				tf_node.type AS node_list_type,
				e.raw_document
			FROM edges e
			JOIN selection_refs sr2 ON sr2.parent_id = e.edges_id
			JOIN selections s_node ON s_node.id = sr2.child_id
			JOIN type_fields tf_node ON s_node.type = tf_node.id
			WHERE s_node.field_name = 'node'
		)
		SELECT
			b.list_name,
			b.row,
			b.column,
			b.raw_document,
			CASE
				WHEN b.type_modifiers LIKE '%]%' THEN b.base_list_type
				ELSE n.node_list_type
			END AS final_list_type,
			CASE
				WHEN b.type_modifiers LIKE '%]%' THEN b.selection_id
				ELSE n.node_id
			END as node_id,
			CASE
				WHEN b.type_modifiers LIKE '%]%' THEN b.raw_document
				ELSE n.raw_document
			END as raw_document,
			b.type_modifiers NOT LIKE '%]%' as connection,
			b.selection_id,
			b.directive
		FROM base b
			LEFT JOIN node n ON b.selection_id = n.selection_id
	`
	bindings := map[string]interface{}{
		"list_directive":     schema.ListDirective,
		"paginate_directive": schema.PaginationDirective,
	}

	// as we step through the results we'll need to keep track of operation names
	// we've already seen so we can identify duplicates
	type DiscoveredList struct {
		ListName    string
		SelectionID int
		ListField   int
		RawDocument int
		Type        string
		Locations   []*plugins.ErrorLocation
		Connection  bool
		Paginate    bool
	}
	lists := map[int]*DiscoveredList{}

	// iterate over the results
	err := db.StepQuery(ctx, query, bindings, func(nameStatement *sqlite.Stmt) {
		listName := nameStatement.ColumnText(0)
		row := nameStatement.ColumnInt(1)
		column := nameStatement.ColumnInt(2)
		filepath := nameStatement.ColumnText(3)
		finalType := nameStatement.ColumnText(4)
		selectionID := nameStatement.ColumnInt(5)
		rawDocument := nameStatement.ColumnInt(6)
		connection := nameStatement.ColumnBool(7)
		listField := nameStatement.ColumnInt(8)
		directive := nameStatement.ColumnText(9)

		// if we haven't seen the name before, create a new entry
		if _, ok := lists[listField]; !ok {
			lists[listField] = &DiscoveredList{
				ListName:    listName,
				SelectionID: selectionID,
				RawDocument: rawDocument,
				Type:        finalType,
				Locations:   []*plugins.ErrorLocation{},
				Connection:  connection,
				ListField:   listField,
				Paginate:    directive == schema.PaginationDirective,
			}
		}

		// add the location to the list of locations
		lists[listField].Locations = append(lists[listField].Locations, &plugins.ErrorLocation{
			Line:     row,
			Column:   column,
			Filepath: filepath,
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}

	conn, err := db.Take(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}

	// we need to store the set of discovered lists into the database for 2 reasons:
	// - we'll consider them when validating directive and fragment spreads
	// - we'll use them to insert the operation schema items
	insertDiscoveredLists, err := conn.Prepare(`
		INSERT INTO discovered_lists (name, type, node, raw_document, connection, list_field, paginate) VALUES ($name, $type, $node, $raw_document, $connection, $list_field, $paginate)
	`)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer insertDiscoveredLists.Finalize()

	// loop over every name we found and insert the discovered list into the database
	for _, list := range lists {
		// if we saw the name more than once, we need to report an error
		if len(list.Locations) > 1 {
			errs.Append(&plugins.Error{
				Message:   fmt.Sprintf("encountered duplicate operation name %s", list.ListName),
				Locations: list.Locations,
				Kind:      plugins.ErrorKindValidation,
			})
			continue
		}

		// if the list type doesn't exist then its an invalid placement of a list directive
		if list.Type == "" || list.SelectionID == 0 {
			errs.Append(&plugins.Error{
				Message:   invalidConnectinErr,
				Locations: list.Locations,
				Kind:      plugins.ErrorKindValidation,
			})
			continue
		}

		// insert the discovered list into the database
		err = db.ExecStatement(insertDiscoveredLists, map[string]interface{}{
			"name":         list.ListName,
			"type":         list.Type,
			"node":         list.SelectionID,
			"raw_document": list.RawDocument,
			"connection":   list.Connection,
			"list_field":   list.ListField,
		})
		if err != nil {
			errs.Append(plugins.WrapError(err))
			return
		}
	}

	// there's still more to do but we'll parallelize the next steps so we're done with the connectionf
	db.Put(conn)

	// now that we have recorded the discovered lists we can build up the full set of directives and fragments
	// that we need to validate
	var wg sync.WaitGroup
	wg.Add(3)
	go func() {
		validateDirectives(ctx, db, errs)
		wg.Done()
	}()
	go func() {
		validateFragmentSpreads(ctx, db, errs)
		wg.Done()
	}()
	go func() {
		validatePaginateArgs(ctx, db, errs)
		wg.Done()
	}()
	wg.Wait()
}

var invalidConnectinErr = fmt.Sprintf(`Looks like you are trying to use the "%s" directive on a field but your field does not conform to the connection spec:
your edge type does not have node as a field. For more information, visit this link: ${siteURL}/guides/pagination`, schema.PaginationDirective)

func validateDirectives[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	// we need a query that looks for references to directives in selection that don't exist in the database
	selectionSearch := `
		WITH discovered_directives AS (
			SELECT
				type || $delete_prefix AS key
			FROM discovered_lists
		)
		SELECT
			sd.directive,
			rd.filepath,
			sd.row,
			sd.column
		FROM selection_directives sd
			JOIN selections s ON s.id = sd.selection_id
			JOIN selection_refs sr ON sr.child_id = s.id
			JOIN documents d ON d.id = sr.document
			JOIN raw_documents rd ON rd.id = d.raw_document
			LEFT JOIN directives dir ON sd.directive = dir.name
			LEFT JOIN discovered_directives dl ON sd.directive = dl.key
		WHERE dir.name IS NULL AND dl.key IS NULL
			AND (rd.current_task = $task_id OR $task_id IS NULL)

		UNION ALL

		SELECT
			dd.directive,
			rd.filepath,
			dd.row,
			dd.column
		FROM document_directives dd
			JOIN documents d ON d.id = dd.document
			JOIN raw_documents rd ON rd.id = d.raw_document
			LEFT JOIN directives dir ON dd.directive = dir.name
			LEFT JOIN discovered_directives dl ON dd.directive = dl.key
		WHERE dir.name IS NULL AND dl.key IS NULL
			AND (rd.current_task = $task_id OR $task_id IS NULL)
	`
	bindings := map[string]interface{}{
		"delete_prefix": schema.ListOperationSuffixDelete,
	}
	err := db.StepQuery(ctx, selectionSearch, bindings, func(stmt *sqlite.Stmt) {
		errs.Append(&plugins.Error{
			Message: fmt.Sprintf("Unknown directive %q", stmt.ColumnText(0)),
			Kind:    plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{
				{
					Filepath: stmt.ColumnText(1),
					Line:     int(stmt.ColumnInt(2)),
					Column:   int(stmt.ColumnInt(3)),
				},
			},
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
}

func validateFragmentSpreads[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	// we need a query that looks for references to fragments in selection that don't exist in the database
	query := `
		WITH suffixes(sfx) AS (
			VALUES ($insert_prefix), ($remove_prefix), ($toggle_prefix)
		),
		discovered_fragments AS (
			SELECT
				dl.name || s.sfx AS computed_key
			FROM discovered_lists dl
			CROSS JOIN suffixes s
		)
		SELECT
			s.field_name,
			rd.filepath,
			sr.row,
			sr.column
		FROM selections s
			JOIN selection_refs sr ON sr.child_id = s.id
			JOIN documents d ON d.id = sr.document
			JOIN raw_documents rd ON rd.id = d.raw_document
			LEFT JOIN documents docs ON s.field_name = docs.name AND docs.kind = 'fragment'
			LEFT JOIN discovered_fragments df ON s.field_name = df.computed_key
		WHERE s.kind = 'fragment'
			AND docs.name IS NULL
			AND df.computed_key IS NULL
			AND (rd.current_task = $task_id OR $task_id IS NULL)
	`
	bindings := map[string]interface{}{
		"insert_prefix": schema.ListOperationSuffixInsert,
		"remove_prefix": schema.ListOperationSuffixRemove,
		"toggle_prefix": schema.ListOperationSuffixToggle,
	}

	err := db.StepQuery(ctx, query, bindings, func(stmt *sqlite.Stmt) {
		errs.Append(&plugins.Error{
			Message: fmt.Sprintf("Unknown fragment spread %q", stmt.ColumnText(0)),
			Kind:    plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{
				{
					Filepath: stmt.ColumnText(1),
					Line:     int(stmt.ColumnInt(2)),
					Column:   int(stmt.ColumnInt(3)),
				},
			},
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
}

func validatePaginateArgs[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	conn, err := db.Take(ctx)
	defer db.Put(conn)

	// This query retrieves paginate usage info plus field definitions
	usageQuery, err := conn.Prepare(`
		SELECT
			s.alias,
			d.name,
			rd.filepath,
			sr.row,
			sr.column,
			GROUP_CONCAT(DISTINCT sa.name) AS appliedArgs,
			argument_values.raw as paginateMode,
			GROUP_CONCAT(DISTINCT field_args.name || ':' || field_args.type) AS fieldArgDefs,
			discovered_lists.name,
			selection_directives.directive,
			type_fields.type_modifiers,
			discovered_lists.id
		FROM discovered_lists
			JOIN selections s ON discovered_lists.list_field = s.id
			JOIN selection_refs sr ON sr.child_id = s.id
			JOIN documents d ON d.id = sr.document
			JOIN raw_documents rd ON rd.id = d.raw_document
			JOIN selection_directives
				ON s.id = selection_directives.selection_id
				AND selection_directives.directive in ($paginate_directive, $list_directive)
			LEFT JOIN selection_directive_arguments
				ON selection_directive_arguments.parent = selection_directives.id
				AND selection_directive_arguments.name = $paginate_mode_arg
			LEFT JOIN argument_values ON selection_directive_arguments.value = argument_values.id
			LEFT JOIN selection_arguments sa ON sa.selection_id = s.id
			LEFT JOIN selections parent_ref ON parent_ref.id = sr.parent_id
			LEFT JOIN type_fields ON type_fields.id = parent_ref.type
			LEFT JOIN type_field_arguments field_args ON field_args.field = s.type
		GROUP BY discovered_lists.id
	`)
	db.BindStatement(usageQuery, map[string]interface{}{
		"paginate_mode_arg":  "mode",
		"paginate_directive": schema.PaginationDirective,
		"list_directive":     schema.ListDirective,
	})
	defer usageQuery.Finalize()

	// if we discover a connection-based pagination we should update the discovered list with the direction
	updateList, err := conn.Prepare(`
		UPDATE discovered_lists SET paginate = $paginate WHERE id = $id
	`)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer updateList.Finalize()

	// For each usage, parse the aggregated field definitions into a map.
	// The format is "argName1:type1,argName2:type2,..."
	parseFieldArgs := func(defs string) map[string]string {
		m := make(map[string]string)
		if defs == "" {
			return m
		}
		pairs := strings.Split(defs, ",")
		for _, pair := range pairs {
			parts := strings.Split(pair, ":")
			if len(parts) == 2 {
				m[parts[0]] = parts[1]
			}
		}
		return m
	}

	seenNames := map[string]bool{}

	db.StepStatement(ctx, usageQuery, func() {
		fieldName := usageQuery.ColumnText(0)
		documentName := usageQuery.ColumnText(1)
		filepath := usageQuery.ColumnText(2)
		row := usageQuery.ColumnInt(3)
		column := usageQuery.ColumnInt(4)
		appliedArgs := usageQuery.ColumnText(5)
		fieldArgDefs := usageQuery.ColumnText(7)
		listName := usageQuery.ColumnText(8)
		directive := usageQuery.ColumnText(9)
		typeModifiers := usageQuery.ColumnText(10)
		listID := usageQuery.ColumnInt(11)

		// Ensure that the list name is unique.
		if _, ok := seenNames[listName]; listName != "" && ok {
			errs.Append(&plugins.Error{
				Message: fmt.Sprintf("List %q is defined more than once", listName),
				Kind:    plugins.ErrorKindValidation,
				Locations: []*plugins.ErrorLocation{
					{Filepath: filepath, Line: row, Column: column},
				},
			})

			// we're done processing this entry
			return
		}

		seenNames[listName] = true

		// if we're not looking at a paginated list, we're done here (we just need to confirm the name isn't a duplicate)
		if directive != schema.PaginationDirective {
			return
		}

		// @paginate can't fall under a list
		if strings.Contains(typeModifiers, "]") {
			errs.Append(&plugins.Error{
				Message: "Paginated fields cannot be inside of lists. Please move this field into a fragment",
				Kind:    plugins.ErrorKindValidation,
				Locations: []*plugins.ErrorLocation{
					{Filepath: filepath, Line: row, Column: column},
				},
			})

			return

		}

		// parse the field definitions.
		fieldArgs := parseFieldArgs(fieldArgDefs)
		forwardPagination := (fieldArgs["first"] == "Int" && fieldArgs["after"] == "String")
		backwardsPagination := (fieldArgs["last"] == "Int" && fieldArgs["before"] == "String")
		cursorPagination := forwardPagination || backwardsPagination
		offsetPagination := (fieldArgs["offset"] == "Int" && fieldArgs["limit"] == "Int")

		// build a set of applied argument names.
		appliedSet := make(map[string]bool)
		if appliedArgs != "" {
			for _, arg := range strings.Split(appliedArgs, ",") {
				appliedSet[strings.TrimSpace(arg)] = true
			}
		}

		_, forwardApplied := appliedSet["first"]
		_, backwardsApplied := appliedSet["last"]

		// validate based on supported pagination mode.
		if cursorPagination {
			if !forwardApplied && !backwardsApplied {
				errs.Append(&plugins.Error{
					Message: fmt.Sprintf("Field %q in document %q with cursor-based pagination must have either a 'first' or a 'last' argument", fieldName, documentName),
					Kind:    plugins.ErrorKindValidation,
					Locations: []*plugins.ErrorLocation{
						{Filepath: filepath, Line: row, Column: column},
					},
				})
			}
			if forwardApplied && backwardsApplied {
				errs.Append(&plugins.Error{
					Message: fmt.Sprintf("Field %q in document %q with cursor-based pagination cannot have both 'first' and 'last' arguments in Infinite mode", fieldName, documentName),
					Kind:    plugins.ErrorKindValidation,
					Locations: []*plugins.ErrorLocation{
						{Filepath: filepath, Line: row, Column: column},
					},
				})
			}
		} else if offsetPagination {
			if !appliedSet["limit"] {
				errs.Append(&plugins.Error{
					Message: fmt.Sprintf("Field %q in document %q with offset-based pagination must have an 'limit' argument", fieldName, documentName),
					Kind:    plugins.ErrorKindValidation,
					Locations: []*plugins.ErrorLocation{
						{Filepath: filepath, Line: row, Column: column},
					},
				})
			}
		} else {
			errs.Append(&plugins.Error{
				Message: fmt.Sprintf("Field %q in document %q does not support a valid pagination mode (cursor-based or offset-based)", fieldName, documentName),
				Kind:    plugins.ErrorKindValidation,
				Locations: []*plugins.ErrorLocation{
					{Filepath: filepath, Line: row, Column: column},
				},
			})
		}

		if cursorPagination {
			var direction string
			switch {
			case forwardApplied:
				direction = "forward"
			case backwardsApplied:
				direction = "backward"
			}

			err = db.ExecStatement(updateList, map[string]interface{}{
				"id":       listID,
				"paginate": direction,
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
			}
		}
	})
}
