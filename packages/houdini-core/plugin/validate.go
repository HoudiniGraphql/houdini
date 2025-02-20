package plugin

import (
	"context"
	"sync"

	"code.houdinigraphql.com/packages/houdini-core/plugin/validate"
	"code.houdinigraphql.com/plugins"
)

func (p *HoudiniCore) Validate(ctx context.Context) error {
	// build up all of the errors we encounter
	errs := &plugins.ErrorList{}

	// build up all of the rules
	rules := []RuleFunc{
		// default GraphQL-js validation Rules
		validate.SubscriptionsWithMultipleRootFields[PluginConfig],
		validate.DuplicateDocumentNames[PluginConfig],
		validate.FragmentUnknownType[PluginConfig],
		validate.FragmentOnScalar[PluginConfig],
		validate.OutputTypeAsInput[PluginConfig],
		validate.ScalarWithSelection[PluginConfig],
		validate.UnknownField[PluginConfig],
		validate.IncompatibleFragmentSpread[PluginConfig],
		validate.FragmentCycles[PluginConfig],
		validate.DuplicateVariables[PluginConfig],
		validate.UndefinedVariables[PluginConfig],
		validate.UnusedVariables[PluginConfig],
		validate.UnknownDirective[PluginConfig],
		validate.RepeatingNonRepeatable[PluginConfig],
		validate.DuplicateArgumentInField[PluginConfig],
		validate.WrongTypesToStructuredArg[PluginConfig],
		validate.WrongTypesToScalarArg[PluginConfig],
		validate.MissingRequiredArgument[PluginConfig],
		validate.FieldArgumentIncompatibleType[PluginConfig],
		validate.ConflictingSelections[PluginConfig],
		validate.DuplicateKeysInInputObject[PluginConfig],
		// Houdini-specific validation rules
		validate.NoKeyAlias[PluginConfig],
		validate.Lists[PluginConfig],
		validate.ConflictingParentIDAllLists[PluginConfig],
		validate.ConflictingPrependAppend[PluginConfig],
		validate.RequiredDirective[PluginConfig],
		validate.MaskDirectives[PluginConfig],
		validate.NodeDirective[PluginConfig],
		validate.KnownDirectiveArguments[PluginConfig],
		validate.FragmentArguments[PluginConfig],
		validate.FragmentArgumentsMissingWith[PluginConfig],
		validate.PaginateArgs[PluginConfig],
		validate.PaginateTypeCondition[PluginConfig],
		validate.SinglePaginateDirective[PluginConfig],
		validate.LoadingDirective[PluginConfig],
		validate.OptimisticKeyFullSelection[PluginConfig],
		validate.OptimisticKeyOnScalar[PluginConfig],
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
