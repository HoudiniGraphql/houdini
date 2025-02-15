package main

import (
	"testing"

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
	db, err := plugins.InMemoryDB[PluginConfig]()
	if err != nil {
		t.Fatalf("failed to create in-memory db: %v", err)
	}
	defer db.Close()
	db.SetProjectConfig(plugins.ProjectConfig{
		RuntimeScalars: map[string]string{
			"UserFromSession": "ID",
		},
	})
	plugin := &HoudiniCore{}
	plugin.SetDatabase(db)

	// write the schema to the database
	err = executeSchema(db.Conn)
	require.Nil(t, err)

	// prepare the statements we'll need to insert the document into the database
	statements, _ := (&HoudiniCore{}).prepareDocumentInsertStatements(db)

	// load the query into the database as a pending query
	err = plugin.afterExtract_loadPendingQuery(PendingQuery{
		ID:    1,
		Query: query,
	}, db, statements)
	require.Nil(t, err)

	// now trigger the component fields portion of the proces
	errs := &plugins.ErrorList{}
	plugin.afterExtract_runtimeScalars(db, errs)
	require.Equal(t, 0, errs.Len())

	// to check that the query was extracted correctly we need to look up the query
	// we just created along with its inputs and any directives
	queryRow, err := db.Prepare(`
		SELECT
			documents.name,
			operation_variable_directive_arguments.name,
			operation_variable_directive_arguments.value
		FROM documents
			JOIN operation_variables ON documents.id = operation_variables.document
			JOIN operation_variable_directives ON operation_variables.id = operation_variable_directives.parent
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
