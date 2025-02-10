package main

import (
	"context"
	"fmt"
	"os"
	"path"

	"code.houdinigraphql.com/plugins"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"zombiezen.com/go/sqlite"
	"zombiezen.com/go/sqlite/sqlitex"
)

// The core plugin is responsible for parsing the users schrma file and loading it into the database
func (p *HoudiniCore) Schema(ctx context.Context) error {
	// the first thing we have to do is import the schema from the database
	config, err := p.DB.ProjectConfig()
	if err != nil {
		return err
	}

	// read the schema file
	file, err := os.ReadFile(path.Join(config.ProjectRoot, config.SchemaPath))
	if err != nil {
		return err
	}

	// parse and validate the schema
	schema, err := gqlparser.LoadSchema(&ast.Source{
		Input: string(file),
	})
	if err != nil {
		return err
	}

	// import the user's schema into the database
	err = writeSchema(p.DB, schema)
	if err != nil {
		return err
	}

	// we're done
	return nil
}

func writeSchema[PluginConfig any](db plugins.Database[PluginConfig], schema *ast.Schema) error {
	close := sqlitex.Transaction(db.Conn)
	commit := func(err error) {
		close(&err)
	}

	execStmt := func(stmt *sqlite.Stmt, binds ...string) error {
		for i, bind := range binds {
			stmt.BindText(i+1, bind)
		}
		return db.ExecStatement(stmt)
	}

	statements, finalize, err := prepareSchemaInsertStatements(db)
	if err != nil {
		return err
	}
	defer finalize()

	// in a single pass over all types, insert the type and any associated details.
	// the type references are deferrable foreign keys, so we can insert them in any order
	for _, typ := range schema.Types {
		// Determine the kind string
		var kind string
		switch typ.Kind {
		case ast.Scalar:
			kind = "SCALAR"
		case ast.Enum:
			kind = "ENUM"
		case ast.Object:
			kind = "OBJECT"
		case ast.Interface:
			kind = "INTERFACE"
		case ast.Union:
			kind = "UNION"
		case ast.InputObject:
			kind = "INPUT"
		default:
			continue
		}

		// insert the type row
		err = execStmt(statements.InsertType, typ.Name, kind)
		if err != nil {
			err = fmt.Errorf("error inserting type %s: %w", typ.Name, err)
			commit(err)
			return err
		}

		// insert additional details based on type kind
		switch typ.Kind {
		case ast.Enum:
			// insert enum values
			for _, value := range typ.EnumValues {
				err = execStmt(statements.InsertEnumValue, typ.Name, value.Name)
				if err != nil {
					err = fmt.Errorf("error inserting enum value %s for %s: %w", value.Name, typ.Name, err)
					commit(err)
					return err
				}
			}

		case ast.Object:
			// insert fields and their arguments
			for _, field := range typ.Fields {
				fieldID := fmt.Sprintf("%s.%s", typ.Name, field.Name)
				err = execStmt(statements.InsertTypeField, fieldID, typ.Name, field.Name, field.Type.String())
				if err != nil {
					err = fmt.Errorf("error inserting field %s for object %s: %w", field.Name, typ.Name, err)
					commit(err)
					return err
				}
				for _, arg := range field.Arguments {
					err = execStmt(statements.InsertFieldArgument, fieldID, arg.Name, arg.Type.String(), "")
					if err != nil {
						err = fmt.Errorf("error inserting field argument %s for %s: %w", arg.Name, fieldID, err)
						commit(err)
						return err
					}
				}
			}

		case ast.InputObject:
			// insert input object fields
			for _, field := range typ.Fields {
				fieldID := fmt.Sprintf("%s.%s", typ.Name, field.Name)
				err = execStmt(statements.InsertInputTypeField, fieldID, typ.Name, field.Name, field.Type.String(), "")
				if err != nil {
					err = fmt.Errorf("error inserting input field %s for %s: %w", field.Name, typ.Name, err)
					commit(err)
					return err
				}
			}

		case ast.Interface:
			// insert interface fields
			for _, field := range typ.Fields {
				fieldID := fmt.Sprintf("%s.%s", typ.Name, field.Name)
				err = execStmt(statements.InsertTypeField, fieldID, typ.Name, field.Name, field.Type.String())
				if err != nil {
					err = fmt.Errorf("error inserting interface field %s for %s: %w", field.Name, typ.Name, err)
					commit(err)
					return err
				}
			}

			// add the interface implementors
			for _, impl := range schema.GetPossibleTypes(typ) {
				err = execStmt(statements.InsertInterfaceImplementor, typ.Name, impl.Name)
				if err != nil {
					err = fmt.Errorf("error linking interface %s with implementor %s: %w", typ.Name, impl.Name, err)
					commit(err)
					return err
				}
			}

		case ast.Union:
			// implement the union members in a deferred pass
			for _, member := range schema.GetPossibleTypes(typ) {
				err = execStmt(statements.InsertUnionMember, typ.Name, member.Name)
				if err != nil {
					err = fmt.Errorf("error linking union %s with member %s: %w", typ.Name, member.Name, err)
					commit(err)
					return err
				}
			}
		}
	}

	// process directives
	for _, directive := range schema.Directives {
		err = execStmt(statements.InsertDirective, directive.Name)
		if err != nil {
			err = fmt.Errorf("error inserting directive %s: %w", directive.Name, err)
			commit(err)
			return err
		}
		for _, location := range directive.Locations {
			err = execStmt(statements.InsertDirectiveLocation, directive.Name, string(location))
			if err != nil {
				err = fmt.Errorf("error inserting directive location %s for %s: %w", location, directive.Name, err)
				commit(err)
				return err
			}
		}
		for _, arg := range directive.Arguments {
			err = execStmt(statements.InsertDirectiveArgument, directive.Name, arg.Name, arg.Type.String(), "")
			if err != nil {
				err = fmt.Errorf("error inserting directive argument %s for %s: %w", arg.Name, directive.Name, err)
				commit(err)
				return err
			}
		}
	}

	// commit the transaction
	commit(nil)
	return nil
}

