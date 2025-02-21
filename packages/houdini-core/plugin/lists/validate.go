package lists

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"code.houdinigraphql.com/packages/houdini-core/plugin/schema"
	"code.houdinigraphql.com/plugins"
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
	WHERE sd.directive IN ('prepend', 'append')
	GROUP BY sd.selection_id, rd.filepath, rd.offset_line, rd.offset_column, d.name
	HAVING COUNT(DISTINCT sd.directive) > 1
	`

	conn, err := db.Take(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer db.Put(conn)

	stmt, err := conn.Prepare(query)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer stmt.Finalize()

	err = db.StepStatement(ctx, stmt, func() {
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
	WHERE sd.directive IN ('parentID', 'allLists')
	GROUP BY sd.selection_id, rd.filepath, rd.offset_line, rd.offset_column, d.name
	HAVING COUNT(DISTINCT sd.directive) > 1
	`

	conn, err := db.Take(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer db.Put(conn)

	stmt, err := conn.Prepare(query)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer stmt.Finalize()

	err = db.StepStatement(ctx, stmt, func() {
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

func ValidatePaginateArgs[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	// Load project configuration.
	config, err := db.ProjectConfig(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defaultPaginateMode := config.DefaultPaginateMode // e.g., "Infinite"
	// We assume the paginate mode argument is named "mode".
	paginateModeArgName := "mode"
	paginateDirective := schema.PaginationDirective

	// This query retrieves paginate usage info plus field definitions (aggregated) without a subquery.
	usageQuery := `
	SELECT
	  s.id AS selectionID,
	  s.field_name,
	  s.type AS fieldTypeID,
	  d.id AS documentID,
	  d.name AS documentName,
	  rd.filepath,
	  rd.offset_line AS row,
	  rd.offset_column AS column,
	  GROUP_CONCAT(DISTINCT sa.name) AS appliedArgs,
	  MAX(av.raw) AS modeArg,
	  ptf.type_modifiers AS parentModifiers,
	  GROUP_CONCAT(DISTINCT fd.name || ':' || fd.type) AS fieldArgDefs
	FROM selection_directives sd
	  JOIN selections s ON s.id = sd.selection_id
	  JOIN selection_refs sr ON sr.child_id = s.id
	  JOIN documents d ON d.id = sr.document
	  JOIN raw_documents rd ON rd.id = d.raw_document
	  LEFT JOIN selection_arguments sa ON sa.selection_id = s.id
	  LEFT JOIN selection_directive_arguments sda ON sda.parent = sd.id AND sda.name = ?
	  LEFT JOIN argument_values av ON av.id = sda.value
	  LEFT JOIN selections sp ON sp.id = sr.parent_id
	  LEFT JOIN type_fields ptf ON ptf.id = sp.type
	  LEFT JOIN field_argument_definitions fd ON fd.field = s.type
	WHERE sd.directive = ?
	GROUP BY s.id, s.field_name, s.type, d.id, d.name, rd.filepath, rd.offset_line, rd.offset_column, sd.id, ptf.type_modifiers
	`

	conn, err := db.Take(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer db.Put(conn)

	stmt, err := conn.Prepare(usageQuery)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer stmt.Finalize()

	// Bind parameters: first the mode argument name, then the paginate directive.
	stmt.BindText(1, paginateModeArgName)
	stmt.BindText(2, paginateDirective)

	type usageRecord struct {
		selectionID     int64
		fieldName       string
		fieldTypeID     string
		documentID      int64
		documentName    string
		filepath        string
		row             int
		column          int
		appliedArgs     string // comma-separated list (may be empty)
		modeArg         string // from argument_values.raw; should be a non-numeric string if provided
		parentModifiers string // parent's type modifiers
		fieldArgDefs    string // aggregated "argName:argType" pairs
	}
	var usages []usageRecord
	for {
		hasData, err := stmt.Step()
		if err != nil {
			errs.Append(plugins.WrapError(err))
			return
		}
		if !hasData {
			break
		}
		usages = append(usages, usageRecord{
			selectionID:     stmt.ColumnInt64(0),
			fieldName:       stmt.ColumnText(1),
			fieldTypeID:     stmt.ColumnText(2),
			documentID:      stmt.ColumnInt64(3),
			documentName:    stmt.ColumnText(4),
			filepath:        stmt.ColumnText(5),
			row:             int(stmt.ColumnInt(6)),
			column:          int(stmt.ColumnInt(7)),
			appliedArgs:     stmt.ColumnText(8),
			modeArg:         stmt.ColumnText(9),
			parentModifiers: stmt.ColumnText(10),
			fieldArgDefs:    stmt.ColumnText(11),
		})
	}

	// In-memory, process each usage.
	// First, check that the parent field is not a list.
	isListType := func(modifiers string) bool {
		return strings.Contains(modifiers, "]")
	}

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

	// Group usages by fieldTypeID (optional if we want to load definitions only once) – but here we've already aggregated them.
	// Now process each usage.
	for _, usage := range usages {
		// Check parent's type: if parent's modifiers indicate a list, it's invalid.
		if isListType(usage.parentModifiers) {
			errs.Append(&plugins.Error{
				Message: fmt.Sprintf("Field %q in document %q: @%s cannot be applied when the parent field is a list", usage.fieldName, usage.documentName, paginateDirective),
				Kind:    plugins.ErrorKindValidation,
				Locations: []*plugins.ErrorLocation{
					{Filepath: usage.filepath, Line: usage.row, Column: usage.column},
				},
			})
			continue
		}

		// Parse the field definitions.
		fieldArgs := parseFieldArgs(usage.fieldArgDefs)
		forwardPagination := (fieldArgs["first"] == "Int" && fieldArgs["after"] == "String")
		backwardsPagination := (fieldArgs["last"] == "Int" && fieldArgs["before"] == "String")
		cursorPagination := forwardPagination || backwardsPagination
		offsetPagination := (fieldArgs["offset"] == "Int" && fieldArgs["limit"] == "Int")

		// Build a set of applied argument names.
		appliedSet := make(map[string]bool)
		if usage.appliedArgs != "" {
			for _, arg := range strings.Split(usage.appliedArgs, ",") {
				appliedSet[strings.TrimSpace(arg)] = true
			}
		}

		// Determine effective paginate mode.
		effectiveMode := defaultPaginateMode
		if usage.modeArg != "" {
			// Mode argument must not be numeric.
			if _, err := strconv.Atoi(usage.modeArg); err == nil {
				errs.Append(&plugins.Error{
					Message: fmt.Sprintf("Field %q in document %q: paginate mode argument must be a string, got numeric value %q", usage.fieldName, usage.documentName, usage.modeArg),
					Kind:    plugins.ErrorKindValidation,
					Locations: []*plugins.ErrorLocation{
						{Filepath: usage.filepath, Line: usage.row, Column: usage.column},
					},
				})
				continue
			} else {
				effectiveMode = usage.modeArg
			}
		}

		// Validate based on supported pagination mode.
		if cursorPagination {
			forwardApplied := appliedSet["first"]
			backwardsApplied := appliedSet["last"]
			if !forwardApplied && !backwardsApplied {
				errs.Append(&plugins.Error{
					Message: fmt.Sprintf("Field %q in document %q with cursor-based pagination must have either a 'first' or a 'last' argument", usage.fieldName, usage.documentName),
					Kind:    plugins.ErrorKindValidation,
					Locations: []*plugins.ErrorLocation{
						{Filepath: usage.filepath, Line: usage.row, Column: usage.column},
					},
				})
			}
			if forwardApplied && backwardsApplied && effectiveMode == "Infinite" {
				errs.Append(&plugins.Error{
					Message: fmt.Sprintf("Field %q in document %q with cursor-based pagination cannot have both 'first' and 'last' arguments in Infinite mode", usage.fieldName, usage.documentName),
					Kind:    plugins.ErrorKindValidation,
					Locations: []*plugins.ErrorLocation{
						{Filepath: usage.filepath, Line: usage.row, Column: usage.column},
					},
				})
			}
		} else if offsetPagination {
			if !appliedSet["limit"] {
				errs.Append(&plugins.Error{
					Message: fmt.Sprintf("Field %q in document %q with offset-based pagination must have an 'limit' argument", usage.fieldName, usage.documentName),
					Kind:    plugins.ErrorKindValidation,
					Locations: []*plugins.ErrorLocation{
						{Filepath: usage.filepath, Line: usage.row, Column: usage.column},
					},
				})
			}
		} else {
			errs.Append(&plugins.Error{
				Message: fmt.Sprintf("Field %q in document %q does not support a valid pagination mode (cursor-based or offset-based)", usage.fieldName, usage.documentName),
				Kind:    plugins.ErrorKindValidation,
				Locations: []*plugins.ErrorLocation{
					{Filepath: usage.filepath, Line: usage.row, Column: usage.column},
				},
			})
		}
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
		LEFT JOIN possible_types pt
			ON pt.type = 'Node'
			AND d.type_condition = pt.member
		LEFT JOIN type_configs tc
			ON tc.resolve_query IS NOT NULL
			AND d.type_condition = tc.name
		WHERE d.kind = 'fragment'
			AND sd.directive = ?
			AND pt.member IS NULL
			AND tc.name IS NULL
	`
	conn, err := db.Take(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer db.Put(conn)

	stmt, err := conn.Prepare(query)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer stmt.Finalize()

	stmt.BindText(1, schema.PaginationDirective)

	err = db.StepStatement(ctx, stmt, func() {
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
	WHERE sd.directive = ?
	`

	conn, err := db.Take(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer db.Put(conn)

	stmt, err := conn.Prepare(query)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer stmt.Finalize()

	stmt.BindText(1, schema.PaginationDirective)

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
	for {
		hasData, err := stmt.Step()
		if err != nil {
			errs.Append(plugins.WrapError(err))
			return
		}
		if !hasData {
			break
		}
		uid := stmt.ColumnInt64(0)
		u := usage{
			documentID:   uid,
			documentName: stmt.ColumnText(1),
			filepath:     stmt.ColumnText(2),
			row:          int(stmt.ColumnInt(3)),
			column:       int(stmt.ColumnInt(4)),
		}
		groups[uid] = append(groups[uid], u)
	}

	// Now, for each document that has more than one paginate directive, report an error.
	for _, usages := range groups {
		if len(usages) > 1 {
			// Build a list of location strings.
			var locStrs []string
			for _, u := range usages {
				locStrs = append(locStrs, fmt.Sprintf("%s:%d:%d", u.filepath, u.row, u.column))
			}
			// Use the document name from the first usage.
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
			-- Base case: start at selections with the paginate or list directive
			SELECT
				s.id,
				0 AS has_match,
				argument_values.raw AS list_name
			FROM selection_directives sd
				JOIN selections s ON sd.selection_id = s.id
				JOIN selection_refs sr ON s.id = sr.child_id
				JOIN documents doc ON sr.document = doc.id
				JOIN selection_directive_arguments da ON sd.id = da.parent
				JOIN argument_values ON da.value = argument_values.id
			WHERE sd.directive IN (? , ?)
				AND da.name = 'name'
				AND doc.kind = 'query'

			UNION ALL

			-- Recursive step: keep walking up until we find a match
			SELECT
				p.id,
				CASE WHEN tf.type_modifiers LIKE '%]%' THEN 1 ELSE 0 END AS has_match,
				sh.list_name
			FROM pagination_parents sh
				JOIN selection_refs sr ON sr.child_id = sh.id
				JOIN selections p ON p.id = sr.parent_id
				JOIN type_fields tf ON p.type = tf.id
			WHERE sh.has_match = 0
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
			WHERE sd.directive IN (? , ?)
				AND da.name = 'name'
				AND doc.kind = 'fragment'
		),

		-- Define a table of acceptable suffixes
		suffixes(sfx) AS (
			VALUES (?), (?), (?)
		),

		-- precompute the list of operation names that could refer to a constrainted list
		operation_names AS (
			SELECT
				mp.list_name,
				mp.list_name || '_' || s.sfx AS expected_field_name
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
			LEFT JOIN selection_directives sd2 ON sd2.selection_id = f.id AND sd2.directive in (?, ?)
		WHERE f.kind = 'fragment'
		AND sd2.id IS NULL
	`

	conn, err := db.Take(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer db.Put(conn)

	stmt, err := conn.Prepare(query)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer stmt.Finalize()

	// assign the suffixes that indicate a list operation
	stmt.BindText(1, schema.PaginationDirective)
	stmt.BindText(2, schema.ListDirective)
	stmt.BindText(3, schema.PaginationDirective)
	stmt.BindText(4, schema.ListDirective)
	stmt.BindText(5, schema.ListOperationPrefixInsert)
	stmt.BindText(6, schema.ListOperationPrefixToggle)
	stmt.BindText(7, schema.ListOperationPrefixRemove)
	stmt.BindText(8, schema.ParentIDDirective)
	stmt.BindText(9, schema.AllListsDirective)

	// every result is a list that requires a parent id but doesn't have one
	err = db.StepStatement(ctx, stmt, func() {
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

func ValidateListNames[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {

}
