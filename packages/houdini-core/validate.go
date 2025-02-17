package main

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"code.houdinigraphql.com/plugins"
	"zombiezen.com/go/sqlite"
)

func (p *HoudiniCore) Validate(ctx context.Context) error {
	// build up all of the errors we encounter
	errs := &plugins.ErrorList{}

	// build up all of the rules
	rules := []RuleFunc{
		// default GraphQL-js validation Rules
		p.validate_subscriptionsWithMultipleRootFields,
		p.validate_duplicateDocumentNames,
		p.validate_fragmentUnknownType,
		p.validate_fragmentOnScalar,
		p.validate_outputTypeAsInput,
		p.validate_scalarWithSelection,
		p.validate_unknownField,
		p.validate_incompatibleFragmentSpread,
		p.validate_fragmentCycles,
		p.validate_duplicateVariables,
		p.validate_undefinedVariables,
		p.validate_unusedVariables,
		p.validate_unknownDirective,
		p.validate_repeatingNonRepeatable,
		p.validate_duplicateArgumentInField,
		p.validate_wrongTypesToArg,
		p.validate_missingRequiredArgument,
		p.validate_fieldArgumentIncompatibleType,
		p.validate_nonRequiredArgPassedToRequiredField,
		p.validate_conflictingSelections,
		p.validate_duplicateKeysInInputObject,
		p.validate_noKeyAlias,
	}

	// run all of the rules concurrently
	var wg sync.WaitGroup
	for _, rule := range rules {
		wg.Add(1)
		go func(rule RuleFunc) {
			defer wg.Done()
			rule(ctx, errs)
		}(rule)
	}

	// wait for the validation to finish
	wg.Wait()

	// we're done
	if errs.Len() > 0 {
		return errs
	}
	return nil
}

type RuleFunc = func(context.Context, *plugins.ErrorList)

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

}

func (p *HoudiniCore) validate_incompatibleFragmentSpread(ctx context.Context, errs *plugins.ErrorList) {

}

func (p *HoudiniCore) validate_fragmentCycles(ctx context.Context, errs *plugins.ErrorList) {

}

func (p *HoudiniCore) validate_duplicateVariables(ctx context.Context, errs *plugins.ErrorList) {

}

func (p *HoudiniCore) validate_undefinedVariables(ctx context.Context, errs *plugins.ErrorList) {

}

func (p *HoudiniCore) validate_unusedVariables(ctx context.Context, errs *plugins.ErrorList) {

}

func (p *HoudiniCore) validate_unknownDirective(ctx context.Context, errs *plugins.ErrorList) {

}

func (p *HoudiniCore) validate_repeatingNonRepeatable(ctx context.Context, errs *plugins.ErrorList) {

}

func (p *HoudiniCore) validate_duplicateArgumentInField(ctx context.Context, errs *plugins.ErrorList) {

}

func (p *HoudiniCore) validate_wrongTypesToArg(ctx context.Context, errs *plugins.ErrorList) {

}

func (p *HoudiniCore) validate_missingRequiredArgument(ctx context.Context, errs *plugins.ErrorList) {

}

func (p *HoudiniCore) validate_fieldArgumentIncompatibleType(ctx context.Context, errs *plugins.ErrorList) {

}

func (p *HoudiniCore) validate_nonRequiredArgPassedToRequiredField(ctx context.Context, errs *plugins.ErrorList) {

}

func (p *HoudiniCore) validate_conflictingSelections(ctx context.Context, errs *plugins.ErrorList) {

}

func (p *HoudiniCore) validate_duplicateKeysInInputObject(ctx context.Context, errs *plugins.ErrorList) {

}

func (p *HoudiniCore) validate_noKeyAlias(ctx context.Context, errs *plugins.ErrorList) {

}

// runValidationQuery wraps the common steps for executing a query.
// It obtains the connection, prepares the query, iterates over rows, and calls the rowHandler callback for each row.
func (p *HoudiniCore) runValidationQuery(ctx context.Context, queryStr, prepErrMsg string, errs *plugins.ErrorList, rowHandler func(q *sqlite.Stmt)) {
	conn, err := p.DB.Take(ctx)
	if err != nil {
		errs.Append(plugins.Error{
			Message: "could not open connection to database",
			Detail:  err.Error(),
		})
		return
	}
	defer p.DB.Put(conn)

	query, err := conn.Prepare(queryStr)
	if err != nil {
		errs.Append(plugins.Error{
			Message: prepErrMsg,
			Detail:  err.Error(),
		})
		return
	}
	defer query.Finalize()

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		hasData, err := query.Step()
		if err != nil {
			errs.Append(plugins.Error{
				Message: "query step error",
				Detail:  err.Error(),
			})
			break
		}
		if !hasData {
			break
		}
		rowHandler(query)
	}
}
