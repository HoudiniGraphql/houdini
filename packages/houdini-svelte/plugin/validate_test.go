package plugin_test

import (
	"context"
	"fmt"
	"testing"

	"code.houdinigraphql.com/packages/houdini-svelte/plugin"
	"code.houdinigraphql.com/packages/houdini-svelte/plugin/config"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
	"github.com/stretchr/testify/require"
)

func TestValidate_svelte(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniSvelte]{
		Schema: `
			type Query { hello: String }
			type Mutation { hello: String }
			type Subscription { hello: String }
		`,
		PerformTest: func(t *testing.T, plugin *plugin.HoudiniSvelte, test tests.Test[config.PluginConfig]) {
			ctx := context.Background()

			// run the validation
			err := plugin.Validate(ctx)
			if test.Pass {
				if err != nil {
					msg := err.Error()
					if pluginErr, ok := err.(*plugins.ErrorList); ok {
						msg = pluginErr.GetItems()[0].Message
						t.Fatal(msg)
					}
					require.Nil(t, err, msg)
				}
			} else {
				require.NotNil(t, err)

				// make sure that the error has a validation kind
				if validationErr, ok := err.(*plugins.ErrorList); ok {
					// make sure we received a validation error
					err := validationErr.GetItems()[0]
					require.Equal(t, plugins.ErrorKindValidation, err.Kind, fmt.Sprintf("%s: %s", err.Message, err.Detail))
				} else {
					t.Fatal("did not receive error list")
				}
			}
		},
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "forbidden operation name: Query",
				Pass: false,
				Input: []string{
					`
						query Query { hello }
					`,
				},
			},
			{
				Name: "forbidden operation name: Mutation",
				Pass: false,
				Input: []string{
					`
						mutation Mutation { hello }
					`,
				},
			},
			{
				Name: "forbidden operation name: Subscription",
				Pass: false,
				Input: []string{
					`
						subscription Subscription { hello }
					`,
				},
			},
			{
				Name: "forbidden operation name: Fragment",
				Pass: false,
				Input: []string{
					`
						fragment Fragment on Query { hello }
					`,
				},
			},
			{
				Name: "forbidden operation name: Base",
				Pass: false,
				Input: []string{
					`
						query Base { hello }
					`,
				},
			},
			{
				Name: "allowed operation names",
				Pass: true,
				Input: []string{
					`
						query GetUser { hello }
					`,
					`
						mutation UpdateUser { hello }
					`,
					`
						subscription UserUpdates { hello }
					`,
					`
						fragment UserInfo on Query { hello }
					`,
				},
			},
		},
	})
}
