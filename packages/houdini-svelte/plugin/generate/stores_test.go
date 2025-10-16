package generate_test

import (
	"context"
	"testing"

	"code.houdinigraphql.com/packages/houdini-svelte/plugin"
	"code.houdinigraphql.com/plugins/tests"
)

func TestGenerateStores(t *testing.T) {
	tests.RunTable(t, tests.Table[plugin.PluginConfig, *plugin.HoudiniSvelte]{
		Schema: `
			type User { 
				id: ID!
			}
		}
		`,
		VerifyTest: func(t *testing.T, plugin *plugin.HoudiniSvelte, test tests.Test[plugin.PluginConfig]) {
			config, err := plugin.DB.ProjectConfig(context.Background())
		},
		Tests: []tests.Test[plugin.PluginConfig]{
			{
				Name: "fragments",
				Pass: true,
				Input: []string{
					`fragment TestFragment1 on User { id }`,
					`fragment TestFragment2 on User { id }`,
				},
				Extra: map[string]any{
					"TestFragment1": tests.Dedent(`
							import { FragmentStore } from '../runtime/stores/fragment'
							import artifact from '$houdini/artifacts/TestFragment1'


							// create the fragment store

							export class TestFragment1Store extends FragmentStore {
								constructor() {
									super({
										artifact,
										storeName: "TestFragment1Store",
										variables: true,
										
									})
								}
							}
					`),
				},
			},
			{
				Name: "mutations",
				Pass: true,
				Input: []string{
					`mutation TestMutation1 { updateUser { id }  }`,
					`mutation TestMutation2 { updateUser { id }  }`,
				},
				Extra: map[string]any{
					"TestMutation1": tests.Dedent(`
						import artifact from '$houdini/artifacts/TestMutation1'
						import { MutationStore } from '../runtime/stores/mutation'

						export class TestMutation1Store extends MutationStore {
							constructor() {
								super({
									artifact,
								})
							}
						}
					`),
				},
			},
			{
				Name: "subscriptions",
				Pass: true,
				Input: []string{
					`subscription TestSubscription1 { newUser { id } }`,
					`subscription TestSubscription2 { newUser { id } }`,
				},
				Extra: map[string]any{
					"TestSubscription1": tests.Dedent(`
						import artifact from '$houdini/artifacts/TestSubscription1'
						import { SubscriptionStore } from '../runtime/stores/subscription'

						export class TestSubscription1Store extends SubscriptionStore {
							constructor() {
								super({
									artifact,
								})
							}
						}
					`),
				},
			},
		},
	})
}
