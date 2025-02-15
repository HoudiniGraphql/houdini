package main

import (
	"context"
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
	/*
		// create a thread-safe connection for this check
		db, err := p.databaseConnection()
		if err != nil {
			errs.Append(plugins.Error{
				Message: "could not open connection to database",
				Detail:  err.Error(),
			})
			return
		}

		// we need a query that will return all of the subscriptions that have more than 1 root field
		query, err := db.Prepare(`
			SELECT
				d.id AS subscription_id,
				d.name AS subscription_name,
				json_group_array(
					json_object('line', sr.row, 'column', sr.column)
				) AS root_fields
			FROM documents d
				JOIN selection_refs sr ON sr.document = d.id
				JOIN selections s ON s.id = sr.child_id
			WHERE d.kind = 'subscription'
				AND sr.parent_id IS NULL
				AND s.kind = 'field'
			GROUP BY d.id, d.name HAVING COUNT(*) > 1;
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
				fmt.Println("cancelled")
				return
			default:
			}

			// get the next row
			hasData, err := query.Step()
			if err != nil {
				errs.Append(plugins.Error{
					Message: "could not validate subscriptions with multiple root fields",
					Detail:  err.Error(),
				})
				break
			}

			fmt.Println(hasData)

			// if theres no more data to consume then we're done
			if !hasData {
				break
			}

			// pull out the results
			documentName := query.ColumnText(1)
			rootFields := query.ColumnText(2)
			locations := query.ColumnText(3)

			fmt.Println(documentName, rootFields, locations)

			// we found a subscription with multiple root fields
			errs.Append(plugins.Error{
				Message: "subscriptions can only have a single root field",
			})
		}
	*/
}

func (p *HoudiniCore) validate_duplicateDocumentNames(ctx context.Context, errs *plugins.ErrorList) {

}

func (p *HoudiniCore) validate_fragmentUnknownType(ctx context.Context, errs *plugins.ErrorList) {

}

func (p *HoudiniCore) validate_fragmentOnScalar(ctx context.Context, errs *plugins.ErrorList) {

}

func (p *HoudiniCore) validate_outputTypeAsInput(ctx context.Context, errs *plugins.ErrorList) {

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
