package plugin

import (
	"context"
	"sync"

	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	fragmentarguments "code.houdinigraphql.com/packages/houdini-core/plugin/fragmentArguments"
	"code.houdinigraphql.com/packages/houdini-core/plugin/lists"
	"code.houdinigraphql.com/plugins"
)

func (p *HoudiniCore) Validate(ctx context.Context) error {
	// build up all of the errors we encounter
	errs := &plugins.ErrorList{}

	// build up all of the rules
	rules := []RuleFunc{
		// default GraphQL-js validation Rules
		documents.ValidateSubscriptionsWithMultipleRootFields[PluginConfig],
		documents.ValidateDuplicateDocumentNames[PluginConfig],
		documents.ValidateFragmentUnknownType[PluginConfig],
		documents.ValidateFragmentOnScalar[PluginConfig],
		documents.ValidateOutputTypeAsInput[PluginConfig],
		documents.ValidateScalarWithSelection[PluginConfig],
		documents.ValidateUnknownField[PluginConfig],
		documents.ValidateIncompatibleFragmentSpread[PluginConfig],
		documents.ValidateFragmentCycles[PluginConfig],
		documents.ValidateDuplicateVariables[PluginConfig],
		documents.ValidateUndefinedVariables[PluginConfig],
		documents.ValidateUnusedVariables[PluginConfig],
		documents.ValidateRepeatingNonRepeatable[PluginConfig],
		documents.ValidateUnknownFieldArguments[PluginConfig],
		documents.ValidateDuplicateArgumentInField[PluginConfig],
		documents.ValidateWrongTypesToArg[PluginConfig],
		documents.ValidateMissingRequiredArgument[PluginConfig],
		documents.ValidateFieldArgumentIncompatibleType[PluginConfig],
		documents.ValidateConflictingSelections[PluginConfig],
		documents.ValidateDuplicateKeysInInputObject[PluginConfig],
		// Houdini-specific validation rules
		documents.ValidateNoKeyAlias[PluginConfig],
		documents.ValidateKnownDirectiveArguments[PluginConfig],
		documents.ValidateMaskDirectives[PluginConfig],
		documents.ValidateLoadingDirective[PluginConfig],
		documents.ValidateRequiredDirective[PluginConfig],
		documents.ValidateOptimisticKeyFullSelection[PluginConfig],
		documents.ValidateOptimisticKeyOnScalar[PluginConfig],
		lists.DiscoverListsThenValidate[PluginConfig],
		lists.ValidateConflictingParentIDAllLists[PluginConfig],
		lists.ValidateConflictingPrependAppend[PluginConfig],
		lists.ValidatePaginateTypeCondition[PluginConfig],
		lists.ValidateSinglePaginateDirective[PluginConfig],
		lists.ValidateParentID[PluginConfig],
		fragmentarguments.ValidateFragmentArgumentValues[PluginConfig],
		fragmentarguments.ValidateFragmentArgumentsMissingWith[PluginConfig],
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

type RuleFunc = func(ctx context.Context, db plugins.DatabasePool[PluginConfig], errs *plugins.ErrorList)
