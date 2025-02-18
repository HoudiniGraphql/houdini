package main

import (
	"context"
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
		p.validate_wrongTypesToStructuredArg,
		p.validate_wrongTypesToScalarArg,
		p.validate_missingRequiredArgument,
		p.validate_fieldArgumentIncompatibleType,
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
