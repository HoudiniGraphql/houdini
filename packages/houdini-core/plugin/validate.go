package plugin

import (
	"context"
	"sync"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/packages/houdini-core/plugin/fragmentArguments"
	"code.houdinigraphql.com/packages/houdini-core/plugin/lists"
	"code.houdinigraphql.com/plugins"
)

func (p *HoudiniCore) Validate(ctx context.Context) error {
	// build up all of the errors we encounter
	errs := &plugins.ErrorList{}

	// build up all of the rules
	rules := []RuleFunc{
		// default GraphQL-js validation Rules
		documents.ValidateSubscriptionsWithMultipleRootFields,
		documents.ValidateDuplicateDocumentNames,
		documents.ValidateFragmentUnknownType,
		documents.ValidateFragmentOnScalar,
		documents.ValidateOutputTypeAsInput,
		documents.ValidateScalarWithSelection,
		documents.ValidateUnknownField,
		documents.ValidateIncompatibleFragmentSpread,
		documents.ValidateFragmentCycles,
		documents.ValidateDuplicateVariables,
		documents.ValidateUndefinedVariables,
		documents.ValidateUnusedVariables,
		documents.ValidateRepeatingNonRepeatable,
		documents.ValidateUnknownFieldArguments,
		documents.ValidateDuplicateArgumentInField,
		documents.ValidateWrongTypesToArg,
		documents.ValidateMissingRequiredArgument,
		documents.ValidateFieldArgumentIncompatibleType,
		documents.ValidateConflictingSelections,
		documents.ValidateDuplicateKeysInInputObject,
		// Houdini-specific validation rules
		documents.ValidateNoKeyAlias,
		documents.ValidateKnownDirectiveArguments,
		documents.ValidateMaskDirectives,
		documents.ValidateLoadingDirective,
		documents.ValidateRequiredDirective,
		documents.ValidateOptimisticKeyFullSelection,
		documents.ValidateOptimisticKeyOnScalar,
		lists.DiscoverListsThenValidate,
		lists.ValidateConflictingParentIDAllLists,
		lists.ValidateConflictingPrependAppend,
		lists.ValidatePaginateTypeCondition,
		lists.ValidateSinglePaginateDirective,
		lists.ValidateParentID,
		fragmentArguments.ValidateFragmentArgumentValues,
		fragmentArguments.ValidateFragmentArgumentsMissingWith,
	}

	// run all of the rules concurrently
	var wg sync.WaitGroup
	for _, rule := range rules {
		wg.Add(1)
		go func(rule RuleFunc) {
			defer wg.Done()
			rule(ctx, p.DB, errs)
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

type RuleFunc = func(ctx context.Context, db plugins.DatabasePool[config.PluginConfig], errs *plugins.ErrorList)
