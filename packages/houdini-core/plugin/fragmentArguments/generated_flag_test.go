package fragmentArguments_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins/tests"
)

// the fragment-argument transform creates variant documents (UserInfo_<hash>) AND
// rewrites the user's spread selections to point at them. BeforeValidate deletes
// the variants on re-validation (they're generated), so it must also restore the
// rewritten spreads to their original fragment — otherwise every re-validation on
// a long-lived database (language server, dev-server HMR) reports the user's own
// spread as an unknown fragment.
func TestArgumentVariantsRevalidateCleanly(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniCore]{
		Schema: `
			type Query {
				user: User!
			}

			type User {
				id: ID!
				friends(name: String): [User!]!
				firstName: String!
			}
		`,
		VerifyTest: func(t *testing.T, core *plugin.HoudiniCore, test tests.Test[config.PluginConfig]) {
			// simulate the next pipeline run against the same database
			require.Nil(t, core.BeforeValidate(context.Background()), "cleanup before revalidation failed")
			require.Nil(
				t,
				core.Validate(context.Background()),
				"revalidation after the argument transform must stay clean",
			)
		},
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "spreads rewritten to argument variants revalidate cleanly",
				Pass: true,
				Input: []string{
					`
					query AllUsers($name: String) {
						user {
							...UserInfo @with(name: $name)
						}
					}
					`,
					`
					fragment UserInfo on User @arguments(name: {type: "String!"}) {
						friends(name: $name) {
							firstName
						}
					}
					`,
				},
			},
		},
	})
}
