package plugin

import "context"

func (p *HoudiniSvelte) Validate(ctx context.Context) error {
	forbiddenNames := []string{
		"QueryStore",
		"MutationStore",
		"SubscriptionStore",
		"FragmentStore",
		"BaseStore",
	}

	// we"re done
	return nil
}
