package componentFields_test

import (
	"context"
	"fmt"
	"path"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/packages/houdini-core/plugin/componentFields"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
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
	db, err := plugins.NewPoolInMemory[config.PluginConfig]()
	if err != nil {
		t.Fatalf("failed to create in-memory db: %v", err)
	}
	defer db.Close()
	plugin := &plugin.HoudiniCore{}
	plugin.SetDatabase(db)

	conn, err := db.Take(context.Background())
	require.Nil(t, err)

	// write the schema to the database
	err = tests.WriteHoudiniSchema(conn)
	require.Nil(t, err)
	defer db.Put(conn)

	statements, err, finalize := documents.PrepareDocumentInsertStatements(conn)
	require.Nil(t, err)
	defer finalize()

	typeCaches, err := documents.LoadTypeCache(context.Background(), db)
	require.Nil(t, err)

	// load the query into the database as a pending query
	err = documents.LoadPendingQuery(context.Background(), db, conn, documents.PendingQuery{
		ID:                       1,
		Query:                    query,
		InlineComponentField:     true,
		InlineComponentFieldProp: strPtr("user"),
	}, statements, typeCaches)
	require.Nil(t, err)

	// now trigger the component fields portion of the process
	errs := &plugins.ErrorList{}
	componentFields.WriteMetadata(context.Background(), db, errs)
	require.Equal(t, 0, errs.Len(), errs.Error())

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

// there are a few situations that we need to catch before types are inserted
func TestComponentFieldChecks(t *testing.T) {
	// the local schema we'll test against``
	schema := `
		type User  {
			firstName: String
		}

		union Friend = User

		type Query {
			user: User
		}
	`

	table := []struct {
		Title     string
		Pass      bool
		Documents []string
	}{
		{
			Title: "allows non-overlapping types",
			Pass:  true,
			Documents: []string{
				`fragment MyFragmentOne on User @componentField(field: "Avatar", prop: "user") {
					firstName
				}`,
			},
		},
		{
			Title: "two componentFields can't overlap",
			Pass:  false,
			Documents: []string{
				`fragment MyFragmentOne on User  @componentField(field: "Avatar", prop: "user") {
					firstName
				}`,
				`fragment MyFragmentTwo on User  @componentField(field: "Avatar", prop: "user") {
					firstName
				}`,
			},
		},
		{
			Title: "componentFields can't overlap with type fields",
			Pass:  false,
			Documents: []string{
				`fragment MyFragmentOne on User  @componentField(field: "firstName", prop: "user") {
					firstName
				}`,
			},
		},
		{
			Title: "componentField on fragmentDefinition needs a prop",
			Pass:  false,
			Documents: []string{
				`fragment MyFragmentOne on User  @componentField(field: "firstName") {
					firstName
				}`,
			},
		},
		{
			Title: "componentFields on abstract types",
			Pass:  false,
			Documents: []string{
				`fragment MyFragmentOne on Friend  @componentField(field: "firstName", prop: "user") {
					firstName
				}`,
			},
		},
	}

	for _, test := range table {
		t.Run(test.Title, func(t *testing.T) {
			// create and wire up a database we can test against
			db, err := plugins.NewPoolInMemory[config.PluginConfig]()
			if err != nil {
				t.Fatalf("failed to create in-memory db: %v", err)
			}
			defer db.Close()
			plugin := &plugin.HoudiniCore{
				Fs: afero.NewMemMapFs(),
			}

			db.SetProjectConfig(plugins.ProjectConfig{
				ProjectRoot: "/project",
				SchemaPath:  "schema.graphql",
			})
			plugin.SetDatabase(db)

			// Use an in-memory file system.
			afero.WriteFile(
				plugin.Fs,
				path.Join("/project", "schema.graphql"),
				[]byte(schema),
				0644,
			)

			ctx := context.Background()
			conn, err := db.Take(ctx)
			require.Nil(t, err)
			// write the internal schema to the database
			err = tests.WriteHoudiniSchema(conn)
			require.Nil(t, err)

			// wire up the plugin
			err = plugin.Schema(ctx)
			require.Nil(t, err)
			// we're done with the database connection for now
			defer db.Put(conn)

			statements, err, finalize := documents.PrepareDocumentInsertStatements(conn)
			require.Nil(t, err)
			defer finalize()

			typeCaches, err := documents.LoadTypeCache(context.Background(), db)
			require.Nil(t, err)

			// load the query into the database as a pending query
			for i, doc := range test.Documents {
				err = documents.LoadPendingQuery(ctx, db, conn, documents.PendingQuery{
					ID:       i,
					Query:    doc,
					Filepath: fmt.Sprintf("file-%v", i),
				}, statements, typeCaches)
				require.Nil(t, err)
			}

			// now trigger the component fields portion of the process
			errs := &plugins.ErrorList{}
			componentFields.WriteMetadata(context.Background(), db, errs)

			if test.Pass {
				require.Equal(t, 0, errs.Len(), errs.GetItems())
			} else {
				require.NotEqual(t, 0, errs.Len())
			}
		})
	}
}

func strPtr(s string) *string {
	return &s
}
