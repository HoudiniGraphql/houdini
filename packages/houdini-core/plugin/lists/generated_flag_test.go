package lists_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins/tests"
)

// pipeline-created documents (list operations, pagination queries) are marked
// generated = true; the user's own documents stay generated = false. Tooling (eg
// the language server) keys on this to decide what to surface.
func TestGeneratedFlagOnListDocuments(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniCore]{
		Schema: `
			type Query {
				users(limit: Int, offset: Int): [User!]!
			}

			type User {
				id: ID!
				firstName: String!
			}
		`,
		VerifyTest: func(t *testing.T, core *plugin.HoudiniCore, test tests.Test[config.PluginConfig]) {
			conn, err := core.Database().Take(context.Background())
			require.Nil(t, err)
			defer core.Database().Put(conn)

			search, err := conn.Prepare(`SELECT name, generated FROM documents ORDER BY name`)
			require.Nil(t, err)
			defer search.Finalize()

			got := map[string]bool{}
			for {
				hasData, err := search.Step()
				require.Nil(t, err)
				if !hasData {
					break
				}
				got[search.ColumnText(0)] = search.ColumnBool(1)
			}

			require.Equal(t, test.Extra["generated"], got)
		},
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "list operations are generated, user documents are not",
				Pass: true,
				Input: []string{
					`
						query AllUsers {
							users @list(name: "All_Users") {
								firstName
							}
						}
					`,
				},
				Extra: map[string]any{
					"generated": map[string]bool{
						"AllUsers":         false,
						"All_Users_insert": true,
						"All_Users_remove": true,
						"All_Users_toggle": true,
						"All_Users_update": true,
						"All_Users_upsert": true,
					},
				},
			},
		},
	})
}
