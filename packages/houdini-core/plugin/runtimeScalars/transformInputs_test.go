package runtimeScalars_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/packages/houdini-core/plugin/runtimeScalars"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
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
	db, err := plugins.NewPoolInMemory[config.PluginConfig]()
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
	defer db.Put(conn)

	// write the schema to the database
	err = tests.WriteHoudiniSchema(conn)
	require.Nil(t, err)

	statements, err, finalize := documents.PrepareDocumentInsertStatements(conn)
	require.Nil(t, err)
	defer finalize()

	typeCaches, err := documents.LoadTypeCache(context.Background(), db)
	require.Nil(t, err)

	// load the query into the database as a pending query
	err = documents.LoadPendingQuery(context.Background(), db, conn, documents.PendingQuery{
		ID:    1,
		Query: query,
	}, statements, typeCaches)
	require.Nil(t, err)

	// now trigger the component fields portion of the proces
	errs := &plugins.ErrorList{}
	runtimeScalars.TransformVariables(context.Background(), db, errs)
	require.Equal(t, 0, errs.Len(), errs.Error())

	// to check that the query was extracted correctly we need to look up the query
	// we just created along with its inputs and any directives
	queryRow, err := conn.Prepare(`
		SELECT
			documents.name,
			document_variable_directive_arguments.name,
			document_variable_directive_arguments.value
		FROM documents
			JOIN document_variables ON documents.id = document_variables.document
			JOIN document_variable_directives ON document_variables.id = document_variable_directives.parent
			JOIN document_variable_directive_arguments ON document_variable_directives.id = document_variable_directive_arguments.parent
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
