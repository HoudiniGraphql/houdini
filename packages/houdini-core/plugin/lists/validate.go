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
	SELECT
	  d.id AS documentID,
	  d.name AS documentName,
	  d.type_condition AS typeCondition,
	  rd.filepath,
	  rd.offset_line AS row,
	  rd.offset_column AS column,
	  MAX(CASE WHEN pt.type = 'Node' AND pt.member = d.type_condition THEN 1 ELSE 0 END) AS implementsNode,
	  MAX(CASE WHEN tc.resolve_query IS NOT NULL AND TRIM(tc.resolve_query) <> '' THEN 1 ELSE 0 END) AS hasResolveQuery
	FROM documents d
	  JOIN raw_documents rd ON rd.id = d.raw_document
	  -- Only consider documents that have at least one @paginate usage.
	  JOIN selection_refs sr ON sr.document = d.id
	  JOIN selection_directives sd ON sd.selection_id = sr.child_id AND sd.directive = ?
	  LEFT JOIN possible_types pt ON pt.type = 'Node' AND pt.member = d.type_condition
	  LEFT JOIN type_configs tc ON tc.name = d.type_condition
	WHERE TRIM(d.type_condition) <> ''
	GROUP BY d.id, d.name, d.type_condition, rd.filepath, rd.offset_line, rd.offset_column
	HAVING MAX(CASE WHEN pt.type = 'Node' AND pt.member = d.type_condition THEN 1 ELSE 0 END) = 0
	   AND MAX(CASE WHEN tc.resolve_query IS NOT NULL AND TRIM(tc.resolve_query) <> '' THEN 1 ELSE 0 END) = 0
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
		docID := stmt.ColumnInt64(0)
		docName := stmt.ColumnText(1)
		typeCondition := stmt.ColumnText(2)
		filepath := stmt.ColumnText(3)
		row := int(stmt.ColumnInt(4))
		column := int(stmt.ColumnInt(5))
		impl := stmt.ColumnInt(6)
		resolveFlag := stmt.ColumnInt(7)

		errs.Append(&plugins.Error{
			Message: fmt.Sprintf("Document %q (ID %d) uses @%s but its type condition %q is invalid (implementsNode=%d, hasResolveQuery=%d). It must either implement Node or have a type_configs entry with a valid resolve_query", docName, docID, schema.PaginationDirective, typeCondition, impl, resolveFlag),
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

func ValidateLists[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {

}

func ValidateNodeDirective[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {

}
