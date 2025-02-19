// this file contains the validation logic for the houdini-specifics

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"code.houdinigraphql.com/plugins"
	"zombiezen.com/go/sqlite"
)

func (p *HoudiniCore) validate_noKeyAlias(ctx context.Context, errs *plugins.ErrorList) {
	// This query finds selections whose alias conflicts with an allowed key,
	// but only if the alias is different from the underlying field name.
	// Allowed keys are derived from two sources:
	// 1. Global default keys from the config table (JSON field "default_keys").
	// 2. Type-specific keys from the type_configs table (JSON field "keys").
	// For type-specific keys, we require that type_configs.name equals the parent type.
	// We assume that selections has columns:
	//   alias, field_name (the actual field name), and that we can join type_fields on field_name,
	//   and types on tf.parent = t.name.
	// We also join selection_refs (using s.id = sr.child_id) to get row/column location info.
	query := `
		SELECT
		s.alias,
		t.name AS typeName,
		rd.filepath,
		json_group_array(
			json_object('line', sr.row, 'column', sr.column)
		) AS locations
		FROM selections s
		JOIN selection_refs sr ON sr.child_id = s.id
		JOIN type_fields tf ON s.field_name = tf.name
		JOIN types t ON tf.parent = t.name
		JOIN documents d ON d.id = sr.document
		JOIN raw_documents rd ON rd.id = d.raw_document
		JOIN (
			-- Global default keys from config.
			SELECT value AS key, NULL AS type_name
			FROM config, json_each(config.default_keys)
			UNION
			-- Type-specific keys from type_configs.
			SELECT value AS key, tc.name AS type_name
			FROM type_configs tc, json_each(tc.keys)
		) allowed ON allowed.key = s.alias
			AND (allowed.type_name IS NULL OR allowed.type_name = t.name)
		WHERE s.alias IS NOT NULL
		AND s.alias <> s.field_name
		GROUP BY s.alias, t.name, rd.filepath
	`

	p.runValidationQuery(ctx, query, "error checking for alias keys", errs, func(stmt *sqlite.Stmt) {
		alias := stmt.ColumnText(0)
		typeName := stmt.ColumnText(1)
		filepath := stmt.ColumnText(2)
		locationsRaw := stmt.ColumnText(3)

		var locations []*plugins.ErrorLocation
		if err := json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
			locations = []*plugins.ErrorLocation{{Filepath: filepath}}
		} else {
			for _, loc := range locations {
				loc.Filepath = filepath
			}
		}

		errs.Append(plugins.Error{
			Message:   fmt.Sprintf("Alias '%s' is not allowed because it conflicts with a key for type '%s'", alias, typeName),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
}

func (p *HoudiniCore) validate_requiredDirective(ctx context.Context, errs *plugins.ErrorList) {
	// This query selects all field selections that have the required directive,
	// along with:
	//  - The field's name.
	//  - The field definition's type_modifiers.
	//  - The parent's type kind.
	//  - Location info (from raw_documents via selection_refs).
	//  - The document name.
	//  - An aggregated count of child selections that have the required directive.
	// Instead of a subquery, we join the child selections using LEFT JOIN.
	query := `
	SELECT
	  s.id AS selectionID,
	  s.field_name,
	  tf.type_modifiers,
	  t.kind AS parentKind,
	  rd.filepath,
	  sr.row,
	  sr.column,
	  d.name AS documentName,
	  COUNT(sd_child.directive) AS childReqCount
	FROM selections s
	  JOIN type_fields tf ON s.type = tf.id
	  JOIN types t ON tf.parent = t.name
	  JOIN selection_directives sd ON s.id = sd.selection_id
	  JOIN selection_refs sr ON sr.child_id = s.id
	  JOIN documents d ON d.id = sr.document
	  JOIN raw_documents rd ON rd.id = d.raw_document
	  LEFT JOIN selection_refs sr_child ON sr_child.parent_id = s.id
	  LEFT JOIN selection_directives sd_child
	    ON sr_child.child_id = sd_child.selection_id AND sd_child.directive = ?
	WHERE sd.directive = ?
	GROUP BY s.id, s.field_name, tf.type_modifiers, t.kind, rd.filepath, sr.row, sr.column, d.name
	`

	conn, err := p.DB.Take(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer p.DB.Put(conn)

	stmt, err := conn.Prepare(query)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer stmt.Finalize()

	// Bind the required directive name twice.
	stmt.BindText(1, requiredDirective)
	stmt.BindText(2, requiredDirective)

	p.runValidationStatement(ctx, conn, stmt, "error checking required directives", errs, func() {
		fieldName := stmt.ColumnText(1)
		typeModifiers := stmt.ColumnText(2)
		parentKind := stmt.ColumnText(3)
		filepath := stmt.ColumnText(4)
		row := int(stmt.ColumnInt(5))
		column := int(stmt.ColumnInt(6))
		docName := stmt.ColumnText(7)
		childReqCount := stmt.ColumnInt(8)

		// Rule 1: The field must be defined on an object type.
		if parentKind != "OBJECT" {
			errs.Append(plugins.Error{
				Message: fmt.Sprintf("@%s may only be used on object fields, not on fields of %s type (field %q in document %s)", requiredDirective, parentKind, fieldName, docName),
				Kind:    plugins.ErrorKindValidation,
				Locations: []*plugins.ErrorLocation{
					{Filepath: filepath, Line: row, Column: column},
				},
			})
			return
		}

		// Determine if the field is non-null on the server.
		// We require that type_modifiers ends with "!".
		serverNonNull := strings.HasSuffix(typeModifiers, "!")

		// Rule 2: If the field is non-null on the server, it is only allowed to use @required
		// if at least one child selection already has @required.
		if serverNonNull && childReqCount == 0 {
			errs.Append(plugins.Error{
				Message: fmt.Sprintf("@%s may only be used on fields that are nullable on the server or on fields whose child selections already carry @%s (field %q in document %s)", requiredDirective, requiredDirective, fieldName, docName),
				Kind:    plugins.ErrorKindValidation,
				Locations: []*plugins.ErrorLocation{
					{Filepath: filepath, Line: row, Column: column},
				},
			})
		}
	})
}

func (p *HoudiniCore) validate_maskDirectives(ctx context.Context, errs *plugins.ErrorList) {
	// We want to detect fragment spreads (selections of kind "fragment")
	// that have both the mask-enable and mask-disable directives.
	// We can do this by grouping by the selection (fragment spread)
	// and checking that the set of directive names attached contains both.
	query := `
		SELECT
			s.id AS selectionID,
			rd.filepath,
			MIN(sr.row) AS row,
			MIN(sr.column) AS column
		FROM selections s
			JOIN selection_directives sd ON s.id = sd.selection_id
			JOIN selection_refs sr ON sr.child_id = s.id
			JOIN documents d ON d.id = sr.document
			JOIN raw_documents rd ON rd.id = d.raw_document
		WHERE s.kind = 'fragment'
			AND sd.directive IN (?, ?)
		GROUP BY s.id
		HAVING COUNT(DISTINCT sd.directive) > 1
	`

	conn, err := p.DB.Take(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer p.DB.Put(conn)

	stmt, err := conn.Prepare(query)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer stmt.Finalize()

	// Bind the two directive names.
	stmt.BindText(1, enableMaskDirective)
	stmt.BindText(2, disableMaskDirective)

	p.runValidationStatement(ctx, conn, stmt, "error checking mask directives", errs, func() {
		filepath := stmt.ColumnText(1)
		row := int(stmt.ColumnInt(2))
		column := int(stmt.ColumnInt(3))

		errs.Append(plugins.Error{
			Message: fmt.Sprintf("You can't apply both @%s and @%s on the same fragment spread", enableMaskDirective, disableMaskDirective),
			Kind:    plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{
				{
					Filepath: filepath,
					Line:     row,
					Column:   column,
				},
			},
		})
	})
}

func (p *HoudiniCore) validate_knownDirectiveArguments(ctx context.Context, errs *plugins.ErrorList) {
	// the @arguments, @with, @when, and @when_not do not have argumenst that are known to the schema
	// so we need to looks for directive arguments (both at the selection level and document level)
	// that do not have a matching entry in the directive_arguments table.
	query := `
		SELECT directive, argName, filepath, row, column FROM (
		  -- Selection-level directive arguments:
		  SELECT
			sd.directive AS directive,
			sda.name AS argName,
			rd.filepath AS filepath,
			sd.row AS row,
			sd.column AS column
		  FROM selection_directive_arguments sda
			JOIN selection_directives sd ON sda.parent = sd.id
			JOIN selection_refs sr ON sr.child_id = sd.selection_id
			JOIN documents d ON d.id = sr.document
			JOIN raw_documents rd ON rd.id = d.raw_document
			LEFT JOIN directive_arguments da ON da.parent = sd.directive AND da.name = sda.name
		  WHERE da.name IS NULL
			AND sd.directive NOT IN ('with', 'when', 'when_not', 'arguments')

		  UNION ALL

		  -- Document-level directive arguments:
		  SELECT
			dd.directive AS directive,
			dda.name AS argName,
			rd.filepath AS filepath,
			dd.row AS row,
			dd.column AS column
		  FROM document_directives dd
			JOIN document_directive_arguments dda ON dda.parent = dd.id
			JOIN documents d ON d.id = dd.document
			JOIN raw_documents rd ON rd.id = d.raw_document
			LEFT JOIN directive_arguments da ON da.parent = dd.directive AND da.name = dda.name
		  WHERE da.name IS NULL
			AND dd.directive NOT IN ('with', 'when', 'when_not', 'arguments')
		)
	`

	p.runValidationQuery(ctx, query, "error checking for unknown directive arguments", errs, func(row *sqlite.Stmt) {
		directive := row.ColumnText(0)
		argName := row.ColumnText(1)
		filepath := row.ColumnText(2)
		line := int(row.ColumnInt(3))
		column := int(row.ColumnInt(4))

		errs.Append(plugins.Error{
			Message: fmt.Sprintf("Unknown argument '%s' used with directive '@%s'", argName, directive),
			Kind:    plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{{
				Filepath: filepath,
				Line:     line,
				Column:   column,
			}},
		})
	})
}

func (p *HoudiniCore) validate_loadingDirective(ctx context.Context, errs *plugins.ErrorList) {
	// This query selects selections (fields or fragment spreads) that have the loading directive,
	// are not at the document root (i.e. they have a parent selection),
	// whose parent selection does NOT also have the loading directive,
	// and where the document itself is not marked as global (i.e. the document's definition does not have the loading directive).
	query := `
	SELECT
	  s.id AS selectionID,
	  d.id AS documentID,
	  rd.filepath,
	  sr.row,
	  sr.column
	FROM selections s
	  JOIN selection_directives sd ON s.id = sd.selection_id
	  JOIN selection_refs sr ON sr.child_id = s.id
	  JOIN documents d ON d.id = sr.document
	  JOIN raw_documents rd ON rd.id = d.raw_document
	  LEFT JOIN selection_directives pd ON pd.selection_id = sr.parent_id AND pd.directive = ?
	WHERE sd.directive = ?
	  AND s.kind IN ('field', 'fragment')
	  AND sr.parent_id IS NOT NULL
	  AND pd.directive IS NULL
	  AND d.id NOT IN (
	    SELECT d2.id
	    FROM documents d2
	    JOIN document_directives dd ON d2.id = dd.document
	    WHERE dd.directive = ?
	  )
	`

	conn, err := p.DB.Take(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer p.DB.Put(conn)

	stmt, err := conn.Prepare(query)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer stmt.Finalize()

	// Bind the loading directive three times.
	stmt.BindText(1, loadingDirective)
	stmt.BindText(2, loadingDirective)
	stmt.BindText(3, loadingDirective)

	p.runValidationStatement(ctx, conn, stmt, "error checking loading directives", errs, func() {
		filepath := stmt.ColumnText(2)
		row := int(stmt.ColumnInt(3))
		column := int(stmt.ColumnInt(4))

		errs.Append(plugins.Error{
			Message: fmt.Sprintf("@%s can only be applied at the root of a document or on a field/fragment spread whose parent also has @%s", loadingDirective, loadingDirective),
			Kind:    plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{
				{
					Filepath: filepath,
					Line:     row,
					Column:   column,
				},
			},
		})
	})
}
func (p *HoudiniCore) validate_optimisticKeyOnScalar(ctx context.Context, errs *plugins.ErrorList) {
	// This query selects every field selection that has the optimisticKey directive
	// and whose declared type is not a scalar (i.e. its type's kind is not "SCALAR").
	query := `
	SELECT
	  s.id AS selectionID,
	  s.field_name,
	  rd.filepath,
	  sr.row,
	  sr.column,
	  d.name AS documentName,
	  t.kind AS fieldTypeKind
	FROM selection_directives sd
	  JOIN selections s ON s.id = sd.selection_id
	  JOIN selection_refs sr ON sr.child_id = s.id
	  JOIN documents d ON d.id = sr.document
	  JOIN raw_documents rd ON rd.id = d.raw_document
	  JOIN type_fields tf ON s.type = tf.id
	  JOIN types t ON tf.type = t.name
	WHERE sd.directive = ?
	  AND t.kind != 'SCALAR'
	`

	conn, err := p.DB.Take(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer p.DB.Put(conn)

	stmt, err := conn.Prepare(query)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer stmt.Finalize()

	stmt.BindText(1, optimisticKeyDirective)

	p.runValidationStatement(ctx, conn, stmt, "error checking optimistic key directive on scalar", errs, func() {
		fieldTypeKind := stmt.ColumnText(6)
		filepath := stmt.ColumnText(2)
		row := int(stmt.ColumnInt(3))
		column := int(stmt.ColumnInt(4))
		fieldName := stmt.ColumnText(1)
		docName := stmt.ColumnText(5)

		errs.Append(plugins.Error{
			Message: fmt.Sprintf("@%s can only be applied on scalar fields, but field %q in document %q has type kind %q", optimisticKeyDirective, fieldName, docName, fieldTypeKind),
			Kind:    plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{
				{Filepath: filepath, Line: row, Column: column},
			},
		})
	})
}

func (p *HoudiniCore) validate_optimisticKeyFullSelection(ctx context.Context, errs *plugins.ErrorList) {
	optimisticDirective := optimisticKeyDirective

	// Query returns one row per optimistic-key usage.
	// We retrieve:
	//  - sr.parent_id: the parent selection ID (which groups a selection set).
	//  - d.kind: the document kind.
	//  - rd.filepath, sr.row, sr.column: location info.
	//  - s.field_name: the field that is tagged with @optimisticKey.
	//  - tfp.type AS parentTypeName: the parent's declared return type (i.e. the type of the object).
	//  - COALESCE(tc.keys, c.default_keys) AS expectedKeys: the expected key fields as a JSON array.
	query := `
	SELECT
	  sr.parent_id AS parentID,
	  d.kind AS docKind,
	  rd.filepath,
	  sr.row,
	  sr.column,
	  s.field_name,
	  tfp.type AS parentTypeName,
	  COALESCE(tc.keys, c.default_keys) AS expectedKeys
	FROM selection_directives sd
	  JOIN selections s ON s.id = sd.selection_id
	  JOIN selection_refs sr ON sr.child_id = s.id
	  JOIN documents d ON d.id = sr.document
	  JOIN raw_documents rd ON rd.id = d.raw_document
	  LEFT JOIN selections sp ON sp.id = sr.parent_id
	  LEFT JOIN type_fields tfp ON sp.type = tfp.id
	  LEFT JOIN type_configs tc ON tc.name = tfp.type
	  CROSS JOIN config c
	WHERE sd.directive = ?
	  AND sr.parent_id IS NOT NULL
	  AND sp.kind = 'field'
	`
	conn, err := p.DB.Take(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer p.DB.Put(conn)

	stmt, err := conn.Prepare(query)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer stmt.Finalize()

	stmt.BindText(1, optimisticDirective)

	// In-memory grouping: map parentID -> list of usage records.
	type usageRecord struct {
		fieldName      string
		filepath       string
		row            int
		column         int
		docKind        string
		parentTypeName string
		expectedKeys   string // JSON
	}
	groups := make(map[int64][]usageRecord)

	for {
		hasData, err := stmt.Step()
		if err != nil {
			errs.Append(plugins.WrapError(err))
			return
		}
		if !hasData {
			break
		}
		parentID := stmt.ColumnInt64(0)
		rec := usageRecord{
			fieldName:      stmt.ColumnText(5),
			filepath:       stmt.ColumnText(2),
			row:            int(stmt.ColumnInt(3)),
			column:         int(stmt.ColumnInt(4)),
			docKind:        stmt.ColumnText(1),
			parentTypeName: stmt.ColumnText(6),
			expectedKeys:   stmt.ColumnText(7),
		}
		groups[parentID] = append(groups[parentID], rec)
	}

	// Process each group.
	for _, usages := range groups {
		// Use the first usage as a representative for location, document kind, and parent's type.
		rep := usages[0]
		// Rule: Must be used in a mutation.
		if rep.docKind != "mutation" {
			errs.Append(plugins.Error{
				Message: fmt.Sprintf("@%s can only be used in mutations", optimisticDirective),
				Kind:    plugins.ErrorKindValidation,
				Locations: []*plugins.ErrorLocation{
					{Filepath: rep.filepath, Line: rep.row, Column: rep.column},
				},
			})
			continue
		}
		// Rule: Must have a defined parent type.
		if strings.TrimSpace(rep.parentTypeName) == "" {
			errs.Append(plugins.Error{
				Message: fmt.Sprintf("@%s must be applied to a selection set with a defined parent type", optimisticDirective),
				Kind:    plugins.ErrorKindValidation,
				Locations: []*plugins.ErrorLocation{
					{Filepath: rep.filepath, Line: rep.row, Column: rep.column},
				},
			})
			continue
		}

		// Combine found keys from all usages in the group.
		keySet := make(map[string]struct{})
		for _, u := range usages {
			keySet[u.fieldName] = struct{}{}
		}
		var foundKeys []string
		for k := range keySet {
			foundKeys = append(foundKeys, k)
		}
		sort.Strings(foundKeys)

		// Unmarshal expected keys from the JSON.
		var expectedKeys []string
		if err := json.Unmarshal([]byte(rep.expectedKeys), &expectedKeys); err != nil {
			errs.Append(plugins.WrapError(fmt.Errorf("failed to unmarshal expectedKeys JSON for type %q: %w", rep.parentTypeName, err)))
			continue
		}
		sort.Strings(expectedKeys)

		// Compare: if found keys do not exactly match expected keys, report error.
		if len(foundKeys) != len(expectedKeys) {
			errs.Append(plugins.Error{
				Message: fmt.Sprintf("@%s must be applied to every key field for type %q; expected keys %v but found %v", optimisticDirective, rep.parentTypeName, expectedKeys, foundKeys),
				Kind:    plugins.ErrorKindValidation,
				Locations: []*plugins.ErrorLocation{
					{Filepath: rep.filepath, Line: rep.row, Column: rep.column},
				},
			})
			continue
		}
		for i, key := range expectedKeys {
			if key != foundKeys[i] {
				errs.Append(plugins.Error{
					Message: fmt.Sprintf("@%s must be applied to every key field for type %q; expected keys %v but found %v", optimisticDirective, rep.parentTypeName, expectedKeys, foundKeys),
					Kind:    plugins.ErrorKindValidation,
					Locations: []*plugins.ErrorLocation{
						{Filepath: rep.filepath, Line: rep.row, Column: rep.column},
					},
				})
				break
			}
		}
	}
}

func (p *HoudiniCore) validate_singlePaginateDirective(ctx context.Context, errs *plugins.ErrorList) {
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

	conn, err := p.DB.Take(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer p.DB.Put(conn)

	stmt, err := conn.Prepare(query)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer stmt.Finalize()

	stmt.BindText(1, paginationDirective)

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
			errs.Append(plugins.Error{
				Message: fmt.Sprintf("@%s can only appear once in a document; found %d occurrences in document %q at locations: %s", paginationDirective, len(usages), docName, strings.Join(locStrs, "; ")),
				Kind:    plugins.ErrorKindValidation,
			})
		}
	}
}

func (p *HoudiniCore) validate_paginateArgs(ctx context.Context, errs *plugins.ErrorList) {
	// Load project configuration.
	config, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defaultPaginateMode := config.DefaultPaginateMode // e.g., "Infinite"
	// We assume the paginate mode argument is named "mode".
	paginateModeArgName := "mode"
	paginateDirective := paginationDirective

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

	conn, err := p.DB.Take(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer p.DB.Put(conn)

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
			errs.Append(plugins.Error{
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
				errs.Append(plugins.Error{
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
				errs.Append(plugins.Error{
					Message: fmt.Sprintf("Field %q in document %q with cursor-based pagination must have either a 'first' or a 'last' argument", usage.fieldName, usage.documentName),
					Kind:    plugins.ErrorKindValidation,
					Locations: []*plugins.ErrorLocation{
						{Filepath: usage.filepath, Line: usage.row, Column: usage.column},
					},
				})
			}
			if forwardApplied && backwardsApplied && effectiveMode == "Infinite" {
				errs.Append(plugins.Error{
					Message: fmt.Sprintf("Field %q in document %q with cursor-based pagination cannot have both 'first' and 'last' arguments in Infinite mode", usage.fieldName, usage.documentName),
					Kind:    plugins.ErrorKindValidation,
					Locations: []*plugins.ErrorLocation{
						{Filepath: usage.filepath, Line: usage.row, Column: usage.column},
					},
				})
			}
		} else if offsetPagination {
			if !appliedSet["limit"] {
				errs.Append(plugins.Error{
					Message: fmt.Sprintf("Field %q in document %q with offset-based pagination must have an 'limit' argument", usage.fieldName, usage.documentName),
					Kind:    plugins.ErrorKindValidation,
					Locations: []*plugins.ErrorLocation{
						{Filepath: usage.filepath, Line: usage.row, Column: usage.column},
					},
				})
			}
		} else {
			errs.Append(plugins.Error{
				Message: fmt.Sprintf("Field %q in document %q does not support a valid pagination mode (cursor-based or offset-based)", usage.fieldName, usage.documentName),
				Kind:    plugins.ErrorKindValidation,
				Locations: []*plugins.ErrorLocation{
					{Filepath: usage.filepath, Line: usage.row, Column: usage.column},
				},
			})
		}
	}
}

func (p *HoudiniCore) validate_paginateTypeCondition(ctx context.Context, errs *plugins.ErrorList) {
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
	conn, err := p.DB.Take(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer p.DB.Put(conn)

	stmt, err := conn.Prepare(query)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}
	defer stmt.Finalize()

	stmt.BindText(1, paginationDirective)

	p.runValidationStatement(ctx, conn, stmt, "error checking paginate type condition", errs, func() {
		docID := stmt.ColumnInt64(0)
		docName := stmt.ColumnText(1)
		typeCondition := stmt.ColumnText(2)
		filepath := stmt.ColumnText(3)
		row := int(stmt.ColumnInt(4))
		column := int(stmt.ColumnInt(5))
		impl := stmt.ColumnInt(6)
		resolveFlag := stmt.ColumnInt(7)

		errs.Append(plugins.Error{
			Message: fmt.Sprintf("Document %q (ID %d) uses @%s but its type condition %q is invalid (implementsNode=%d, hasResolveQuery=%d). It must either implement Node or have a type_configs entry with a valid resolve_query", docName, docID, paginationDirective, typeCondition, impl, resolveFlag),
			Kind:    plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{
				{Filepath: filepath, Line: row, Column: column},
			},
		})
	})
}

func (p *HoudiniCore) validate_lists(ctx context.Context, errs *plugins.ErrorList) {

}

func (p *HoudiniCore) validate_nodeDirective(ctx context.Context, errs *plugins.ErrorList) {

}

func (p *HoudiniCore) validate_fragmentArguments(ctx context.Context, errs *plugins.ErrorList) {

}
