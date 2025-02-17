package main

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"code.houdinigraphql.com/plugins"
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
	// create a thread-safe connection for this check
	conn, err := p.DB.Take(ctx)
	if err != nil {
		errs.Append(plugins.Error{
			Message: "could not open connection to database",
			Detail:  err.Error(),
		})
		return
	}
	defer p.DB.Put(conn)

	// we need a query that will return all of the subscriptions that have more than 1 root field
	query, err := conn.Prepare(`
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
	`)
	if err != nil {
		errs.Append(plugins.Error{
			Message: "could not validate subscriptions with multiple root fields",
			Detail:  err.Error(),
		})
		return
	}
	defer query.Finalize()

	// execute the query and check the results
	for {
		// make sure that ctx isn't cancelled
		select {
		case <-ctx.Done():
			return
		default:
		}

		// get the next row
		hasData, err := query.Step()
		if err != nil {
			errs.Append(plugins.Error{
				Message: "could not check for subscriptions with multiple root fields",
				Detail:  err.Error(),
			})
			break
		}

		// if theres no more data to consume then we're done
		if !hasData {
			break
		}

		// pull out the results
		filepath := query.ColumnText(0)
		locationsRaw := query.ColumnText(1)

		// build up the list of locations
		locations := []*plugins.ErrorLocation{}
		err = json.Unmarshal([]byte(locationsRaw), &locations)
		if err != nil {
			errs.Append(plugins.WrapError(fmt.Errorf("error unmarshaling locations: %v. %v", err, locationsRaw)))
			continue
		}
		for _, loc := range locations {
			loc.Filepath = filepath
		}

		// we found a subscription with multiple root fields
		errs.Append(plugins.Error{
			Message:   "subscriptions can only have a single root field",
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	}
}

func (p *HoudiniCore) validate_duplicateDocumentNames(ctx context.Context, errs *plugins.ErrorList) {
	// create a thread-safe connection for this check.
	conn, err := p.DB.Take(ctx)
	if err != nil {
		errs.Append(plugins.Error{
			Message: "could not open connection to database",
			Detail:  err.Error(),
		})
		return
	}
	defer p.DB.Put(conn)

	// prepare a query that returns duplicate document names along with the locations
	query, err := conn.Prepare(`
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
	`)
	if err != nil {
		errs.Append(plugins.Error{
			Message: "could not validate duplicate document names",
			Detail:  err.Error(),
		})
		return
	}
	defer query.Finalize()

	// execute the query and process each row.
	for {
		// check if the context has been cancelled.
		select {
		case <-ctx.Done():
			return
		default:
		}

		hasData, err := query.Step()
		if err != nil {
			errs.Append(plugins.Error{
				Message: "could not check for duplicate document names",
				Detail:  err.Error(),
			})
			break
		}
		if !hasData {
			break
		}

		// extract the duplicate name and the JSON-encoded error locations.
		docName := query.ColumnText(0)
		locationsRaw := query.ColumnText(1)

		// parse the JSON to build the list of error locations.
		locations := []*plugins.ErrorLocation{}
		err = json.Unmarshal([]byte(locationsRaw), &locations)
		if err != nil {
			errs.Append(plugins.WrapError(fmt.Errorf("error unmarshaling locations for document '%s': %v. Raw: %s", docName, err, locationsRaw)))
			continue
		}

		// append an error indicating that duplicate document names are not allowed.
		errs.Append(plugins.Error{
			Message:   fmt.Sprintf("duplicate document name: %s", docName),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	}
}

func (p *HoudiniCore) validate_fragmentUnknownType(ctx context.Context, errs *plugins.ErrorList) {
	conn, err := p.DB.Take(ctx)
	if err != nil {
		errs.Append(plugins.Error{Message: "could not open connection (fragmentUnknownType)", Detail: err.Error()})
		return
	}
	defer p.DB.Put(conn)

	// For fragments (documents.kind = 'fragment') join with types on type_condition.
	// If no matching type is found, then the fragment references an unknown type.
	query, err := conn.Prepare(`
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
	`)
	if err != nil {
		errs.Append(plugins.Error{Message: "could not prepare fragmentUnknownType query", Detail: err.Error()})
		return
	}
	defer query.Finalize()

	for {
		// check context cancellation
		select {
		case <-ctx.Done():
			return
		default:
		}

		hasData, err := query.Step()
		if err != nil {
			errs.Append(plugins.Error{Message: "error checking fragment unknown type", Detail: err.Error()})
			break
		}
		if !hasData {
			break
		}

		fragName := query.ColumnText(0)
		typeCond := query.ColumnText(1)
		filepath := query.ColumnText(2)
		locationsRaw := query.ColumnText(3)

		var locations []*plugins.ErrorLocation
		if err = json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
			errs.Append(plugins.WrapError(fmt.Errorf("error unmarshaling locations for fragment '%s': %v. Raw: %s", fragName, err, locationsRaw)))
			continue
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
	}
}

func (p *HoudiniCore) validate_fragmentOnScalar(ctx context.Context, errs *plugins.ErrorList) {
	conn, err := p.DB.Take(ctx)
	if err != nil {
		errs.Append(plugins.Error{Message: "could not open connection (fragmentOnScalar)", Detail: err.Error()})
		return
	}
	defer p.DB.Put(conn)

	// Join fragments with types; if the type_condition exists and its kind is SCALAR, error.
	query, err := conn.Prepare(`
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
	`)
	if err != nil {
		errs.Append(plugins.Error{Message: "could not prepare fragmentOnScalar query", Detail: err.Error()})
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
			errs.Append(plugins.Error{Message: "error checking fragment on scalar", Detail: err.Error()})
			break
		}
		if !hasData {
			break
		}
		fragName := query.ColumnText(0)
		typeCond := query.ColumnText(1)
		filepath := query.ColumnText(2)
		locationsRaw := query.ColumnText(3)

		var locations []*plugins.ErrorLocation
		if err = json.Unmarshal([]byte(locationsRaw), &locations); err != nil {
			errs.Append(plugins.WrapError(fmt.Errorf("error unmarshaling locations for fragment '%s': %v. Raw: %s", fragName, err, locationsRaw)))
			continue
		}
		for _, loc := range locations {
			loc.Filepath = filepath
		}
		errs.Append(plugins.Error{
			Message:   fmt.Sprintf("Fragment '%s' is defined on a scalar type '%s'", fragName, typeCond),
			Kind:      plugins.ErrorKindValidation,
			Locations: locations,
		})
	}
}

func (p *HoudiniCore) validate_outputTypeAsInput(ctx context.Context, errs *plugins.ErrorList) {
	conn, err := p.DB.Take(ctx)
	if err != nil {
		errs.Append(plugins.Error{Message: "could not open connection (outputTypeAsInput)", Detail: err.Error()})
		return
	}
	defer p.DB.Put(conn)

	// Operation variables must be input types. Join with types and error if kind is OBJECT, INTERFACE, or UNION.
	query, err := conn.Prepare(`
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
		WHERE types.kind != 'INPUT'
	`)
	if err != nil {
		errs.Append(plugins.Error{Message: "could not prepare outputTypeAsInput query", Detail: err.Error()})
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
			errs.Append(plugins.Error{Message: "error checking variable output type", Detail: err.Error()})
			break
		}
		if !hasData {
			break
		}
		varName := query.ColumnText(0)
		varType := query.ColumnText(1)
		filepath := query.ColumnText(2)
		line := query.ColumnInt(3)
		column := query.ColumnInt(4)

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
	}
}

func (p *HoudiniCore) validate_scalarWithSelection(ctx context.Context, errs *plugins.ErrorList) {

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
