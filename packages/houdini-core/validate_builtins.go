// this file contains implementations for the default validators included in graphql-js

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"code.houdinigraphql.com/plugins"
	"zombiezen.com/go/sqlite"
)

func (p *HoudiniCore) validate_subscriptionsWithMultipleRootFields(ctx context.Context, errs *plugins.ErrorList) {
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
		GROUP BY documents.id, documents.name HAVING COUNT(*) > 1
	`
	p.runValidationQuery(ctx, queryStr, "could not validate subscriptions with multiple root fields", errs, func(q *sqlite.Stmt) {
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
		errs.Append(plugins.Error{
			Message:   "subscriptions can only have a single root field",
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
}

func (p *HoudiniCore) validate_duplicateDocumentNames(ctx context.Context, errs *plugins.ErrorList) {
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
		GROUP BY documents.name
		HAVING COUNT(*) > 1
	`
	p.runValidationQuery(ctx, queryStr, "could not validate duplicate document names", errs, func(q *sqlite.Stmt) {
		docName := q.ColumnText(0)
		locationsRaw := q.ColumnText(1)

		locations := []*plugins.ErrorLocation{}
		if err := json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
			errs.Append(plugins.WrapError(fmt.Errorf("error unmarshaling locations for document '%s': %v. Raw: %s", docName, err, locationsRaw)))
			return
		}
		errs.Append(plugins.Error{
			Message:   fmt.Sprintf("duplicate document name: %s", docName),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
}

func (p *HoudiniCore) validate_fragmentUnknownType(ctx context.Context, errs *plugins.ErrorList) {
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
		GROUP BY documents.id
	`
	p.runValidationQuery(ctx, queryStr, "could not validate fragment type condition", errs, func(query *sqlite.Stmt) {
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

		errs.Append(plugins.Error{
			Message:   fmt.Sprintf("Fragment '%s' references an unknown type '%s'", fragName, typeCond),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
}

func (p *HoudiniCore) validate_fragmentOnScalar(ctx context.Context, errs *plugins.ErrorList) {
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
		GROUP BY documents.id
	`
	p.runValidationQuery(ctx, queryStr, "could not validate fragment on scalars", errs, func(row *sqlite.Stmt) {
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
		errs.Append(plugins.Error{
			Message:   fmt.Sprintf("Fragment '%s' is defined on a scalar type '%s'", fragName, typeCond),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
}

func (p *HoudiniCore) validate_outputTypeAsInput(ctx context.Context, errs *plugins.ErrorList) {
	queryStr := `
		SELECT
			operation_variables.name,
			operation_variables.type,
			raw_documents.filepath,
			raw_documents.offset_line,
			raw_documents.offset_column
		FROM operation_variables
			JOIN documents ON operation_variables.document = documents.id
			JOIN raw_documents ON raw_documents.id = documents.raw_document
			JOIN types ON operation_variables.type = types.name
		WHERE types.kind in ('OBJECT', 'INTERFACE', 'UNION')
	`
	p.runValidationQuery(ctx, queryStr, "could not validate operation variable types", errs, func(row *sqlite.Stmt) {
		varName := row.ColumnText(0)
		varType := row.ColumnText(1)
		filepath := row.ColumnText(2)
		line := row.ColumnInt(3)
		column := row.ColumnInt(4)

		errs.Append(plugins.Error{
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
}

func (p *HoudiniCore) validate_scalarWithSelection(ctx context.Context, errs *plugins.ErrorList) {
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
	`
	p.runValidationQuery(ctx, queryStr, "error checking for selections with selections", errs, func(row *sqlite.Stmt) {
		alias := row.ColumnText(0)
		filepath := row.ColumnText(1)
		line := row.ColumnInt(2)
		column := row.ColumnInt(3)

		errs.Append(plugins.Error{
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
}

func (p *HoudiniCore) validate_unknownField(ctx context.Context, errs *plugins.ErrorList) {
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
		GROUP BY selections.id
	`

	p.runValidationQuery(ctx, query, "error checking for selections with selections", errs, func(row *sqlite.Stmt) {
		alias := row.ColumnText(0)
		fieldType := strings.Split(row.ColumnText(1), ".")[0]

		// parse the locations into something we can use
		locations := []*plugins.ErrorLocation{}
		err := json.Unmarshal([]byte(row.ColumnText(2)), &locations)
		if err != nil {
			errs.Append(plugins.Error{
				Message: "could not unmarshal locations",
				Detail:  err.Error(),
			})
		}

		errs.Append(plugins.Error{
			Message:   fmt.Sprintf("'%s' does not exist on %s", alias, fieldType),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
}

func (p *HoudiniCore) validate_incompatibleFragmentSpread(ctx context.Context, errs *plugins.ErrorList) {
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
	GROUP BY childSel.id
	`

	p.runValidationQuery(ctx, query, "error checking incompatible fragment spreads", errs, func(row *sqlite.Stmt) {
		fragSpreadID := row.ColumnText(0)
		parentFieldType := row.ColumnText(1)
		fragTypeCondition := row.ColumnText(2)
		locationsRaw := row.ColumnText(3)
		possibleTypesRaw := row.ColumnText(4)

		// Unmarshal the aggregated locations.
		locations := []*plugins.ErrorLocation{}
		if err := json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
			errs.Append(plugins.Error{
				Message: "could not unmarshal locations for fragment spread",
				Detail:  err.Error(),
			})
			return
		}
		// (The file path is already included via the JSON object.)

		// Unmarshal possible types.
		possibleTypes := []string{}
		if err := json.Unmarshal([]byte(possibleTypesRaw), &possibleTypes); err != nil {
			errs.Append(plugins.Error{
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
			errs.Append(plugins.Error{
				Message:   fmt.Sprintf("Fragment spread '%s' is incompatible: parent's type '%s' is not compatible with fragment type condition '%s'", fragSpreadID, parentFieldType, fragTypeCondition),
				Kind:      plugins.ErrorKindValidation,
				Locations: locations,
			})
		}
	})
}

func (p *HoudiniCore) validate_fragmentCycles(ctx context.Context, errs *plugins.ErrorList) {
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
	`

	// accumulate the edges
	var edges []edge

	// run the query using our helper
	p.runValidationQuery(ctx, query, "error fetching fragment dependency edges", errs, func(row *sqlite.Stmt) {
		source := row.ColumnText(0)
		target := row.ColumnText(1)
		locJSON := row.ColumnText(2)
		var loc plugins.ErrorLocation
		if err := json.Unmarshal([]byte(locJSON), &loc); err != nil {
			// If we cannot unmarshal location data, skip this edge.
			errs.Append(plugins.Error{
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
		errs.Append(plugins.Error{
			Message:   fmt.Sprintf("Fragment cycle detected: %s", cycleStr),
			Kind:      plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{c.location},
		})
	}
}

func (p *HoudiniCore) validate_duplicateVariables(ctx context.Context, errs *plugins.ErrorList) {
	query := `
		SELECT
			documents.name AS documentName,
			operation_variables.name AS variableName,
			raw_documents.filepath,
			json_group_array(
				json_object(
					'line', raw_documents.offset_line,
					'column', raw_documents.offset_column
				)
			) AS locations
		FROM operation_variables
		JOIN documents ON operation_variables.document = documents.id
		JOIN raw_documents ON raw_documents.id = documents.raw_document
		GROUP BY documents.id, operation_variables.name
		HAVING COUNT(*) > 1
	`

	p.runValidationQuery(ctx, query, "error checking for duplicate variables", errs, func(row *sqlite.Stmt) {
		docName := row.ColumnText(0)
		varName := row.ColumnText(1)
		filepath := row.ColumnText(2)
		locationsRaw := row.ColumnText(3)

		var locations []*plugins.ErrorLocation
		if err := json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
			errs.Append(plugins.Error{
				Message: fmt.Sprintf("could not unmarshal locations for duplicate variable '%s'", varName),
				Detail:  err.Error(),
			})
			return
		}

		// Set the file path for each location.
		for _, loc := range locations {
			loc.Filepath = filepath
		}

		errs.Append(plugins.Error{
			Message:   fmt.Sprintf("Variable '$%s' is defined more than once in document '%s'", varName, docName),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
}

func (p *HoudiniCore) validate_undefinedVariables(ctx context.Context, errs *plugins.ErrorList) {
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
		LEFT JOIN operation_variables opv
			ON opv.document = d.id
			AND opv.name = av.raw
	WHERE av.kind = 'Variable'
		AND d.kind IN ('query', 'mutation', 'subscription')
		AND opv.name IS NULL
	GROUP BY d.id, av.raw
	`

	p.runValidationQuery(ctx, query, "error checking for undefined variables", errs, func(row *sqlite.Stmt) {
		varUsage := row.ColumnText(0)
		filepath := row.ColumnText(1)
		locationsRaw := row.ColumnText(2)

		var locations []*plugins.ErrorLocation
		if err := json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
			errs.Append(plugins.Error{
				Message: fmt.Sprintf("could not unmarshal locations for undefined variable '%s'", varUsage),
				Detail:  err.Error(),
			})
			return
		}

		// Set the file path from the raw document for each location.
		for _, loc := range locations {
			loc.Filepath = filepath
		}

		errs.Append(plugins.Error{
			Message:   fmt.Sprintf("Variable '$%s' is used but not defined", varUsage),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
}

func (p *HoudiniCore) validate_unusedVariables(ctx context.Context, errs *plugins.ErrorList) {
	query := `
		SELECT
			opv.name,
			d.name AS documentName,
			r.filepath,
			COALESCE(
			json_group_array(
				json_object('line', refs.row, 'column', refs.column)
			),
			json('[]')
			) AS locations
		FROM operation_variables opv
			JOIN documents d ON opv.document = d.id
			JOIN raw_documents r ON r.id = d.raw_document
			LEFT JOIN selection_refs refs ON refs.document = d.id
			LEFT JOIN selection_arguments sargs ON sargs.selection_id = refs.child_id
			LEFT JOIN argument_values av
			ON av.id = sargs.value
				AND av.kind = 'Variable'
				AND av.raw = opv.name
		WHERE d.kind IN ('query', 'mutation', 'subscription')
		GROUP BY opv.id
		HAVING COUNT(av.id) = 0
	`

	p.runValidationQuery(ctx, query, "error checking for unused variables", errs, func(row *sqlite.Stmt) {
		varName := row.ColumnText(0)
		docName := row.ColumnText(1)
		filepath := row.ColumnText(2)
		locationsRaw := row.ColumnText(3)

		var locations []*plugins.ErrorLocation
		if err := json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
			errs.Append(plugins.Error{
				Message: fmt.Sprintf("could not unmarshal locations for unused variable '%s'", varName),
				Detail:  err.Error(),
			})
			return
		}

		// Set the file path from the raw document for each location.
		for _, loc := range locations {
			loc.Filepath = filepath
		}

		errs.Append(plugins.Error{
			Message:   fmt.Sprintf("Variable '$%s' is defined in document '%s' but never used", varName, docName),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
}

func (p *HoudiniCore) validate_unknownDirective(ctx context.Context, errs *plugins.ErrorList) {
	// unknownDirectiveUsage holds a single usage of a directive that was not defined.
	type unknownDirectiveUsage struct {
		directive  string
		documentID string
		filepath   string
		location   *plugins.ErrorLocation
	}
	var usages []unknownDirectiveUsage

	// Open a connection.
	conn, err := p.DB.Take(ctx)
	if err != nil {
		errs.Append(plugins.Error{
			Message: "could not open connection (unknownDirective)",
			Detail:  err.Error(),
		})
		return
	}
	defer p.DB.Put(conn)

	// Query for unknown directives in selection_directives.
	querySelection := `
	SELECT
		sd.directive,
		d.id AS documentID,
		rd.filepath,
		sd.row,
		sd.column
	FROM selection_directives sd
		JOIN selections s ON s.id = sd.selection_id
		JOIN selection_refs sr ON sr.child_id = s.id
		JOIN documents d ON d.id = sr.document
		JOIN raw_documents rd ON rd.id = d.raw_document
		LEFT JOIN directives dir ON sd.directive = dir.name
	WHERE dir.name IS NULL
	GROUP BY sd.directive, d.id, sd.row, sd.column
	`
	stmtSel, err := conn.Prepare(querySelection)
	if err != nil {
		errs.Append(plugins.Error{
			Message: "error preparing unknown directive query (selection_directives)",
			Detail:  err.Error(),
		})
		return
	}
	defer stmtSel.Finalize()

	for {
		hasData, err := stmtSel.Step()
		if err != nil {
			errs.Append(plugins.Error{
				Message: "error stepping through unknown directive query (selection_directives)",
				Detail:  err.Error(),
			})
			break
		}
		if !hasData {
			break
		}
		usages = append(usages, unknownDirectiveUsage{
			directive:  stmtSel.ColumnText(0),
			documentID: stmtSel.ColumnText(1),
			filepath:   stmtSel.ColumnText(2),
			location: &plugins.ErrorLocation{
				Line:   int(stmtSel.ColumnInt(3)),
				Column: int(stmtSel.ColumnInt(4)),
			},
		})
	}

	// Query for unknown directives in document_directives.
	queryDocument := `
		SELECT
			dd.directive,
			d.id AS documentID,
			rd.filepath,
			dd.row,
			dd.column
		FROM document_directives dd
			JOIN documents d ON d.id = dd.document
			JOIN raw_documents rd ON rd.id = d.raw_document
			LEFT JOIN directives dir ON dd.directive = dir.name
		WHERE dir.name IS NULL
		GROUP BY dd.directive, d.id
	`
	stmtDoc, err := conn.Prepare(queryDocument)
	if err != nil {
		errs.Append(plugins.Error{
			Message: "error preparing unknown directive query (document_directives)",
			Detail:  err.Error(),
		})
		return
	}
	defer stmtDoc.Finalize()

	for {
		hasData, err := stmtDoc.Step()
		if err != nil {
			errs.Append(plugins.Error{
				Message: "error stepping through unknown directive query (document_directives)",
				Detail:  err.Error(),
			})
			break
		}
		if !hasData {
			break
		}
		usages = append(usages, unknownDirectiveUsage{
			directive:  stmtDoc.ColumnText(0),
			documentID: stmtDoc.ColumnText(1),
			filepath:   stmtDoc.ColumnText(2),
			location: &plugins.ErrorLocation{
				Line:   int(stmtDoc.ColumnInt(3)), // will be 0
				Column: int(stmtDoc.ColumnInt(4)), // will be 0
			},
		})
	}

	// Report errors for each usage.
	for _, usage := range usages {
		errs.Append(plugins.Error{
			Message:   fmt.Sprintf("Unknown directive '@%s' used in document '%s'", usage.directive, usage.documentID),
			Kind:      plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{usage.location},
		})
	}
}

func (p *HoudiniCore) validate_repeatingNonRepeatable(ctx context.Context, errs *plugins.ErrorList) {
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
	GROUP BY sd.selection_id, sd.directive
	HAVING COUNT(*) > 1
	`

	p.runValidationQuery(ctx, query, "error checking for repeating non-repeatable directives", errs, func(row *sqlite.Stmt) {
		selectionID := row.ColumnText(0)
		directive := row.ColumnText(1)
		documentID := row.ColumnText(2)
		filepath := row.ColumnText(3)
		locationsRaw := row.ColumnText(4)

		var locations []*plugins.ErrorLocation
		if err := json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
			errs.Append(plugins.Error{
				Message: fmt.Sprintf("could not unmarshal locations for directive '@%s'", directive),
				Detail:  err.Error(),
			})
			return
		}

		// Assign the file path from the raw document to every location.
		for _, loc := range locations {
			loc.Filepath = filepath
		}

		errs.Append(plugins.Error{
			Message:   fmt.Sprintf("Non-repeatable directive '@%s' is used more than once on selection %s in document %s", directive, selectionID, documentID),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
}
func (p *HoudiniCore) validate_duplicateArgumentInField(ctx context.Context, errs *plugins.ErrorList) {
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
	GROUP BY sargs.selection_id, sargs.name
	HAVING COUNT(DISTINCT sargs.id) > 1
	`

	p.runValidationQuery(ctx, query, "error checking for duplicate arguments on a field", errs, func(row *sqlite.Stmt) {
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

		errs.Append(plugins.Error{
			Message:   fmt.Sprintf("Argument '%s' is duplicated on selection '%s'", argName, selectionID),
			Kind:      plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{loc},
		})
	})
}
func (p *HoudiniCore) validate_fieldArgumentIncompatibleType(ctx context.Context, errs *plugins.ErrorList) {
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
			json_object('line', rd.offset_line, 'column', rd.offset_column)
		) AS locations,
		av.raw AS varUsage
	FROM selection_arguments sa
		JOIN selections s ON sa.selection_id = s.id
		JOIN type_fields tf ON s.type = tf.id
		JOIN field_argument_definitions fad ON fad.field = tf.id AND fad.name = sa.name
		JOIN selection_refs sr ON sr.child_id = s.id
		JOIN documents d ON d.id = sr.document
		JOIN raw_documents rd ON rd.id = d.raw_document
		JOIN argument_values av ON av.id = sa.value
		JOIN operation_variables opv ON d.id = opv.document AND opv.name = av.raw
	GROUP BY sa.selection_id, fad.name
	HAVING NOT (
		  fad.type = opv.type
		  AND (
			   (COALESCE(fad.type_modifiers, '') = '!' AND COALESCE(opv.type_modifiers, '') = '!')
			   OR (COALESCE(fad.type_modifiers, '') = '' AND COALESCE(opv.type_modifiers, '') IN ('','!'))
		  )
	)
	`

	p.runValidationQuery(ctx, query, "error checking field argument incompatible type", errs, func(row *sqlite.Stmt) {
		argName := row.ColumnText(1)
		expectedType := row.ColumnText(2)
		expectedModifiers := row.ColumnText(3)
		providedTypeRaw := row.ColumnText(4)
		providedModifiers := row.ColumnText(5)
		filepath := row.ColumnText(6)
		locationsRaw := row.ColumnText(7)

		var locations []*plugins.ErrorLocation
		if err := json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
			errs.Append(plugins.Error{
				Message: fmt.Sprintf("could not unmarshal locations for argument '%s'", argName),
				Detail:  err.Error(),
			})
			return
		}
		for _, loc := range locations {
			loc.Filepath = filepath
		}

		errs.Append(plugins.Error{
			Message: fmt.Sprintf(
				"Variable used for argument '%s' is incompatible: expected type '%s%s' but got '%s%s'",
				argName, expectedType, expectedModifiers, providedTypeRaw, providedModifiers),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
}

func (p *HoudiniCore) validate_missingRequiredArgument(ctx context.Context, errs *plugins.ErrorList) {
	query := `
	SELECT
		fad.name AS argName,
		rd.filepath,
		json_group_array(
			json_object('line', rd.offset_line, 'column', rd.offset_column)
		) AS locations
	FROM selections s
	  JOIN type_fields tf ON s.type = tf.id
	  JOIN field_argument_definitions fad ON fad.field = tf.id
	  LEFT JOIN selection_arguments sa ON sa.selection_id = s.id AND sa.name = fad.name
	  JOIN selection_refs sr ON sr.child_id = s.id
	  JOIN documents d ON d.id = sr.document
	  JOIN raw_documents rd ON rd.id = d.raw_document
	WHERE fad.type_modifiers LIKE '%!'
	  AND sa.id IS NULL
	  AND d.kind IN ('query', 'mutation', 'subscription')
	GROUP BY s.id, fad.name
	`

	p.runValidationQuery(ctx, query, "error checking for missing required arguments", errs, func(row *sqlite.Stmt) {
		argName := row.ColumnText(0)
		filepath := row.ColumnText(1)
		locationsRaw := row.ColumnText(2)

		var locations []*plugins.ErrorLocation
		if err := json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
			errs.Append(plugins.Error{
				Message: fmt.Sprintf("could not unmarshal locations for missing required argument '%s'", argName),
				Detail:  err.Error(),
			})
			return
		}

		// Assign the file path from the raw document to each location.
		for _, loc := range locations {
			loc.Filepath = filepath
		}

		errs.Append(plugins.Error{
			Message:   fmt.Sprintf("Missing required argument '%s'", argName),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
}

func (p *HoudiniCore) validate_conflictingSelections(ctx context.Context, errs *plugins.ErrorList) {
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
		GROUP BY sr.parent_id, s.alias
		HAVING COUNT(DISTINCT s.type) > 1
	`

	p.runValidationQuery(ctx, query, "error checking for conflicting selections", errs, func(row *sqlite.Stmt) {
		parentSelectionID := row.ColumnText(0)
		alias := row.ColumnText(1)
		conflictingFields := row.ColumnText(2)
		types := row.ColumnText(3)
		filepath := row.ColumnText(4)
		locationsRaw := row.ColumnText(5)

		var locations []*plugins.ErrorLocation
		if err := json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
			errs.Append(plugins.Error{
				Message: fmt.Sprintf("could not unmarshal locations for conflicting selections with alias '%s'", alias),
				Detail:  err.Error(),
			})
			return
		}
		for _, loc := range locations {
			loc.Filepath = filepath
		}

		errs.Append(plugins.Error{
			Message:   fmt.Sprintf("Conflicting selections for alias '%s': fields %s have differing types %s (parent selection %s)", alias, conflictingFields, types, parentSelectionID),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
}

func (p *HoudiniCore) validate_duplicateKeysInInputObject(ctx context.Context, errs *plugins.ErrorList) {
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
			JOIN raw_documents rd ON rd.id = (
				SELECT raw_document FROM documents WHERE id = (
					SELECT document FROM selection_refs WHERE child_id IN (
						SELECT id FROM selections WHERE id IN (
							SELECT selection_id FROM selection_arguments WHERE value = av.id LIMIT 1
						)
					) LIMIT 1
				) LIMIT 1
			)
		WHERE av.kind = 'Object'
		  AND av2.name IS NOT NULL
		GROUP BY av.id, av2.name
		HAVING COUNT(*) > 1
		`
	p.runValidationQuery(ctx, query, "error checking for duplicate keys in an argument object", errs, func(row *sqlite.Stmt) {
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
		errs.Append(plugins.Error{
			Message:   fmt.Sprintf("Duplicate key '%s' appears %d times in an input object", keyName, keyCount),
			Kind:      plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{location},
		})
	})
}

func (p *HoudiniCore) validate_wrongTypesToScalarArg(ctx context.Context, errs *plugins.ErrorList) {
	// SQL query for top-level scalar arguments.
	// This query joins the argument value with its corresponding field argument definition.
	// It retrieves:
	//   - The argument name and expected type (from fad.type)
	//   - The provided literal (av.raw) and its kind (av.kind)
	//   - The file path and location info for error reporting.
	queryStr := `
	SELECT
	  sargs.selection_id,
	  fad.name AS argName,
	  fad.type AS expectedType,
	  av.raw AS providedLiteral,
	  av.kind AS providedKind,
	  rd.filepath,
	  json_group_array(
	    json_object('line', rd.offset_line, 'column', rd.offset_column)
	  ) AS locations
	FROM selection_arguments sargs
	  JOIN selections s ON sargs.selection_id = s.id
	  JOIN type_fields tf ON s.type = tf.id
	  JOIN field_argument_definitions fad ON fad.field = tf.id AND fad.name = sargs.name
	  JOIN selection_refs sr ON sr.child_id = s.id
	  JOIN documents d ON d.id = sr.document
	  JOIN raw_documents rd ON rd.id = d.raw_document
	  JOIN argument_values av ON av.id = sargs.value
	WHERE av.kind NOT IN ('Object', 'Variable')
	GROUP BY sargs.selection_id, fad.name, av.raw, av.kind
	HAVING fad.type <> av.kind
	`

	// Run the query.
	p.runValidationQuery(ctx, queryStr, "error checking argument types", errs, func(row *sqlite.Stmt) {
		argName := row.ColumnText(1)
		expectedType := row.ColumnText(2)
		providedLiteral := row.ColumnText(3)
		providedKind := row.ColumnText(4)
		filepath := row.ColumnText(5)
		locationsRaw := row.ColumnText(6)

		// Unmarshal the aggregated locations.
		var locations []*plugins.ErrorLocation
		if err := json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
			errs.Append(plugins.Error{
				Message: fmt.Sprintf("Could not unmarshal locations for argument '%s'", argName),
				Detail:  err.Error(),
			})
			return
		}
		for _, loc := range locations {
			loc.Filepath = filepath
		}

		errs.Append(plugins.Error{
			Message:   fmt.Sprintf("Argument '%s' expects type '%s' but provided literal of type '%s' (value: %s)", argName, expectedType, providedKind, providedLiteral),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	})
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
func (p *HoudiniCore) loadUsedInputTypes(ctx context.Context) (map[string]*InputTypeDefinition, error) {
	conn, err := p.DB.Take(ctx)
	if err != nil {
		return nil, err
	}
	defer p.DB.Put(conn)

	// Step 1: Get distinct input type names used by structured arguments.
	distinctQuery := `
	SELECT DISTINCT fad.type AS expectedInputType
	FROM selection_arguments sargs
	  JOIN field_argument_definitions fad ON fad.field = sargs.selection_id AND fad.name = sargs.name
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

// validateNestedInput recursively validates that the provided input object conforms to
// the expected InputTypeDefinition. The 'path' parameter accumulates the field path for error messages.
func validateNestedInput(provided interface{}, def *InputTypeDefinition, path string) []*plugins.Error {
	var errs []*plugins.Error

	// The provided value should be a JSON object.
	providedMap, ok := provided.(map[string]interface{})
	if !ok {
		errs = append(errs, &plugins.Error{
			Message: fmt.Sprintf("Value at '%s' should be an object", path),
			Kind:    plugins.ErrorKindValidation,
		})
		return errs
	}

	// Validate each expected field.
	for fieldName, fieldDef := range def.Fields {
		currentPath := fieldName
		if path != "" {
			currentPath = path + "." + fieldName
		}

		value, exists := providedMap[fieldName]
		if !exists || value == nil {
			if fieldDef.Required {
				errs = append(errs, &plugins.Error{
					Message: fmt.Sprintf("Missing required field '%s'", currentPath),
					Kind:    plugins.ErrorKindValidation,
				})
			}
			continue
		}

		if fieldDef.IsList {
			// Expect a list.
			arrayVal, ok := value.([]interface{})
			if !ok {
				errs = append(errs, &plugins.Error{
					Message: fmt.Sprintf("Field '%s' should be a list", currentPath),
					Kind:    plugins.ErrorKindValidation,
				})
				continue
			}
			for i, elem := range arrayVal {
				elementPath := fmt.Sprintf("%s[%d]", currentPath, i)
				if fieldDef.InputDef != nil {
					nestedErrs := validateNestedInput(elem, fieldDef.InputDef, elementPath)
					errs = append(errs, nestedErrs...)
				} else {
					if scalarErr := validateScalar(elem, fieldDef.ExpectedType, elementPath); scalarErr != nil {
						errs = append(errs, scalarErr)
					}
				}
			}
		} else {
			// Not a list.
			if fieldDef.InputDef != nil {
				nestedErrs := validateNestedInput(value, fieldDef.InputDef, currentPath)
				errs = append(errs, nestedErrs...)
			} else {
				if scalarErr := validateScalar(value, fieldDef.ExpectedType, currentPath); scalarErr != nil {
					errs = append(errs, scalarErr)
				}
			}
		}
	}

	// Optionally, warn about extra fields not defined on the input type.
	for key := range providedMap {
		if _, ok := def.Fields[key]; !ok {
			extraPath := key
			if path != "" {
				extraPath = path + "." + key
			}
			errs = append(errs, &plugins.Error{
				Message: fmt.Sprintf("Field '%s' is not defined on input type '%s'", extraPath, def.Name),
				Kind:    plugins.ErrorKindValidation,
			})
		}
	}

	return errs
}
func (p *HoudiniCore) validate_wrongTypesToStructuredArg(ctx context.Context, errs *plugins.ErrorList) {
	// Step 1: Load all used input types into memory.
	typeCache, err := p.loadUsedInputTypes(ctx)
	if err != nil {
		errs.Append(plugins.Error{
			Message: fmt.Sprintf("Failed to load used input types: %v", err),
			Kind:    plugins.ErrorKindValidation,
		})
		return
	}

	// Step 2: Query for structured (object) arguments.
	queryObj := `
	SELECT
	  sargs.selection_id,
	  fad.name AS argName,
	  fad.type AS expectedInputType,
	  av.raw AS providedJSON,
	  rd.filepath,
	  json_group_array(
	    json_object('line', rd.offset_line, 'column', rd.offset_column)
	  ) AS locations
	FROM selection_arguments sargs
	  JOIN selections s ON sargs.selection_id = s.id
	  JOIN type_fields tf ON s.type = tf.id
	  JOIN field_argument_definitions fad ON fad.field = tf.id AND fad.name = sargs.name
	  JOIN selection_refs sr ON sr.child_id = s.id
	  JOIN documents d ON d.id = sr.document
	  JOIN raw_documents rd ON rd.id = d.raw_document
	  JOIN argument_values av ON av.id = sargs.value
	WHERE av.kind = 'Object'
	GROUP BY sargs.selection_id, fad.name, av.raw
	`
	p.runValidationQuery(ctx, queryObj, "error checking structured argument", errs, func(row *sqlite.Stmt) {
		argName := row.ColumnText(1)
		expectedTypeName := row.ColumnText(2)
		providedJSON := row.ColumnText(3)
		filepath := row.ColumnText(4)
		locationsRaw := row.ColumnText(5)

		// Unmarshal the provided JSON.
		var providedInput map[string]interface{}
		if err := json.Unmarshal([]byte(providedJSON), &providedInput); err != nil {
			errs.Append(plugins.Error{
				Message:   fmt.Sprintf("Could not unmarshal JSON for argument '%s': %v", argName, err),
				Kind:      plugins.ErrorKindValidation,
				Locations: []*plugins.ErrorLocation{{Filepath: filepath}},
			})
			return
		}

		expectedDef, found := typeCache[expectedTypeName]
		if !found {
			errs.Append(plugins.Error{
				Message:   fmt.Sprintf("Input type '%s' is not defined in the schema", expectedTypeName),
				Kind:      plugins.ErrorKindValidation,
				Locations: []*plugins.ErrorLocation{{Filepath: filepath}},
			})
			return
		}

		// Recursively validate the provided input.
		nestedErrs := validateNestedInput(providedInput, expectedDef, "")
		if len(nestedErrs) > 0 {
			var locations []*plugins.ErrorLocation
			if err := json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
				locations = []*plugins.ErrorLocation{{Filepath: filepath}}
			} else {
				for _, loc := range locations {
					loc.Filepath = filepath
				}
			}
			for _, e := range nestedErrs {
				e.Locations = append(e.Locations, locations...)
				errs.Append(*e)
			}
		}
	})
}
