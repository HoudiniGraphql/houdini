// this file contains the validation logic for the houdini-specifics

package main

import (
	"context"
	"encoding/json"
	"fmt"

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