type SchemaInsertStatements struct {
	InsertType                 *sqlite.Stmt
	InsertTypeField            *sqlite.Stmt
	InsertInputTypeField       *sqlite.Stmt
	InsertInterfaceImplementor *sqlite.Stmt
	InsertUnionMember          *sqlite.Stmt
	InsertEnumValue            *sqlite.Stmt
	InsertFieldArgument        *sqlite.Stmt
	InsertDirective            *sqlite.Stmt
	InsertDirectiveLocation    *sqlite.Stmt
	InsertDirectiveArgument    *sqlite.Stmt
}

func prepareSchemaInsertStatements[PluginConfig any](db plugins.Database[PluginConfig]) (SchemaInsertStatements, func(), error) {
	// Prepare statements. (Check errors and defer closing each statement.)
	insertTypeStmt, err := db.Prepare("INSERT INTO types (name, kind) VALUES (?, ?)")
	if err != nil {
		return SchemaInsertStatements{}, func() {}, err
	}

	insertInputTypeFieldStmt, err := db.Prepare("INSERT INTO input_fields (id, parent, name, type, default_value) VALUES (?, ?, ?, ?, ?)")
	if err != nil {
		return SchemaInsertStatements{}, func() {}, err
	}

	insertTypeFieldStmt, err := db.Prepare("INSERT INTO type_fields (id, parent, name, type) VALUES (?, ?, ?, ?)")
	if err != nil {
		return SchemaInsertStatements{}, func() {}, err
	}

	insertInterfaceImplementorStmt, err := db.Prepare("INSERT INTO implemented_interfaces (parent, interface_type) VALUES (?, ?)")
	if err != nil {
		return SchemaInsertStatements{}, func() {}, err
	}

	insertUnionMemberStmt, err := db.Prepare("INSERT INTO union_member_types (parent, member_type) VALUES (?, ?)")
	if err != nil {
		return SchemaInsertStatements{}, func() {}, err
	}

	insertEnumValueStmt, err := db.Prepare("INSERT INTO enum_values (parent, value) VALUES (?, ?)")
	if err != nil {
		return SchemaInsertStatements{}, func() {}, err
	}

	insertFieldArgumentStmt, err := db.Prepare("INSERT INTO field_argument_definitions (field, name, type, default_value) VALUES (?, ?, ?, ?)")
	if err != nil {
		return SchemaInsertStatements{}, func() {}, err
	}

	insertDirectiveStmt, err := db.Prepare("INSERT INTO directives (name) VALUES (?)")
	if err != nil {
		return SchemaInsertStatements{}, func() {}, err
	}

	insertDirectiveLocationStmt, err := db.Prepare("INSERT INTO directive_locations (directive, location) VALUES (?, ?)")
	if err != nil {
		return SchemaInsertStatements{}, func() {}, err
	}

	insertDirectiveArgumentStmt, err := db.Prepare("INSERT INTO directive_arguments (parent, name, type, default_value) VALUES (?, ?, ?, ?)")
	if err != nil {
		return SchemaInsertStatements{}, func() {}, err
	}

	finalize := func() {
		insertTypeStmt.Finalize()
		insertInputTypeFieldStmt.Finalize()
		insertTypeFieldStmt.Finalize()
		insertInterfaceImplementorStmt.Finalize()
		insertUnionMemberStmt.Finalize()
		insertEnumValueStmt.Finalize()
		insertFieldArgumentStmt.Finalize()
		insertDirectiveStmt.Finalize()
		insertDirectiveLocationStmt.Finalize()
		insertDirectiveArgumentStmt.Finalize()
	}

	return SchemaInsertStatements{
		InsertType:                 insertTypeStmt,
		InsertInputTypeField:       insertInputTypeFieldStmt,
		InsertTypeField:            insertTypeFieldStmt,
		InsertInterfaceImplementor: insertInterfaceImplementorStmt,
		InsertUnionMember:          insertUnionMemberStmt,
		InsertEnumValue:            insertEnumValueStmt,
		InsertFieldArgument:        insertFieldArgumentStmt,
		InsertDirective:            insertDirectiveStmt,
		InsertDirectiveLocation:    insertDirectiveLocationStmt,
		InsertDirectiveArgument:    insertDirectiveArgumentStmt,
	}, finalize, nil
}
