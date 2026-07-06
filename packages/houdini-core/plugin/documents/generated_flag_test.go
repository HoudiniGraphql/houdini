package documents_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
)

// documents written by the user keep generated = false; fragments the pipeline
// synthesizes during loading (inline component fields) are marked generated = true
// so tooling (eg the language server) can tell them apart.
func TestLoadDocuments_generatedFlag(t *testing.T) {
	db, err := plugins.NewTestPool[config.PluginConfig]()
	require.Nil(t, err)
	defer db.Close()
	core := &plugin.HoudiniCore{}
	core.SetDatabase(db)

	conn, err := db.Take(context.Background())
	require.Nil(t, err)
	defer db.Put(conn)

	require.Nil(t, tests.WriteDatabaseSchema(conn))

	statements, err, finalize := documents.PrepareDocumentInsertStatements(conn)
	require.Nil(t, err)
	defer finalize()

	typeCache, err := documents.LoadTypeCache(context.Background(), db)
	require.Nil(t, err)

	// a user-written query and fragment
	require.Nil(t, documents.LoadPendingQuery(context.Background(), db, conn, documents.PendingQuery{
		ID: 1,
		Query: `
			query UserList {
				users { ...UserRow }
			}
			fragment UserRow on User {
				name
			}
		`,
	}, statements, typeCache))

	// an inline component field — the pipeline turns this into a named fragment
	prop := "user"
	require.Nil(t, documents.LoadPendingQuery(context.Background(), db, conn, documents.PendingQuery{
		ID: 2,
		Query: `
			{
				... on User @componentField(field: "Avatar") {
					avatar
				}
			}
		`,
		InlineComponentField:     true,
		InlineComponentFieldProp: &prop,
	}, statements, typeCache))

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

	require.Equal(t, map[string]bool{
		"UserList":                      false,
		"UserRow":                       false,
		"__componentField__User_Avatar": true,
	}, got)

	// BeforeValidate clears generated documents so validation never sees pipeline
	// products, but inline component-field fragments are created at load time and
	// never recreated by AfterValidate — they must survive the cleanup
	require.Nil(t, core.BeforeValidate(context.Background()))
	survivor, err := conn.Prepare(`SELECT 1 FROM documents WHERE name = '__componentField__User_Avatar'`)
	require.Nil(t, err)
	defer survivor.Finalize()
	found, err := survivor.Step()
	require.Nil(t, err)
	require.True(t, found, "component-field fragment must survive BeforeValidate")
}
