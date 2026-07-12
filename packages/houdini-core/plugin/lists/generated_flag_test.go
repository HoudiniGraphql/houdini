package lists_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins"
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

			// a task-scoped cleanup for an unrelated task must not touch these
			// documents — only the task's own generated documents get regenerated
			// afterwards, so a project-wide delete here would strip every other
			// file's list operations until the next full run
			scoped := plugins.ContextWithTaskID(context.Background(), "unrelated-task")
			require.Nil(t, core.BeforeValidate(scoped))
			count, err := conn.Prepare(`SELECT COUNT(*) AS n FROM documents WHERE generated = true`)
			require.Nil(t, err)
			_, err = count.Step()
			require.Nil(t, err)
			remaining := count.GetInt64("n")
			require.Nil(t, count.Finalize())
			require.Greater(t, remaining, int64(0), "unrelated-task cleanup must not delete generated documents")

			// long-lived databases (language server, dev-server HMR) re-validate
			// with the previous run's generated documents present — BeforeValidate
			// must remove them so rules never see pipeline products (eg a @plural
			// spread copied to a list operation's root would otherwise flag)
			require.Nil(
				t,
				core.BeforeValidate(context.Background()),
				"cleanup before revalidation failed",
			)
			require.Nil(
				t,
				core.Validate(context.Background()),
				"revalidation after generation must stay clean",
			)
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
			{
				Name: "plural spreads inside generated operations do not flag on revalidation",
				Pass: true,
				Input: []string{
					`
						fragment PluralRow on User @plural {
							firstName
						}
					`,
					`
						query PluralUsers {
							users @list(name: "Plural_Users") {
								...PluralRow
							}
						}
					`,
				},
				Extra: map[string]any{
					"generated": map[string]bool{
						"PluralRow":           false,
						"PluralUsers":         false,
						"Plural_Users_insert": true,
						"Plural_Users_remove": true,
						"Plural_Users_toggle": true,
						"Plural_Users_update": true,
						"Plural_Users_upsert": true,
					},
				},
			},
		},
	})
}
