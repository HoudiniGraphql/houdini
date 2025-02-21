package runtimeScalars_test

import (
	"context"
	"testing"

	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/packages/houdini-core/plugin/runtimeScalars"
	"code.houdinigraphql.com/plugins"

	"github.com/stretchr/testify/require"
)

func TestRuntimeScalars(t *testing.T) {
	// a query with a runtime scalar needs to be extracted as a
	// query with the equivalent scalar type and the runtime scalar directive
	query := `
		query UserInfo($user: UserFromSession!) {
			user(id: $user)
		}
	`

	// create and wire up a database we can test against
	db, err := plugins.NewPoolInMemory[plugin.PluginConfig]()
	if err != nil {
		t.Fatalf("failed to create in-memory db: %v", err)
	}
	defer db.Close()
	db.SetProjectConfig(plugins.ProjectConfig{
		RuntimeScalars: map[string]string{
			"UserFromSession": "ID",
		},
	})
	plugin := &plugin.HoudiniCore{}
	plugin.SetDatabase(db)

	conn, err := db.Take(context.Background())
	require.Nil(t, err)

	// write the schema to the database
	err = plugins.WriteHoudiniSchema(conn)
	db.Put(conn)
	require.Nil(t, err)

	// load the query into the database as a pending query
	err = documents.LoadPendingQuery(db, documents.PendingQuery{
		ID:    1,
		Query: query,
	})
	require.Nil(t, err)

	// now trigger the component fields portion of the proces
	errs := &plugins.ErrorList{}
	runtimeScalars.TransformVariables(context.Background(), db, conn, errs)
	require.Equal(t, 0, errs.Len(), errs.Error())

	// to check that the query was extracted correctly we need to look up the query
	// we just created along with its inputs and any directives
	queryRow, err := conn.Prepare(`
		SELECT
			documents.name,
			operation_variable_directive_arguments.name,
			operation_variable_directive_arguments.value
		FROM documents
			JOIN document_variables ON documents.id = document_variables.document
			JOIN operation_variable_directives ON document_variables.id = operation_variable_directives.parent
			JOIN operation_variable_directive_arguments ON operation_variable_directives.id = operation_variable_directive_arguments.parent
		WHERE documents.name = ?
	`)
	require.Nil(t, err)
	queryRow.BindText(1, "UserInfo")
	defer queryRow.Finalize()
	queryRow.Step()

	documentName := queryRow.ColumnText(0)
	name := queryRow.ColumnText(1)
	value := queryRow.ColumnText(2)

	require.Equal(t, "UserInfo", documentName)
	require.Equal(t, "type", name)
	require.Equal(t, "UserFromSession", value)
}
