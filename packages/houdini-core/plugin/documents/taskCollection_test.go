package documents_test

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents/collected"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
)

// Regression test for incremental (HMR) rebuilds dropping fragments that live in files
// outside the current task. The scenario mirrors a dev-server save: the file defining
// SiblingFragment changes, the task expands to the query that depends on it, but the
// files defining ParentFragment and NestedFragment are untouched. Collection must still
// pull in the whole spread chain (transitively) so the regenerated query artifact keeps
// every fragment's fields and raw definitions.
func TestTaskScopedCollectionIncludesOutOfTaskFragments(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniCore]{
		Schema: `
			type Query {
				user: User!
			}

			type User {
				id: ID!
				name: String!
				email: String!
			}
		`,
		PerformTest: func(t *testing.T, p *plugin.HoudiniCore, test tests.Test[config.PluginConfig]) {
			ctx := context.Background()

			// run the full pipeline once, like the dev server does on boot
			require.NoError(t, p.AfterExtract(ctx))
			require.NoError(t, p.Validate(ctx))
			require.NoError(t, p.AfterValidate(ctx))
			_, err := p.GenerateDocuments(ctx)
			require.NoError(t, err)

			// simulate the HMR task: the sibling fragment's file was saved and the
			// dependency walk pulled in the query's file. the parent/nested files stay out.
			conn, err := p.DB.Take(ctx)
			require.NoError(t, err)
			markTask, err := conn.Prepare(
				`UPDATE raw_documents SET current_task = 'hmr-task' WHERE filepath IN ('query.graphql', 'sibling.graphql')`,
			)
			require.NoError(t, err)
			err = p.DB.ExecStatement(markTask, nil)
			markTask.Finalize()
			p.DB.Put(conn)
			require.NoError(t, err)

			taskCtx := plugins.ContextWithTaskID(ctx, "hmr-task")

			// collection must contain the full spread chain, not just the task documents
			conn, err = p.DB.Take(taskCtx)
			require.NoError(t, err)
			docs, err := collected.CollectDocuments(taskCtx, p.DB, conn, false)
			p.DB.Put(conn)
			require.NoError(t, err)

			for _, name := range []string{"NestedQuery", "SiblingFragment", "ParentFragment", "NestedFragment"} {
				require.Contains(t, docs.Selections, name)
			}
			// but only the task's own documents get regenerated
			require.ElementsMatch(t, []string{"NestedQuery", "SiblingFragment"}, docs.TaskDocuments)

			// and the regenerated artifact keeps the out-of-task fragments' contribution
			_, err = p.GenerateDocuments(taskCtx)
			require.NoError(t, err)

			artifact := readArtifact(t, p.Fs, "NestedQuery")
			for _, expected := range []string{
				// fields contributed by the out-of-task fragments
				`"keyRaw": "name"`,
				`"keyRaw": "id"`,
				// the raw document needs every transitive fragment definition
				"fragment ParentFragment",
				"fragment NestedFragment",
				"fragment SiblingFragment",
				"...NestedFragment",
			} {
				require.Contains(t, artifact, expected)
			}
		},
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "out-of-task fragments survive incremental regeneration",
				Pass: true,
				Input: []string{
					`query NestedQuery { user { ...SiblingFragment ...ParentFragment } }`,
					`fragment SiblingFragment on User { email }`,
					`fragment ParentFragment on User { name ...NestedFragment }`,
					`fragment NestedFragment on User { id }`,
				},
				Filepaths: []string{
					"query.graphql",
					"sibling.graphql",
					"parent.graphql",
					"nested.graphql",
				},
			},
		},
	})
}

// readArtifact finds the generated artifact file for the named document in the test
// filesystem and returns its content
func readArtifact(t *testing.T, fs afero.Fs, name string) string {
	t.Helper()
	var match string
	err := afero.Walk(fs, "/project", func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		if strings.Contains(path, "artifacts") && strings.HasPrefix(info.Name(), name+".") {
			match = path
		}
		return nil
	})
	require.NoError(t, err)
	require.NotEmpty(t, match, "artifact for %s not found", name)
	raw, err := afero.ReadFile(fs, match)
	require.NoError(t, err)
	return string(raw)
}
