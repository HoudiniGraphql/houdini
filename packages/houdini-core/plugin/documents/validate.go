// this file contains implementations for the default validators included in graphql-js

package documents

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"code.houdinigraphql.com/packages/houdini-core/plugin/schema"
	"code.houdinigraphql.com/plugins"
	"zombiezen.com/go/sqlite"
)

func ValidateSubscriptionsWithMultipleRootFields[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	queryStr := `
		SELECT
			raw_documents.filepath,
			json_group_array(
				json_object('line', refs.row, 'column', refs.column)
			)
		FROM documents
			JOIN selection_refs refs ON refs.document = documents.id
			JOIN selections  ON selections.id = refs.child_id
			JOIN raw_documents ON raw_documents.id = documents.raw_document
		WHERE documents.kind = 'subscription'
			AND refs.parent_id IS NULL
			AND selections.kind = 'field'
			AND (raw_documents.current_task = $task_id OR $task_id IS NULL)
		GROUP BY documents.id, documents.name HAVING COUNT(*) > 1
	`
	err := db.StepQuery(ctx, queryStr, nil, func(q *sqlite.Stmt) {
		filepath := q.ColumnText(0)
		locationsRaw := q.ColumnText(1)

		locations := []*plugins.ErrorLocation{}
		if err := json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
			errs.Append(plugins.WrapError(fmt.Errorf("error unmarshaling locations: %v. Raw: %s", err, locationsRaw)))
			return
		}
		// Set the file path for each location.
		for _, loc := range locations {
			loc.Filepath = filepath
		}
		errs.Append(&plugins.Error{
			Message:   "subscriptions can only have a single root field",
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateDuplicateDocumentNames[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	queryStr := `
		SELECT
			documents.name,
			json_group_array(
				json_object(
					'filepath', raw_documents.filepath,
					'line', raw_documents.offset_line,
					'column', raw_documents.offset_column
				)
			) as locations
		FROM documents
			JOIN raw_documents ON raw_documents.id = documents.raw_document
		WHERE (raw_documents.current_task = $task_id OR $task_id IS NULL)
		GROUP BY documents.name
		HAVING COUNT(*) > 1
	`
	err := db.StepQuery(ctx, queryStr, nil, func(q *sqlite.Stmt) {
		docName := q.ColumnText(0)
		locationsRaw := q.ColumnText(1)

		locations := []*plugins.ErrorLocation{}
		if err := json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
			errs.Append(plugins.WrapError(fmt.Errorf("error unmarshaling locations for document '%s': %v. Raw: %s", docName, err, locationsRaw)))
			return
		}
		errs.Append(&plugins.Error{
			Message:   fmt.Sprintf("duplicate document name: %s", docName),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateFragmentUnknownType[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	queryStr := `
		SELECT
			documents.name,
			documents.type_condition,
			raw_documents.filepath,
			json_group_array(
				json_object('line', raw_documents.offset_line, 'column', raw_documents.offset_column)
			)
		FROM documents
		JOIN raw_documents ON raw_documents.id = documents.raw_document
			LEFT JOIN types ON documents.type_condition = types.name
		WHERE documents.kind = 'fragment'
			AND types.name IS NULL
			AND (raw_documents.current_task = $task_id OR $task_id IS NULL)
		GROUP BY documents.id
	`
	err := db.StepQuery(ctx, queryStr, nil, func(query *sqlite.Stmt) {
		fragName := query.ColumnText(0)
		typeCond := query.ColumnText(1)
		filepath := query.ColumnText(2)
		locationsRaw := query.ColumnText(3)

		var locations []*plugins.ErrorLocation
		if err := json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
			errs.Append(plugins.WrapError(fmt.Errorf("error unmarshaling locations for fragment '%s': %v. Raw: %s", fragName, err, locationsRaw)))
			return
		}
		// set file path for each location
		for _, loc := range locations {
			loc.Filepath = filepath
		}

		errs.Append(&plugins.Error{
			Message:   fmt.Sprintf("Fragment '%s' references an unknown type '%s'", fragName, typeCond),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateFragmentOnScalar[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	queryStr := `
		SELECT
			documents.name,
			documents.type_condition,
			raw_documents.filepath,
			json_group_array(
				json_object('line', raw_documents.offset_line, 'column', raw_documents.offset_column)
			)
		FROM documents
			JOIN raw_documents ON raw_documents.id = documents.raw_document
			JOIN types ON documents.type_condition = types.name
		WHERE documents.kind = 'fragment'
		  AND types.kind = 'SCALAR'
		  AND (raw_documents.current_task = $task_id OR $task_id IS NULL)
		GROUP BY documents.id
	`
	err := db.StepQuery(ctx, queryStr, nil, func(row *sqlite.Stmt) {
		fragName := row.ColumnText(0)
		typeCond := row.ColumnText(1)
		filepath := row.ColumnText(2)
		locationsRaw := row.ColumnText(3)

		var locations []*plugins.ErrorLocation
		if err := json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
			errs.Append(plugins.WrapError(fmt.Errorf("error unmarshaling locations for fragment '%s': %v. Raw: %s", fragName, err, locationsRaw)))
			return
		}
		for _, loc := range locations {
			loc.Filepath = filepath
		}
		errs.Append(&plugins.Error{
			Message:   fmt.Sprintf("Fragment '%s' is defined on a scalar type '%s'", fragName, typeCond),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateOutputTypeAsInput[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	queryStr := `
		SELECT
			document_variables.name,
			document_variables.type,
			raw_documents.filepath,
			raw_documents.offset_line,
			raw_documents.offset_column
		FROM document_variables
			JOIN documents ON document_variables.document = documents.id
			JOIN raw_documents ON raw_documents.id = documents.raw_document
			JOIN types ON document_variables.type = types.name
		WHERE types.kind in ('OBJECT', 'INTERFACE', 'UNION')
			AND (raw_documents.current_task = $task_id OR $task_id IS NULL)
	`
	err := db.StepQuery(ctx, queryStr, nil, func(row *sqlite.Stmt) {
		varName := row.ColumnText(0)
		varType := row.ColumnText(1)
		filepath := row.ColumnText(2)
		line := row.ColumnInt(3)
		column := row.ColumnInt(4)

		errs.Append(&plugins.Error{
			Message: fmt.Sprintf("Variable '$%s' uses output type '%s' (must be an input type)", varName, varType),
			Kind:    plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{
				{Filepath: filepath,
					Line:   line,
					Column: column,
				},
			},
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateScalarWithSelection[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	queryStr := `
		SELECT
			selections.alias,
			raw_documents.filepath,
			selection_refs.row,
			selection_refs.column
		FROM selection_refs
			JOIN documents ON selection_refs.document = documents.id
			JOIN raw_documents on documents.raw_document = raw_documents.id
			JOIN selections on selection_refs.parent_id = selections.id
			JOIN type_fields on selections.type = type_fields.id
			JOIN types on type_fields.type = types.name
		WHERE types.kind = 'SCALAR'
			AND (raw_documents.current_task = $task_id OR $task_id IS NULL)
	`
	err := db.StepQuery(ctx, queryStr, nil, func(row *sqlite.Stmt) {
		alias := row.ColumnText(0)
		filepath := row.ColumnText(1)
		line := row.ColumnInt(2)
		column := row.ColumnInt(3)

		errs.Append(&plugins.Error{
			Message: fmt.Sprintf("'%s' cannot have a selection (its a scalar)", alias),
			Kind:    plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{
				{Filepath: filepath,
					Line:   line,
					Column: column,
				},
			},
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateUnknownField[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	query := `
		SELECT
			alias,
			selections.type,
			json_group_array(
				json_object(
					'line', refs.row,
					'column', refs.column,
					'filepath', raw_documents.filepath
				)
			) AS locations
		FROM selections selections
			LEFT JOIN type_fields type_fields ON selections.type = type_fields.id
			JOIN selection_refs refs ON refs.child_id = selections.id
			JOIN documents ON refs.document = documents.id
			JOIN raw_documents ON raw_documents.id = documents.raw_document
		WHERE selections.kind = 'field' AND type_fields.id IS NULL
			AND (raw_documents.current_task = $task_id OR $task_id IS NULL)
		GROUP BY selections.id
	`

	err := db.StepQuery(ctx, query, nil, func(row *sqlite.Stmt) {
		alias := row.ColumnText(0)
		fieldType := strings.Split(row.ColumnText(1), ".")[0]

		// parse the locations into something we can use
		locations := []*plugins.ErrorLocation{}
		err := json.Unmarshal([]byte(row.ColumnText(2)), &locations)
		if err != nil {
			errs.Append(&plugins.Error{
				Message: "could not unmarshal locations",
				Detail:  err.Error(),
			})
		}

		errs.Append(&plugins.Error{
			Message:   fmt.Sprintf("'%s' does not exist on %s", alias, fieldType),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateIncompatibleFragmentSpread[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	query := `
	SELECT
		childSel.id AS fragmentSpreadId,
		parentTF.type AS parentFieldType,
		fragDoc.type_condition AS fragmentTypeCondition,
		-- Use the row and column from selection_refs for the error location.
		json_group_array(
		  json_object('line', refs.row, 'column', refs.column, 'filepath', raw_documents.filepath)
		) AS locations,
		-- LEFT JOIN possible_types on the fragment's declared type condition.
		COALESCE(json_group_array(possible_types.member), json('[]')) AS possible_types
	FROM selection_refs AS refs
		-- The fragment spread selection (child)
		JOIN selections AS childSel ON refs.child_id = childSel.id
		-- Join to fragment definition (documents) to get its declared type condition.
		JOIN documents AS fragDoc
			ON fragDoc.name = childSel.field_name
		   AND fragDoc.kind = 'fragment'
		-- The parent selection that contains the fragment spread.
		JOIN selections AS parentSel ON refs.parent_id = parentSel.id
		-- Resolve the parent's field type.
		JOIN type_fields AS parentTF ON parentSel.type = parentTF.id
		-- Get the document in which the fragment spread is used.
		JOIN documents AS doc ON doc.id = refs.document
		JOIN raw_documents ON raw_documents.id = doc.raw_document
		-- LEFT JOIN possible_types using the fragment's type condition.
		LEFT JOIN possible_types ON possible_types.type = fragDoc.type_condition
	WHERE childSel.kind = 'fragment'
			AND (raw_documents.current_task = $task_id OR $task_id IS NULL)
	GROUP BY childSel.id
	`

	err := db.StepQuery(ctx, query, nil, func(row *sqlite.Stmt) {
		parentFieldType := row.ColumnText(1)
		fragTypeCondition := row.ColumnText(2)
		locationsRaw := row.ColumnText(3)
		possibleTypesRaw := row.ColumnText(4)

		// Unmarshal the aggregated locations.
		locations := []*plugins.ErrorLocation{}
		if err := json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
			errs.Append(&plugins.Error{
				Message: "could not unmarshal locations for fragment spread",
				Detail:  err.Error(),
			})
			return
		}
		// (The file path is already included via the JSON object.)

		// Unmarshal possible types.
		possibleTypes := []string{}
		if err := json.Unmarshal([]byte(possibleTypesRaw), &possibleTypes); err != nil {
			errs.Append(&plugins.Error{
				Message: "could not unmarshal possible types for fragment spread",
				Detail:  err.Error(),
			})
			return
		}

		// Check compatibility:
		// A fragment spread is considered compatible if:
		//  - The fragment's declared type condition exactly equals the parent's resolved type, OR
		//  - The parent's resolved type appears in the list of possible types (i.e. the fragment type is an interface/union).
		compatible := (fragTypeCondition == parentFieldType)
		if !compatible && len(possibleTypes) > 0 {
			for _, pt := range possibleTypes {
				if pt == parentFieldType {
					compatible = true
					break
				}
			}
		}

		if !compatible {
			errs.Append(&plugins.Error{
				Message:   fmt.Sprintf("Fragment spread is incompatible: parent's type '%s' is not compatible with fragment type condition '%s'", parentFieldType, fragTypeCondition),
				Kind:      plugins.ErrorKindValidation,
				Locations: locations,
			})
		}
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateFragmentCycles[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	// a structure to hold a fragment dependency
	type edge struct {
		source   string                 // The container fragment definition name.
		target   string                 // The fragment that is referenced.
		location *plugins.ErrorLocation // Location of the fragment spread usage.
	}

	// SQL query to retrieve all edges where a fragment definition (container) uses a fragment spread.
	// We assume that a fragment definition is stored in the documents table with kind 'fragment'
	// and that fragment spreads in a fragment are recorded in selections (with kind 'fragment'),
	// where the field name of the selection is the referenced fragment's name.
	query := `
		SELECT
			containerDoc.name AS source,
			childFragDoc.name AS target,
			json_object(
				'line', refs.row,
				'column', refs.column,
				'filepath', raw_documents.filepath
			) AS location
		FROM selection_refs AS refs
			-- The container document is the one in which the fragment spread is used.
			JOIN documents AS containerDoc ON refs.document = containerDoc.id AND containerDoc.kind = 'fragment'
			-- The fragment spread selection (child) in the container.
			JOIN selections AS childSel ON refs.child_id = childSel.id AND childSel.kind = 'fragment'
			-- Look up the referenced fragment's definition.
			JOIN documents AS childFragDoc ON childFragDoc.name = childSel.field_name AND childFragDoc.kind = 'fragment'
			-- Retrieve the location from the container's raw document.
			JOIN raw_documents ON raw_documents.id = (SELECT raw_document FROM documents WHERE id = refs.document LIMIT 1)
		WHERE (raw_documents.current_task = $task_id OR $task_id IS NULL)
	`

	// accumulate the edges
	var edges []edge

	// run the query using our helper
	err := db.StepQuery(ctx, query, nil, func(row *sqlite.Stmt) {
		source := row.ColumnText(0)
		target := row.ColumnText(1)
		locJSON := row.ColumnText(2)
		var loc plugins.ErrorLocation
		if err := json.Unmarshal([]byte(locJSON), &loc); err != nil {
			// If we cannot unmarshal location data, skip this edge.
			errs.Append(&plugins.Error{
				Message: "could not unmarshal location for fragment dependency edge",
				Detail:  err.Error(),
			})
			return
		}
		edges = append(edges, edge{
			source:   source,
			target:   target,
			location: &loc,
		})
	})

	// build a dependency graph as a map from fragment name to its outgoing edges.
	graph := make(map[string][]edge)
	for _, e := range edges {
		graph[e.source] = append(graph[e.source], e)
		// ensure every target appears as a node (even if it has no outgoing edges).
		if _, ok := graph[e.target]; !ok {
			graph[e.target] = []edge{}
		}
	}

	// now perform a DFS on the graph to detect cycles. we'll record cycles as a slice of fragment names along with one representative location.
	var cycles []struct {
		cycle    []string
		location *plugins.ErrorLocation
	}

	visited := make(map[string]bool)
	onStack := make(map[string]bool)

	// DFS function that carries the current path.
	var dfs func(node string, path []string)
	dfs = func(node string, path []string) {
		visited[node] = true
		onStack[node] = true
		path = append(path, node)

		for _, e := range graph[node] {
			child := e.target
			// if we haven't seen the child yet, keep going
			if !visited[child] {
				dfs(child, path)
			} else if onStack[child] {
				// if we have seen the child, we found a cycle!
				var cycle []string

				// find the index where child first appeared in path.
				for i, frag := range path {
					if frag == child {
						cycle = append(cycle, path[i:]...)
						break
					}
				}

				// only record non-empty cycles.
				if len(cycle) > 0 {
					cycles = append(cycles, struct {
						cycle    []string
						location *plugins.ErrorLocation
					}{
						cycle:    cycle,
						location: e.location, // Use the location on the edge that closed the cycle.
					})
				}
			}
		}
		onStack[node] = false
	}

	// run DFS from every node.
	for node := range graph {
		if !visited[node] {
			dfs(node, []string{})
		}
	}

	// report an error for each detected cycle.
	for _, c := range cycles {
		cycleStr := strings.Join(c.cycle, " -> ") + " -> " + c.cycle[0]
		errs.Append(&plugins.Error{
			Message:   fmt.Sprintf("Fragment cycle detected: %s", cycleStr),
			Kind:      plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{c.location},
		})
	}
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateDuplicateVariables[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	query := `
		SELECT
			documents.name AS documentName,
			document_variables.name AS variableName,
			raw_documents.filepath,
			json_group_array(
				json_object(
					'line', raw_documents.offset_line,
					'column', raw_documents.offset_column
				)
			) AS locations
		FROM document_variables
			JOIN documents ON document_variables.document = documents.id
			JOIN raw_documents ON raw_documents.id = documents.raw_document
		WHERE (raw_documents.current_task = $task_id OR $task_id IS NULL)
		GROUP BY documents.id, document_variables.name
			HAVING COUNT(*) > 1
	`

	err := db.StepQuery(ctx, query, nil, func(row *sqlite.Stmt) {
		docName := row.ColumnText(0)
		varName := row.ColumnText(1)
		filepath := row.ColumnText(2)
		locationsRaw := row.ColumnText(3)

		var locations []*plugins.ErrorLocation
		if err := json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
			errs.Append(&plugins.Error{
				Message: fmt.Sprintf("could not unmarshal locations for duplicate variable '%s'", varName),
				Detail:  err.Error(),
			})
			return
		}

		// Set the file path for each location.
		for _, loc := range locations {
			loc.Filepath = filepath
		}

		errs.Append(&plugins.Error{
			Message:   fmt.Sprintf("Variable '$%s' is defined more than once in document '%s'", varName, docName),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateUndefinedVariables[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	query := `
	SELECT
		av.raw AS varUsage,
		r.filepath,
		json_group_array(
			json_object('line', r.offset_line, 'column', r.offset_column)
		) AS locations
	FROM selection_arguments sargs
		JOIN selections s ON sargs.selection_id = s.id
		JOIN selection_refs sr ON s.id = sr.child_id
		JOIN documents d ON sr.document = d.id
		JOIN raw_documents r ON r.id = d.raw_document
		JOIN argument_values av ON av.id = sargs.value
		LEFT JOIN document_variables opv
			ON opv.document = d.id
			AND opv.name = av.raw
	WHERE av.kind = 'Variable'
		AND opv.name IS NULL
		AND (r.current_task = $task_id OR $task_id IS NULL)
	GROUP BY d.id, av.raw
	`

	err := db.StepQuery(ctx, query, nil, func(row *sqlite.Stmt) {
		varUsage := row.ColumnText(0)
		filepath := row.ColumnText(1)
		locationsRaw := row.ColumnText(2)

		var locations []*plugins.ErrorLocation
		if err := json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
			errs.Append(&plugins.Error{
				Message: fmt.Sprintf("could not unmarshal locations for undefined variable '%s'", varUsage),
				Detail:  err.Error(),
			})
			return
		}

		// Set the file path from the raw document for each location.
		for _, loc := range locations {
			loc.Filepath = filepath
		}

		errs.Append(&plugins.Error{
			Message:   fmt.Sprintf("Variable '$%s' is used but not defined", varUsage),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateUnusedVariables[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	query := `
		SELECT
			document_variables."name",
			raw_documents.filepath,
			document_variables.row,
			document_variables."column"
		FROM document_variables
			JOIN documents ON document_variables.document = documents.id
			JOIN raw_documents ON documents.raw_document = raw_documents.id
			LEFT JOIN argument_values
				ON argument_values.document = documents.id
				AND argument_values.kind = 'Variable'
				AND argument_values.raw = document_variables."name"
		WHERE argument_values.document IS NULL
	`

	err := db.StepQuery(ctx, query, nil, func(stmt *sqlite.Stmt) {
		varName := stmt.ColumnText(0)
		filepath := stmt.ColumnText(1)
		row := stmt.ColumnInt(2)
		column := stmt.ColumnInt(3)

		errs.Append(&plugins.Error{
			Message:   fmt.Sprintf("Variable '$%s' is defined but never used", varName),
			Kind:      plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{{Filepath: filepath, Line: row, Column: column}},
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateRepeatingNonRepeatable[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	// This query finds fields where a non-repeatable directive is applied more than once.
	// We join selection_directives (alias sd) to selections (s), then to selection_refs (sr)
	// to obtain the document where the selection appears. That document (d) and its raw document (rd)
	// provide the file path and location information.
	// Finally, we join to the directives table (d2) to filter for non-repeatable directives.
	query := `
	SELECT
		sd.selection_id,
		sd.directive,
		d.id AS documentID,
		rd.filepath,
		json_group_array(
			json_object('line', sr.row, 'column', sr.column)
		) AS locations
	FROM selection_directives sd
		JOIN selections s ON s.id = sd.selection_id
		JOIN selection_refs sr ON sr.child_id = s.id
		JOIN documents d ON d.id = sr.document
		JOIN raw_documents rd ON rd.id = d.raw_document
		JOIN directives d2 ON sd.directive = d2.name
	WHERE d2.repeatable = 0
		AND (rd.current_task = $task_id OR $task_id IS NULL)
	GROUP BY sd.selection_id, sd.directive
	HAVING COUNT(*) > 1
	`

	err := db.StepQuery(ctx, query, nil, func(row *sqlite.Stmt) {
		selectionID := row.ColumnText(0)
		directive := row.ColumnText(1)
		documentID := row.ColumnText(2)
		filepath := row.ColumnText(3)
		locationsRaw := row.ColumnText(4)

		var locations []*plugins.ErrorLocation
		if err := json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
			errs.Append(&plugins.Error{
				Message: fmt.Sprintf("could not unmarshal locations for directive '@%s'", directive),
				Detail:  err.Error(),
			})
			return
		}

		// Assign the file path from the raw document to every location.
		for _, loc := range locations {
			loc.Filepath = filepath
		}

		errs.Append(&plugins.Error{
			Message:   fmt.Sprintf("Non-repeatable directive '@%s' is used more than once on selection %s in document %s", directive, selectionID, documentID),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}
func ValidateDuplicateArgumentInField[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	// This query finds cases where the same argument is provided more than once on a field.
	// We join selection_arguments (sargs) with selections (s), then via selection_refs (sr)
	// to determine the document (d) and its raw document (rd) for file path and location info.
	// We group by the selection id and argument name.
	query := `
	SELECT
	  sargs.selection_id,
	  sargs.name,
	  MIN(d.id) AS documentID,
	  MIN(rd.filepath) AS filepath,
	  MIN(sr.row) AS row,
	  MIN(sr.column) AS column,
	  COUNT(DISTINCT sargs.id) AS argCount
	FROM selection_arguments sargs
	  JOIN selections s ON sargs.selection_id = s.id
	  JOIN selection_refs sr ON sr.child_id = s.id
	  JOIN documents d ON d.id = sr.document
	  JOIN raw_documents rd ON rd.id = d.raw_document
	WHERE (rd.current_task = $task_id OR $task_id IS NULL)
	GROUP BY sargs.selection_id, sargs.name
	HAVING COUNT(DISTINCT sargs.id) > 1
	`

	err := db.StepQuery(ctx, query, nil, func(row *sqlite.Stmt) {
		selectionID := row.ColumnText(0)
		argName := row.ColumnText(1)
		filepath := row.ColumnText(2)
		rowNum := row.ColumnInt(4)
		colNum := row.ColumnInt(5)

		// Create a single error location from the representative row/column.
		loc := &plugins.ErrorLocation{
			Filepath: filepath,
			Line:     int(rowNum),
			Column:   int(colNum),
		}

		errs.Append(&plugins.Error{
			Message:   fmt.Sprintf("Argument '%s' is duplicated on selection '%s'", argName, selectionID),
			Kind:      plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{loc},
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}
func ValidateFieldArgumentIncompatibleType[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	// This query retrieves each field argument variable usage along with:
	//   - The expected type and modifiers (from the field argument definition).
	//   - The provided type and modifiers (from the operation variable definition).
	// We join through selection_refs (since selections don’t directly store a document id)
	// and use the normalized argument value (argument_values) for variable references.
	// A row is returned when the expected type (including non-null modifier) does not match
	// the provided variable type.
	query := `
	SELECT
		sa.selection_id,
		fad.name AS argName,
		fad.type AS expectedType,
		COALESCE(fad.type_modifiers, '') AS expectedModifiers,
		opv.type AS providedTypeRaw,
		COALESCE(opv.type_modifiers, '') AS providedModifiers,
		rd.filepath,
		json_group_array(
			json_object('line', sa.row, 'column', sa.column)
		) AS locations,
		av.raw AS varUsage
	FROM selection_arguments sa
		JOIN selections s ON sa.selection_id = s.id
		JOIN type_fields tf ON s.type = tf.id
		JOIN type_field_arguments fad ON fad.field = tf.id AND fad.name = sa.name
		JOIN selection_refs sr ON sr.child_id = s.id
		JOIN documents d ON d.id = sr.document
		JOIN raw_documents rd ON rd.id = d.raw_document
		JOIN argument_values av ON av.id = sa.value
		JOIN document_variables opv ON d.id = opv.document AND opv.name = av.raw
	WHERE (rd.current_task = $task_id OR $task_id IS NULL)
	GROUP BY sa.selection_id, fad.name
	HAVING (

			(
				fad."type" != opv."type"
				AND
				fad.type_modifiers != opv.type_modifiers
			)
	)
	`

	err := db.StepQuery(ctx, query, nil, func(row *sqlite.Stmt) {
		argName := row.ColumnText(1)
		expectedType := row.ColumnText(2)
		expectedModifiers := row.ColumnText(3)
		providedTypeRaw := row.ColumnText(4)
		providedModifiers := row.ColumnText(5)
		filepath := row.ColumnText(6)
		locationsRaw := row.ColumnText(7)

		var locations []*plugins.ErrorLocation
		if err := json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
			errs.Append(&plugins.Error{
				Message: fmt.Sprintf("could not unmarshal locations for argument '%s'", argName),
				Detail:  err.Error(),
			})
			return
		}
		for _, loc := range locations {
			loc.Filepath = filepath
		}

		errs.Append(&plugins.Error{
			Message: fmt.Sprintf(
				"Variable used for argument '%s' is incompatible: expected type '%s%s' but got '%s%s'",
				argName, expectedType, expectedModifiers, providedTypeRaw, providedModifiers),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateMissingRequiredArgument[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	query := `
	SELECT
		fad.name AS argName,
		rd.filepath,
		json_group_array(
			json_object('line', rd.offset_line, 'column', rd.offset_column)
		) AS locations
	FROM selections s
	  JOIN type_fields tf ON s.type = tf.id
	  JOIN type_field_arguments fad ON fad.field = tf.id
	  LEFT JOIN selection_arguments sa ON sa.selection_id = s.id AND sa.name = fad.name
	  JOIN selection_refs sr ON sr.child_id = s.id
	  JOIN documents d ON d.id = sr.document
	  JOIN raw_documents rd ON rd.id = d.raw_document
	WHERE fad.type_modifiers LIKE '%!'
	  AND sa.id IS NULL
	  AND (rd.current_task = $task_id OR $task_id IS NULL)
	GROUP BY s.id, fad.name
	`
	err := db.StepQuery(ctx, query, nil, func(row *sqlite.Stmt) {
		argName := row.ColumnText(0)
		filepath := row.ColumnText(1)
		locationsRaw := row.ColumnText(2)

		var locations []*plugins.ErrorLocation
		if err := json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
			errs.Append(&plugins.Error{
				Message: fmt.Sprintf("could not unmarshal locations for missing required argument '%s'", argName),
				Detail:  err.Error(),
			})
			return
		}

		// Assign the file path from the raw document to each location.
		for _, loc := range locations {
			loc.Filepath = filepath
		}

		errs.Append(&plugins.Error{
			Message:   fmt.Sprintf("Missing required argument '%s'", argName),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateConflictingSelections[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	// This query detects conflicting selections by grouping by the parent selection id (from selection_refs)
	// and the alias (from selections). If more than one distinct field type is used for the same alias,
	// we consider that a conflict.
	query := `
		SELECT
			sr.parent_id AS parentSelectionID,
			s.alias,
			json_group_array(s.field_name) AS conflictingFields,
			json_group_array(s.type) AS types,
			rd.filepath,
			json_group_array(
				json_object('line', sr.row, 'column', sr.column)
			) AS locations
		FROM selection_refs sr
			JOIN selections s ON sr.child_id = s.id
			JOIN documents d ON sr.document = d.id
			JOIN raw_documents rd ON rd.id = d.raw_document
		WHERE s.alias IS NOT NULL
			AND (rd.current_task = $task_id OR $task_id IS NULL)
		GROUP BY sr.parent_id, s.alias, d.id
		HAVING COUNT(DISTINCT s.type) > 1
	`

	err := db.StepQuery(ctx, query, nil, func(row *sqlite.Stmt) {
		parentSelectionID := row.ColumnText(0)
		alias := row.ColumnText(1)
		conflictingFields := row.ColumnText(2)
		types := row.ColumnText(3)
		filepath := row.ColumnText(4)
		locationsRaw := row.ColumnText(5)

		var locations []*plugins.ErrorLocation
		if err := json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
			errs.Append(&plugins.Error{
				Message: fmt.Sprintf("could not unmarshal locations for conflicting selections with alias '%s'", alias),
				Detail:  err.Error(),
			})
			return
		}
		for _, loc := range locations {
			loc.Filepath = filepath
		}

		errs.Append(&plugins.Error{
			Message:   fmt.Sprintf("Conflicting selections for alias '%s': fields %s have differing types %s (parent selection %s)", alias, conflictingFields, types, parentSelectionID),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateDuplicateKeysInInputObject[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	query := `
		SELECT
			av.id AS parentID,
			av.row AS parentRow,
			av.column AS parentColumn,
			av2.name AS keyName,
			COUNT(*) AS keyCount,
			rd.filepath
		FROM argument_values av
			JOIN argument_value_children av2 ON av2.parent = av.id
			JOIN selection_arguments sa ON sa.value = av.id
			JOIN selections s ON s.id = sa.selection_id
			JOIN selection_refs sr ON sr.child_id = s.id
			JOIN documents d ON d.id = sr.document
			JOIN raw_documents rd ON rd.id = d.raw_document
		WHERE av.kind = 'Object'
			AND av2.name IS NOT NULL
			AND (rd.current_task = $task_id OR $task_id IS NULL)
		GROUP BY av.id, av2.name
		HAVING COUNT(*) > 1
		`
	err := db.StepQuery(ctx, query, nil, func(row *sqlite.Stmt) {
		parentRow := row.ColumnInt(1)
		parentCol := row.ColumnInt(2)
		keyName := row.ColumnText(3)
		keyCount := row.ColumnInt(4)
		filepath := row.ColumnText(5)
		location := &plugins.ErrorLocation{
			Filepath: filepath,
			Line:     int(parentRow),
			Column:   int(parentCol),
		}
		errs.Append(&plugins.Error{
			Message:   fmt.Sprintf("Duplicate key '%s' appears %d times in an input object", keyName, keyCount),
			Kind:      plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{location},
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

// InputTypeDefinition describes an input object type.
type InputTypeDefinition struct {
	Name   string
	Fields map[string]*InputFieldDefinition
}

// InputFieldDefinition describes one field on an input object.
type InputFieldDefinition struct {
	Name         string
	ExpectedType string // e.g. "String", "Int", etc.
	Required     bool   // true if the field is non-null
	IsList       bool   // true if the field is defined as a list (derived from type_modifiers)
	// If the field itself is an input object, InputDef holds its definition.
	InputDef *InputTypeDefinition
}

// TypeModifiers represents the parsed structure of a modifier string.
// We assume the stored modifier string consists solely of closing brackets (']')
// and exclamation marks ('!'). For example, a modifier like "]!]]!]]" indicates
// five levels of nesting, with the outermost and third levels non-null.
type TypeModifiers struct {
	ListDepth     int
	NonNullLevels []bool // one per level, in order from outermost to innermost
}

// parseModifiers parses a modifier string (e.g. "]!]]!]]") into a structured form.
func parseModifiers(modifiers string) TypeModifiers {
	var tm TypeModifiers
	tm.NonNullLevels = []bool{}
	i := 0
	for i < len(modifiers) {
		if modifiers[i] == ']' {
			tm.ListDepth++
			nonNull := false
			if i+1 < len(modifiers) && modifiers[i+1] == '!' {
				nonNull = true
				i++ // Skip the '!'
			}
			tm.NonNullLevels = append(tm.NonNullLevels, nonNull)
		}
		i++
	}
	return tm
}

// loadUsedInputTypes loads only those input types that are used by structured arguments.
// It first queries for distinct expected input type names from structured arguments, then
// loads all matching type definitions (from the types table) and their fields (from type_fields).
func loadUsedInputTypes[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig]) (map[string]*InputTypeDefinition, error) {
	conn, err := db.Take(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Put(conn)

	// Step 1: Get distinct input type names used by structured arguments.
	distinctQuery := `
	SELECT DISTINCT fad.type AS expectedInputType
	FROM selection_arguments sargs
	  JOIN type_field_arguments fad ON fad.field = sargs.selection_id AND fad.name = sargs.name
	  JOIN argument_values av ON av.id = sargs.value
	WHERE av.kind = 'Object'
	`
	stmt, err := conn.Prepare(distinctQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare distinct types query: %w", err)
	}
	defer stmt.Finalize()

	usedTypes := make(map[string]bool)
	for {
		hasData, err := stmt.Step()
		if err != nil {
			return nil, fmt.Errorf("error stepping distinct types query: %w", err)
		}
		if !hasData {
			break
		}
		typ := stmt.ColumnText(0)
		usedTypes[typ] = true
	}
	// If none are used, return an empty map.
	if len(usedTypes) == 0 {
		return make(map[string]*InputTypeDefinition), nil
	}

	// Build an IN clause (e.g. "'TypeA','TypeB'")
	typeNames := []string{}
	for t := range usedTypes {
		typeNames = append(typeNames, fmt.Sprintf("'%s'", t))
	}
	inClause := strings.Join(typeNames, ",")

	// Step 2: Load input type definitions from the types table.
	typesQuery := fmt.Sprintf(`
		SELECT name FROM types
		WHERE name IN (%s) AND kind IN ('INPUT','INPUT_OBJECT')
	`, inClause)
	typesStmt, err := conn.Prepare(typesQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare types query: %w", err)
	}
	defer typesStmt.Finalize()

	typeDefs := make(map[string]*InputTypeDefinition)
	for {
		hasData, err := typesStmt.Step()
		if err != nil {
			return nil, fmt.Errorf("error stepping types query: %w", err)
		}
		if !hasData {
			break
		}
		name := typesStmt.ColumnText(0)
		typeDefs[name] = &InputTypeDefinition{
			Name:   name,
			Fields: make(map[string]*InputFieldDefinition),
		}
	}

	// Step 3: Load all fields for these types.
	fieldsQuery := fmt.Sprintf(`
		SELECT parent, name, type, type_modifiers
		FROM type_fields
		WHERE parent IN (%s)
	`, inClause)
	fieldsStmt, err := conn.Prepare(fieldsQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare fields query: %w", err)
	}
	defer fieldsStmt.Finalize()

	for {
		hasData, err := fieldsStmt.Step()
		if err != nil {
			return nil, fmt.Errorf("error stepping fields query: %w", err)
		}
		if !hasData {
			break
		}
		parent := fieldsStmt.ColumnText(0)
		fieldName := fieldsStmt.ColumnText(1)
		fieldType := fieldsStmt.ColumnText(2)
		modifiers := fieldsStmt.ColumnText(3)

		tm := parseModifiers(modifiers)
		isList := tm.ListDepth > 0
		required := false
		if len(tm.NonNullLevels) > 0 {
			required = tm.NonNullLevels[0]
		}

		fieldDef := &InputFieldDefinition{
			Name:         fieldName,
			ExpectedType: fieldType,
			Required:     required,
			IsList:       isList,
		}
		if parentDef, ok := typeDefs[parent]; ok {
			parentDef.Fields[fieldName] = fieldDef
		}
	}

	// Step 4: For each field whose ExpectedType is itself an input type, set its InputDef.
	for _, typeDef := range typeDefs {
		for _, fieldDef := range typeDef.Fields {
			if nested, ok := typeDefs[fieldDef.ExpectedType]; ok {
				fieldDef.InputDef = nested
			}
		}
	}

	return typeDefs, nil
}

// validateScalar checks that a scalar value conforms to the expected GraphQL scalar type.
func validateScalar(value interface{}, expectedType, path string) *plugins.Error {
	switch expectedType {
	case "String", "ID":
		if _, ok := value.(string); !ok {
			return &plugins.Error{
				Message: fmt.Sprintf("Field '%s' should be a String", path),
				Kind:    plugins.ErrorKindValidation,
			}
		}
	case "Int":
		if num, ok := value.(float64); !ok || num != float64(int(num)) {
			return &plugins.Error{
				Message: fmt.Sprintf("Field '%s' should be an Int", path),
				Kind:    plugins.ErrorKindValidation,
			}
		}
	case "Float":
		if _, ok := value.(float64); !ok {
			return &plugins.Error{
				Message: fmt.Sprintf("Field '%s' should be a Float", path),
				Kind:    plugins.ErrorKindValidation,
			}
		}
	case "Boolean":
		if _, ok := value.(bool); !ok {
			return &plugins.Error{
				Message: fmt.Sprintf("Field '%s' should be a Boolean", path),
				Kind:    plugins.ErrorKindValidation,
			}
		}
	default:
		// Custom scalars: add custom validation logic if needed.
	}
	return nil
}

func ValidateWrongTypesToArg[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	// every argument value contains the type that it should be so we need to look at every scalar
	// usage and make sure that it matches with the expectations
	query := `
		SELECT
			raw_documents.filepath,
			argument_values.row,
			argument_values.column,
			COALESCE(selection_arguments.name, selection_directive_arguments.name, argument_value_children.name) AS argument_name,
			argument_values.expected_type,
			argument_values.expected_type_modifiers,
			argument_values.kind
		FROM argument_values
		JOIN documents on argument_values."document" = documents.id
		JOIN raw_documents on documents.raw_document = raw_documents.id

		LEFT JOIN types ON argument_values.expected_type = types.name
		LEFT JOIN document_variables
			ON argument_values.kind = 'Variable'
			AND argument_values.document = document_variables.document
			AND argument_values.raw = document_variables."name"
		LEFT JOIN selection_arguments
			ON argument_values.id = selection_arguments.value
		LEFT JOIN selection_directive_arguments
			ON argument_values.id = selection_directive_arguments.value
		LEFT JOIN argument_value_children
			ON argument_values.id = argument_value_children.value
		LEFT JOIN enum_values ev
			ON argument_values.kind = 'Enum'
			AND argument_values.expected_type = ev.parent
			AND argument_values.raw = ev.value

		WHERE
			raw_documents.current_task = $task_id OR $task_id IS NULL

			AND (
			-- For non-variable, non-null kinds that are scalar or enum:
			-- invalid if the expected_type_modifiers contains a ']' or the kind !=
			(
				argument_values.kind NOT IN ('Variable', 'Null',  'ENUM')
				AND types.kind = 'SCALAR'
				AND (
					argument_values.expected_type_modifiers LIKE '%]%'
					OR (
						argument_values.kind <> argument_values.expected_type
						AND NOT (
							argument_values.kind IN ('ID','String', 'Int')
							AND argument_values.expected_type = 'ID'
						)
					)
				)
			)

			OR

			-- if the argument kind is an object but the expected type modifiers have a list in it, there's a problem
			(
				argument_values.kind = 'Object'
				AND argument_values.expected_type_modifiers LIKE '%]]%'
			)

			OR

			-- if the argument kind is a list and there are no list modifiers

			(
				argument_values.kind = 'List'
				AND argument_values.expected_type_modifiers NOT LIKE '%]'
			)

			OR

			-- For enum kinds: invalid if the expected modifiers contain a ']' or if no matching enum value is found.
			(
				argument_values.kind = 'Enum'
				AND (
					argument_values.expected_type_modifiers LIKE '%]%'
					OR ev.value IS NULL
				)
			)
			OR

			-- For Null kinds: invalid if the expected_type_modifiers end with '!'
			(
				argument_values.kind = 'Null'
				AND argument_values.expected_type_modifiers LIKE '%!'
			)

			OR

			-- For Variable kinds: compare the variable's modifiers to the expected modifiers,
			-- but allow the case where the variable's modifiers end with '!' and, when removed, match.
			(
				argument_values.kind = 'Variable'
				AND NOT (
					document_variables.type_modifiers = argument_values.expected_type_modifiers
					OR (document_variables.type_modifiers LIKE '%!'
						AND SUBSTR(document_variables.type_modifiers, 1, LENGTH(document_variables.type_modifiers) - 1) = argument_values.expected_type_modifiers)
				)
			)
		)
	`

	err := db.StepQuery(ctx, query, nil, func(stmt *sqlite.Stmt) {
		filepath := stmt.ColumnText(0)
		row := stmt.ColumnInt(1)
		column := stmt.ColumnInt(2)
		argumentName := stmt.ColumnText(3)
		kind := stmt.ColumnText(6)

		// Create a single error location from the representative row/column.
		loc := &plugins.ErrorLocation{
			Filepath: filepath,
			Line:     row,
			Column:   column,
		}

		// we want to show [[User!]!] instead of User!]!]
		expectedType := stmt.ColumnText(4) + stmt.ColumnText(5)
		for range strings.Count(expectedType, "]") {
			expectedType = "[" + expectedType
		}

		if expectedType == "" {
			errs.Append(&plugins.Error{
				Message:   fmt.Sprintf("Unexpected field in '%s'", argumentName),
				Kind:      plugins.ErrorKindValidation,
				Locations: []*plugins.ErrorLocation{loc},
			})
			return
		}

		errs.Append(&plugins.Error{
			Message:   fmt.Sprintf("Argument '%s' has the wrong type: expected '%s', received %s", argumentName, expectedType, kind),
			Kind:      plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{loc},
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateNoKeyAlias[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
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
			AND (rd.current_task = $task_id OR $task_id IS NULL)
		AND s.alias <> s.field_name
		GROUP BY s.alias, t.name, rd.filepath
	`

	err := db.StepQuery(ctx, query, nil, func(stmt *sqlite.Stmt) {
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

		errs.Append(&plugins.Error{
			Message:   fmt.Sprintf("Alias '%s' is not allowed because it conflicts with a key for type '%s'", alias, typeName),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateKnownDirectiveArguments[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
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
			AND (rd.current_task = $task_id OR $task_id IS NULL)

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
			AND (rd.current_task = $task_id OR $task_id IS NULL)
		)
	`

	err := db.StepQuery(ctx, query, nil, func(row *sqlite.Stmt) {
		directive := row.ColumnText(0)
		argName := row.ColumnText(1)
		filepath := row.ColumnText(2)
		line := int(row.ColumnInt(3))
		column := int(row.ColumnInt(4))

		errs.Append(&plugins.Error{
			Message: fmt.Sprintf("Unknown argument '%s' used with directive '@%s'", argName, directive),
			Kind:    plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{{
				Filepath: filepath,
				Line:     line,
				Column:   column,
			}},
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateUnknownFieldArguments[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	// we are looking for field arguments that are not known to the schema
	query := `
		SELECT
			selection_arguments.name,
			selection_arguments.row,
			selection_arguments.column,
			raw_documents.filepath
		FROM
			selection_arguments
			LEFT JOIN type_field_arguments on selection_arguments.field_argument = type_field_arguments.id
			JOIN selections on selection_arguments.selection_id = selections.id
			JOIN selection_refs on selections.id = selection_refs.child_id
			JOIN documents on selection_refs.document = documents.id
			JOIN raw_documents on documents.raw_document = raw_documents.id
		WHERE
			type_field_arguments.id IS NULL
			AND (raw_documents.current_task = $task_id OR $task_id IS NULL)
	`

	err := db.StepQuery(ctx, query, nil, func(stmt *sqlite.Stmt) {
		argName := stmt.ColumnText(0)
		row := int(stmt.ColumnInt(1))
		col := int(stmt.ColumnInt(2))
		filepath := stmt.ColumnText(3)

		errs.Append(&plugins.Error{
			Message: fmt.Sprintf("Unknown field argument '%s'", argName),
			Kind:    plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{{
				Filepath: filepath,
				Line:     row,
				Column:   col,
			}},
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateMaskDirectives[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
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
			AND sd.directive IN ($enable_directive, $disable_directive)
			AND (rd.current_task = $task_id OR $task_id IS NULL)
		GROUP BY s.id
		HAVING COUNT(DISTINCT sd.directive) > 1
	`
	bindings := map[string]interface{}{
		"enable_directive":  schema.EnableMaskDirective,
		"disable_directive": schema.DisableMaskDirective,
	}
	err := db.StepQuery(ctx, query, bindings, func(stmt *sqlite.Stmt) {
		filepath := stmt.ColumnText(1)
		row := int(stmt.ColumnInt(2))
		column := int(stmt.ColumnInt(3))

		errs.Append(&plugins.Error{
			Message: fmt.Sprintf("You can't apply both @%s and @%s on the same fragment spread", schema.EnableMaskDirective, schema.DisableMaskDirective),
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
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateLoadingDirective[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
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
	  LEFT JOIN selection_directives pd ON pd.selection_id = sr.parent_id AND pd.directive = $loading_directive
	WHERE sd.directive = $loading_directive
	  AND s.kind IN ('field', 'fragment')
	  AND sr.parent_id IS NOT NULL
	  AND pd.directive IS NULL
	  AND d.id NOT IN (
	    SELECT d2.id
	    FROM documents d2
	    JOIN document_directives dd ON d2.id = dd.document
	    WHERE dd.directive = $loading_directive
	  )
		AND (rd.current_task = $task_id OR $task_id IS NULL)
	`
	bindings := map[string]interface{}{
		"loading_directive": schema.LoadingDirective,
	}

	err := db.StepQuery(ctx, query, bindings, func(stmt *sqlite.Stmt) {
		filepath := stmt.ColumnText(2)
		row := int(stmt.ColumnInt(3))
		column := int(stmt.ColumnInt(4))

		errs.Append(&plugins.Error{
			Message: fmt.Sprintf("@%s can only be applied at the root of a document or on a field/fragment spread whose parent also has @%s", schema.LoadingDirective, schema.LoadingDirective),
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
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateRequiredDirective[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	// This query selects all field selections that have the required directive,
	// along with:
	//  - The field's name.
	//  - The field definition's type_modifiers.
	//  - The parent's type kind.
	//  - Location info (from raw_documents via selection_refs).
	//  - The document name.
	//  - An aggregated count of child selections that have the required directive.
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
		ON sr_child.child_id = sd_child.selection_id AND sd_child.directive = $required_directive
	WHERE sd.directive = $required_directive
		AND (rd.current_task = $task_id OR $task_id IS NULL)
	GROUP BY s.id, s.field_name, tf.type_modifiers, t.kind, rd.filepath, sr.row, sr.column, d.name
	`

	bindings := map[string]interface{}{
		"required_directive": schema.RequiredDirective,
	}

	err := db.StepQuery(ctx, query, bindings, func(stmt *sqlite.Stmt) {
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
			errs.Append(&plugins.Error{
				Message: fmt.Sprintf("@%s may only be used on object fields, not on fields of %s type (field %q in document %s)", schema.RequiredDirective, parentKind, fieldName, docName),
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
			errs.Append(&plugins.Error{
				Message: fmt.Sprintf("@%s may only be used on fields that are nullable on the server or on fields whose child selections already carry @%s (field %q in document %s)", schema.RequiredDirective, schema.RequiredDirective, fieldName, docName),
				Kind:    plugins.ErrorKindValidation,
				Locations: []*plugins.ErrorLocation{
					{Filepath: filepath, Line: row, Column: column},
				},
			})
		}
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateOptimisticKeyOnScalar[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
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
	WHERE sd.directive = $optimistic_key_directive
	  AND t.kind != 'SCALAR'
	  AND (rd.current_task = $task_id OR $task_id IS NULL)
	`
	bindings := map[string]interface{}{
		"optimistic_key_directive": schema.OptimisticKeyDirective,
	}

	err := db.StepQuery(ctx, query, bindings, func(stmt *sqlite.Stmt) {
		fieldTypeKind := stmt.ColumnText(6)
		filepath := stmt.ColumnText(2)
		row := int(stmt.ColumnInt(3))
		column := int(stmt.ColumnInt(4))
		fieldName := stmt.ColumnText(1)
		docName := stmt.ColumnText(5)

		errs.Append(&plugins.Error{
			Message: fmt.Sprintf("@%s can only be applied on scalar fields, but field %q in document %q has type kind %q", schema.OptimisticKeyDirective, fieldName, docName, fieldTypeKind),
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

func ValidateOptimisticKeyFullSelection[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList) {
	optimisticDirective := schema.OptimisticKeyDirective

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
	WHERE sd.directive = $optimistic_key_directive
	  AND sr.parent_id IS NOT NULL
	  AND sp.kind = 'field'
	  AND (rd.current_task = $task_id OR $task_id IS NULL)
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

	stmt.SetText("$optimistic_key_directive", optimisticDirective)

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
			errs.Append(&plugins.Error{
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
			errs.Append(&plugins.Error{
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
			errs.Append(&plugins.Error{
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
				errs.Append(&plugins.Error{
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
