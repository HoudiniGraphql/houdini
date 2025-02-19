// this file contains the validation logic for the houdini-specifics

package main

import (
	"context"
	"encoding/json"
	"fmt"
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

func (p *HoudiniCore) validate_lists(ctx context.Context, errs *plugins.ErrorList) {

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

func (p *HoudiniCore) validate_nodeDirective(ctx context.Context, errs *plugins.ErrorList) {

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

func (p *HoudiniCore) validate_fragmentArguments(ctx context.Context, errs *plugins.ErrorList) {

}

func (p *HoudiniCore) validate_paginateArgs(ctx context.Context, errs *plugins.ErrorList) {

}

func (p *HoudiniCore) validate_noUnusedFragmentArguments(ctx context.Context, errs *plugins.ErrorList) {

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

func (p *HoudiniCore) validate_optimisticKeys(ctx context.Context, errs *plugins.ErrorList) {

}
