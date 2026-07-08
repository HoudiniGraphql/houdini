package documents_test

import (
	"context"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
)

// leftover raw_documents rows are only stale when the run actually looked at
// their file: a full walk saw everything, a filepath-scoped extraction saw only
// the files it was given
func TestExtractDocuments_staleRows(t *testing.T) {
	ctx := context.Background()

	setup := func(t *testing.T) (plugins.DatabasePool[config.PluginConfig], afero.Fs) {
		db, err := plugins.NewTestPool[config.PluginConfig]()
		require.NoError(t, err)
		t.Cleanup(func() { db.Close() })

		conn, err := db.Take(ctx)
		require.NoError(t, err)
		require.NoError(t, tests.WriteDatabaseSchema(conn))
		db.Put(conn)

		db.SetProjectConfig(plugins.ProjectConfig{
			ProjectRoot:    "/project",
			RuntimeDir:     ".houdini",
			Include:        []string{"**/*.graphql"},
			Exclude:        []string{},
			RuntimeScalars: map[string]string{},
		})

		fs := afero.NewMemMapFs()
		require.NoError(t, fs.MkdirAll("/project", 0755))
		require.NoError(t, afero.WriteFile(fs, "/project/a.graphql", []byte("query A { a }"), 0644))
		require.NoError(t, afero.WriteFile(fs, "/project/b.graphql", []byte("query B { b }"), 0644))

		return db, fs
	}

	// filepath -> set of contents currently in raw_documents
	rawDocuments := func(t *testing.T, db plugins.DatabasePool[config.PluginConfig]) map[string][]string {
		conn, err := db.Take(ctx)
		require.NoError(t, err)
		defer db.Put(conn)

		stmt, err := conn.Prepare("SELECT filepath, content FROM raw_documents ORDER BY filepath, content")
		require.NoError(t, err)
		defer stmt.Finalize()

		got := map[string][]string{}
		for {
			hasData, err := stmt.Step()
			require.NoError(t, err)
			if !hasData {
				break
			}
			got[stmt.ColumnText(0)] = append(got[stmt.ColumnText(0)], stmt.ColumnText(1))
		}
		return got
	}

	t.Run("a filepath-scoped extraction processes every file it is given", func(t *testing.T) {
		db, fs := setup(t)

		err := documents.ExtractFromFilepaths(ctx, db, fs, []string{
			"/project/a.graphql",
			"/project/b.graphql",
		})
		require.NoError(t, err)

		require.Equal(t, map[string][]string{
			"a.graphql": {"query A { a }"},
			"b.graphql": {"query B { b }"},
		}, rawDocuments(t, db))
	})

	t.Run("a full walk deletes rows for deleted files and changed contents", func(t *testing.T) {
		db, fs := setup(t)
		require.NoError(t, documents.Walk(ctx, db, fs))

		// a documents row hanging off the soon-to-be-stale raw document has to
		// disappear with it (this connection doesn't enforce foreign keys)
		conn, err := db.Take(ctx)
		require.NoError(t, err)
		err = db.ExecQuery(ctx,
			`INSERT INTO documents (name, raw_document, kind, generated)
			 SELECT 'B', id, 'query', false FROM raw_documents WHERE filepath = 'b.graphql'`,
			nil,
		)
		db.Put(conn)
		require.NoError(t, err)

		// b disappears, a changes
		require.NoError(t, fs.Remove("/project/b.graphql"))
		require.NoError(t, afero.WriteFile(fs, "/project/a.graphql", []byte("query A2 { a }"), 0644))

		require.NoError(t, documents.Walk(ctx, db, fs))

		require.Equal(t, map[string][]string{
			"a.graphql": {"query A2 { a }"},
		}, rawDocuments(t, db))

		conn, err = db.Take(ctx)
		require.NoError(t, err)
		defer db.Put(conn)
		stmt, err := conn.Prepare("SELECT COUNT(*) FROM documents")
		require.NoError(t, err)
		defer stmt.Finalize()
		hasData, err := stmt.Step()
		require.NoError(t, err)
		require.True(t, hasData)
		require.Equal(t, 0, stmt.ColumnInt(0), "documents of stale raw documents must be deleted")
	})

	t.Run("a scoped extraction leaves unwalked files' rows alone", func(t *testing.T) {
		db, fs := setup(t)
		require.NoError(t, documents.Walk(ctx, db, fs))

		// b's file is gone from disk, but this run never looks at it — its rows
		// simply weren't rediscovered and must survive
		require.NoError(t, fs.Remove("/project/b.graphql"))
		require.NoError(t, afero.WriteFile(fs, "/project/a.graphql", []byte("query A2 { a }"), 0644))

		err := documents.ExtractFromFilepaths(ctx, db, fs, []string{"/project/a.graphql"})
		require.NoError(t, err)

		require.Equal(t, map[string][]string{
			"a.graphql": {"query A2 { a }"},
			"b.graphql": {"query B { b }"},
		}, rawDocuments(t, db))
	})
}
