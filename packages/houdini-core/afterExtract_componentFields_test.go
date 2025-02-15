package main

import (
	"context"
	"testing"

	"code.houdinigraphql.com/plugins"
	"github.com/stretchr/testify/require"
)

func TestComponentFields(t *testing.T) {
	// in order to verify that component fields are loaded properly we need to parse a file
	// containing an inline query with the correct shape
	query := `
		{
			... on User @componentField(field: "Avatar") {
				avatar
			}
		}
	`

	// create and wire up a database we can test against
	db, err := plugins.NewPoolInMemory[PluginConfig]()
	if err != nil {
		t.Fatalf("failed to create in-memory db: %v", err)
	}
	defer db.Close()
	plugin := &HoudiniCore{}
	plugin.SetDatabase(db)

	conn, err := db.Take(context.Background())
	require.Nil(t, err)

	// write the schema to the database
	err = executeSchema(conn)
	require.Nil(t, err)
	db.Put(conn)

	// load the query into the database as a pending query
	err = plugin.afterExtract_loadPendingQuery(PendingQuery{
		ID:                       1,
		Query:                    query,
		InlineComponentField:     true,
		InlineComponentFieldProp: strPtr("user"),
	})
	require.Nil(t, err)

	// now trigger the component fields portion of the process
	errs := &plugins.ErrorList{}
	plugin.afterExtract_componentFields(conn, errs)
	require.Equal(t, 0, errs.Len())

	// there should be an entry for User.Avatar in the type fields table
	search, err := conn.Prepare("SELECT parent, name, type, internal FROM type_fields where id = ?")
	require.Nil(t, err)
	defer search.Finalize()

	// bind the id to the query
	search.BindText(1, "User.Avatar")

	// exceute the query and parse the results
	hasData, err := search.Step()
	require.Nil(t, err)
	require.True(t, hasData)
	require.Equal(t, "User", search.ColumnText(0))
	require.Equal(t, "Avatar", search.ColumnText(1))
	require.Equal(t, "Component", search.ColumnText(2))
	require.Equal(t, true, search.ColumnBool(3))
}
