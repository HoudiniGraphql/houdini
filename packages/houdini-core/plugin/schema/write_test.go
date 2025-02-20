package schema_test

import (
	"context"
	"path"
	"testing"

	houdiniCore "code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"
)

func TestSchema(t *testing.T) {
	tests := []struct {
		name        string
		setupFs     func(fs afero.Fs) error
		expectError bool
		// For valid cases we supply expected user types and fields.
		expectedTypes []expectedType
	}{
		{
			name: "missing schema file",
			setupFs: func(fs afero.Fs) error {
				// Do nothing; file is missing.
				return nil
			},
			expectError: true,
		},
		{
			name: "invalid schema content",
			setupFs: func(fs afero.Fs) error {
				// Write invalid schema content.
				invalid := "this is not a valid graphql schema"
				return afero.WriteFile(fs, path.Join("/project", "schema.graphql"), []byte(invalid), 0644)
			},
			expectError: true,
		},
		{
			name: "valid schema with correct import",
			setupFs: func(fs afero.Fs) error {
				schemaContent := `
					scalar DateTime

					type User {
						id: ID!
						name: String
						friends: [User!]!
					}

					type Query {
						user: User
					}
				`
				return afero.WriteFile(fs, path.Join("/project", "schema.graphql"), []byte(schemaContent), 0644)
			},
			expectError: false,
			// Expected user types (we check only those not inserted as “internal”).
			expectedTypes: []expectedType{
				{
					Name:   "DateTime",
					Fields: []expectedField{},
				},
				{
					Name: "User",
					Fields: []expectedField{
						{Name: "id", Type: "ID", TypeModifier: "!"},
						{Name: "name", Type: "String", TypeModifier: ""},
						{Name: "friends", Type: "User", TypeModifier: "!]!"},
					},
				},
				{
					Name: "Query",
					Fields: []expectedField{
						{Name: "user", Type: "User", TypeModifier: ""},
					},
				},
			},
		},
	}

	for _, tc := range tests {
		tc := tc // capture range variable
		t.Run(tc.name, func(t *testing.T) {
			// Use an in-memory file system.
			fs := afero.NewMemMapFs()
			if err := tc.setupFs(fs); err != nil {
				t.Fatalf("failed to set up file system: %v", err)
			}

			// Instantiate an in-memory database and set the project config.
			db, _ := plugins.NewPoolInMemory[houdiniCore.PluginConfig]()
			defer db.Close()
			db.SetProjectConfig(plugins.ProjectConfig{
				ProjectRoot: "/project",
				SchemaPath:  "schema.graphql",
			})

			conn, err := db.Take(context.Background())
			require.Nil(t, err)

			err = plugins.WriteHoudiniSchema(conn)
			db.Put(conn)
			require.Nil(t, err)

			// Create the HoudiniCore instance and set its DB.
			core := &houdiniCore.HoudiniCore{Fs: fs}
			core.SetDatabase(db)

			// Call the Schema method.
			err = core.Schema(context.Background())
			if tc.expectError {
				if err == nil {
					t.Fatalf("expected an error but got nil")
				}
				// Error was expected; no further checks.
				return
			} else if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			// Query the "types" table for user types (non-internal).
			typesMap, err := queryTypes(db)
			if err != nil {
				t.Fatalf("failed to query types: %v", err)
			}
			// Check that each expected type is present.
			for _, et := range tc.expectedTypes {
				if !typesMap[et.Name] {
					t.Errorf("expected type %q not found in DB", et.Name)
				}
			}

			// Query the "type_fields" table for user-defined fields.
			fieldsMap, err := queryTypeFields(db)
			if err != nil {
				t.Fatalf("failed to query type_fields: %v", err)
			}
			// For each expected type that has fields, verify the imported fields.
			for _, et := range tc.expectedTypes {
				// (It is possible that internal schema additions add extra types/fields;
				// here we only check that the expected fields are among those imported for the type.)
				gotFields := fieldsMap[et.Name]
				// Create a map for easier lookup.
				gotMap := make(map[string]expectedField)
				for _, gf := range gotFields {
					gotMap[gf.Name] = gf
				}
				for _, ef := range et.Fields {
					gf, ok := gotMap[ef.Name]
					if !ok {
						t.Errorf("expected field %q in type %q not found", ef.Name, et.Name)
						continue
					}
					if gf.Type != ef.Type {
						t.Errorf("for type %q field %q, expected base type %q but got %q", et.Name, ef.Name, ef.Type, gf.Type)
					}
					if gf.TypeModifier != ef.TypeModifier {
						t.Errorf("for type %q field %q, expected type modifier %q but got %q", et.Name, ef.Name, ef.TypeModifier, gf.TypeModifier)
					}
				}
			}
		})
	}
}

type expectedField struct {
	Name         string
	Type         string // base type name (e.g. "User", "ID", "String")
	TypeModifier string // the “wrapper” part (e.g. "!" or "!]!" for list types)
}

type expectedType struct {
	Name   string
	Fields []expectedField
}

// queryTypes returns a map from type name to true for all types in the
// "types" table that were imported as user types (i.e. not internal).
func queryTypes(db plugins.DatabasePool[houdiniCore.PluginConfig]) (map[string]bool, error) {
	typesMap := make(map[string]bool)
	conn, err := db.Take(context.Background())
	if err != nil {
		return nil, err
	}
	defer db.Put(conn)
	stmt, err := conn.Prepare("SELECT name FROM types WHERE internal = false")
	if err != nil {
		return nil, err
	}
	defer stmt.Finalize()
	for {
		hasRow, err := stmt.Step()
		if err != nil {
			return nil, err
		}
		if !hasRow {
			break
		}
		typesMap[stmt.ColumnText(0)] = true
	}
	return typesMap, nil
}

// queryTypeFields returns a map from a parent type name to a slice of expectedField
// (populated from the "type_fields" table for user types).
func queryTypeFields(db plugins.DatabasePool[houdiniCore.PluginConfig]) (map[string][]expectedField, error) {
	conn, err := db.Take(context.Background())
	if err != nil {
		return nil, err
	}
	defer db.Put(conn)

	fieldsMap := make(map[string][]expectedField)
	stmt, err := conn.Prepare("SELECT parent, name, type, type_modifiers FROM type_fields WHERE internal = false")
	if err != nil {
		return nil, err
	}
	defer stmt.Finalize()
	for {
		hasRow, err := stmt.Step()
		if err != nil {
			return nil, err
		}
		if !hasRow {
			break
		}
		parent := stmt.ColumnText(0)
		fieldsMap[parent] = append(fieldsMap[parent], expectedField{
			Name:         stmt.ColumnText(1),
			Type:         stmt.ColumnText(2),
			TypeModifier: stmt.ColumnText(3),
		})
	}
	return fieldsMap, nil
}
