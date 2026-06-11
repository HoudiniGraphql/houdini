package documents_test

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
)

func TestWalk_staticRuntimeIsDiscovered(t *testing.T) {
	ctx := context.Background()

	db, err := plugins.NewTestPool[config.PluginConfig]()
	require.NoError(t, err)
	defer db.Close()

	conn, err := db.Take(ctx)
	require.NoError(t, err)
	require.NoError(t, tests.WriteDatabaseSchema(conn))
	db.Put(conn)

	projectConfig := plugins.ProjectConfig{
		ProjectRoot:    "/project",
		RuntimeDir:     ".houdini",
		Include:        []string{},
		Exclude:        []string{},
		RuntimeScalars: map[string]string{},
	}
	db.SetProjectConfig(projectConfig)

	// Register a plugin whose static runtime should be walked.
	// The value of include_static_runtime just needs to be NOT NULL — the path
	// is computed from the plugin name and project config, not from this column.
	err = db.ExecQuery(ctx,
		`INSERT INTO plugins (name, port, hooks, plugin_order, include_static_runtime)
		 VALUES ($name, $port, $hooks, $order, $static)`,
		map[string]any{
			"name":   "my-plugin",
			"port":   0,
			"hooks":  "[]",
			"order":  "after",
			"static": "static",
		},
	)
	require.NoError(t, err)

	// Create a .graphql file at the conventional static runtime path.
	fs := afero.NewMemMapFs()
	staticDir := projectConfig.PluginStaticRuntimeDirectory("my-plugin")
	require.NoError(t, fs.MkdirAll(staticDir, 0755))
	require.NoError(t, afero.WriteFile(
		fs,
		filepath.Join(staticDir, "ops.graphql"),
		[]byte("query Ping { ping }"),
		0644,
	))

	require.NoError(t, documents.Walk(ctx, db, fs))

	// The file should have been inserted into raw_documents.
	conn, err = db.Take(ctx)
	require.NoError(t, err)
	defer db.Put(conn)

	stmt, err := conn.Prepare("SELECT COUNT(*) FROM raw_documents WHERE filepath LIKE '%ops.graphql'")
	require.NoError(t, err)
	defer stmt.Finalize()

	hasRow, err := stmt.Step()
	require.NoError(t, err)
	require.True(t, hasRow)
	require.Equal(t, 1, stmt.ColumnInt(0), "static runtime file should be discovered by Walk")
}
