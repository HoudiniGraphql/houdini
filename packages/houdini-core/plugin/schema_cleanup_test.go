package plugin_test

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
)

// schemaCore sets up an in-memory DB and a HoudiniCore pointed at schemaContent.
func schemaCore(t *testing.T, schemaContent string) (*plugin.HoudiniCore, plugins.DatabasePool[config.PluginConfig]) {
	t.Helper()
	fs := afero.NewMemMapFs()
	require.NoError(t, afero.WriteFile(fs, filepath.Join("/project", "schema.graphql"), []byte(schemaContent), 0644))

	db, _ := plugins.NewTestPool[config.PluginConfig]()
	t.Cleanup(func() { db.Close() })
	db.SetProjectConfig(plugins.ProjectConfig{
		ProjectRoot: "/project",
		SchemaPath:  "schema.graphql",
	})

	conn, err := db.Take(context.Background())
	require.NoError(t, err)
	require.NoError(t, tests.WriteDatabaseSchema(conn))
	db.Put(conn)

	core := &plugin.HoudiniCore{}
	core.SetFilesystem(fs)
	core.SetDatabase(db)
	return core, db
}

// typeFieldIDs returns the set of type_field ids present in the DB.
func typeFieldIDs(t *testing.T, db plugins.DatabasePool[config.PluginConfig]) map[string]bool {
	t.Helper()
	conn, err := db.Take(context.Background())
	require.NoError(t, err)
	defer db.Put(conn)

	stmt, err := conn.Prepare(`SELECT id FROM type_fields WHERE internal = false`)
	require.NoError(t, err)
	defer stmt.Finalize()

	ids := map[string]bool{}
	for {
		ok, err := stmt.Step()
		require.NoError(t, err)
		if !ok {
			break
		}
		ids[stmt.ColumnText(0)] = true
	}
	return ids
}

// TestSchema_StaleFieldsRemovedOnSchemaChange verifies that when a field is
// removed from the schema and Schema() is called again, the stale type_field
// row is deleted rather than left behind.
func TestSchema_StaleFieldsRemovedOnSchemaChange(t *testing.T) {
	v1 := `
		type User {
			id: ID!
			name: String!
			deprecated: String
		}
		type Query { user: User }
	`
	core, db := schemaCore(t, v1)
	require.NoError(t, core.Schema(context.Background()))

	ids := typeFieldIDs(t, db)
	require.True(t, ids["User.deprecated"], "User.deprecated should exist after first Schema() call")

	// Update the in-memory filesystem to a schema without User.deprecated.
	v2 := `
		type User {
			id: ID!
			name: String!
		}
		type Query { user: User }
	`
	require.NoError(t, afero.WriteFile(
		core.Filesystem(), filepath.Join("/project", "schema.graphql"), []byte(v2), 0644,
	))
	require.NoError(t, core.Schema(context.Background()))

	ids = typeFieldIDs(t, db)
	require.False(t, ids["User.deprecated"], "User.deprecated should be removed after second Schema() call")
	require.True(t, ids["User.id"], "User.id should still be present")
	require.True(t, ids["User.name"], "User.name should still be present")
}

// TestSchema_ComponentLinkedFieldPreserved verifies that type_field rows
// referenced by a component_fields row survive a Schema() call even when the
// field is not part of the GraphQL schema (component fields are registered by a
// separate plugin after Schema runs).
func TestSchema_ComponentLinkedFieldPreserved(t *testing.T) {
	v1 := `
		type User { id: ID! }
		type Query { user: User }
	`
	core, db := schemaCore(t, v1)
	require.NoError(t, core.Schema(context.Background()))

	// Manually insert the type_fields + component_fields rows that a component
	// plugin would normally create.
	conn, err := db.Take(context.Background())
	require.NoError(t, err)

	// Insert a raw_document row (component_fields requires it via FK).
	insertDoc, err := conn.Prepare(`INSERT INTO raw_documents (filepath, content) VALUES ($p, $c)`)
	require.NoError(t, err)
	insertDoc.SetText("$p", "/project/Component.tsx")
	insertDoc.SetText("$c", "")
	_, err = insertDoc.Step()
	require.NoError(t, err)
	insertDoc.Finalize()
	docID := conn.LastInsertRowID()

	// Insert the type_field for User.componentField (not in the schema).
	insertField, err := conn.Prepare(`
		INSERT INTO type_fields (id, parent, name, type, type_modifiers, internal)
		VALUES ($id, $parent, $name, $type, $tm, false)
	`)
	require.NoError(t, err)
	insertField.SetText("$id", "User.componentField")
	insertField.SetText("$parent", "User")
	insertField.SetText("$name", "componentField")
	insertField.SetText("$type", "String")
	insertField.SetText("$tm", "")
	_, err = insertField.Step()
	require.NoError(t, err)
	insertField.Finalize()

	// Link it via component_fields.
	insertCF, err := conn.Prepare(`
		INSERT INTO component_fields (document, type_field, prop, field)
		VALUES ($doc, $tf, $prop, $field)
	`)
	require.NoError(t, err)
	insertCF.SetInt64("$doc", docID)
	insertCF.SetText("$tf", "User.componentField")
	insertCF.SetText("$prop", "component")
	insertCF.SetText("$field", "componentField")
	_, err = insertCF.Step()
	require.NoError(t, err)
	insertCF.Finalize()
	db.Put(conn)

	// Run Schema() again — it should remove plain stale fields but preserve
	// the component_fields-linked User.componentField row.
	require.NoError(t, core.Schema(context.Background()))

	ids := typeFieldIDs(t, db)
	require.True(t, ids["User.componentField"],
		"User.componentField should be preserved because component_fields references it")
	require.True(t, ids["User.id"], "User.id should still be present")
}
