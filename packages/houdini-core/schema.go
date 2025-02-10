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

	// all of the schema operations are done in a transaction
	close := sqlitex.Transaction(p.DB.Conn)
	commit := func(err error) error {
		close(&err)
		return err
	}

	// prepare the statements we'll use
	statements, finalize, err := prepareSchemaInsertStatements(p.DB)
	if err != nil {
		return err
	}
	defer finalize()

	// import the user's schema into the database
	err = writeProjectSchema(p.DB, schema, statements)
	if err != nil {
		return commit(err)
	}

	// write the internal schema
	err = writeInternalSchema(p.DB, statements)
	if err != nil {
		return commit(err)
	}

	// we're done
	return commit(nil)
}

func writeProjectSchema[PluginConfig any](db plugins.Database[PluginConfig], schema *ast.Schema, statements SchemaInsertStatements) error {
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
		err := db.ExecStatement(statements.InsertType, typ.Name, kind)
		if err != nil {
			return fmt.Errorf("error inserting type %s: %w", typ.Name, err)
		}

		// insert additional details based on type kind
		switch typ.Kind {
		case ast.Enum:
			// insert enum values
			for _, value := range typ.EnumValues {
				err = db.ExecStatement(statements.InsertEnumValue, typ.Name, value.Name)
				if err != nil {
					return fmt.Errorf("error inserting enum value %s for %s: %w", value.Name, typ.Name, err)
				}
			}

		case ast.Object:
			// insert fields and their arguments
			for _, field := range typ.Fields {
				fieldID := fmt.Sprintf("%s.%s", typ.Name, field.Name)
				err = db.ExecStatement(statements.InsertTypeField, fieldID, typ.Name, field.Name, field.Type.String())
				if err != nil {
					return fmt.Errorf("error inserting field %s for object %s: %w", field.Name, typ.Name, err)
				}
				for _, arg := range field.Arguments {
					err = db.ExecStatement(statements.InsertFieldArgument, fieldID, arg.Name, arg.Type.String(), "")
					if err != nil {
						return fmt.Errorf("error inserting field argument %s for %s: %w", arg.Name, fieldID, err)
					}
				}
			}

		case ast.InputObject:
			// insert input object fields
			for _, field := range typ.Fields {
				fieldID := fmt.Sprintf("%s.%s", typ.Name, field.Name)
				err = db.ExecStatement(statements.InsertInputTypeField, fieldID, typ.Name, field.Name, field.Type.String(), "")
				if err != nil {
					return fmt.Errorf("error inserting input field %s for %s: %w", field.Name, typ.Name, err)
				}
			}

		case ast.Interface:
			// insert interface fields
			for _, field := range typ.Fields {
				fieldID := fmt.Sprintf("%s.%s", typ.Name, field.Name)
				err = db.ExecStatement(statements.InsertTypeField, fieldID, typ.Name, field.Name, field.Type.String())
				if err != nil {
					return fmt.Errorf("error inserting interface field %s for %s: %w", field.Name, typ.Name, err)
				}
			}

			// add the interface implementors
			for _, impl := range schema.GetPossibleTypes(typ) {
				err = db.ExecStatement(statements.InsertInterfaceImplementor, typ.Name, impl.Name)
				if err != nil {
					return fmt.Errorf("error linking interface %s with implementor %s: %w", typ.Name, impl.Name, err)
				}
			}

		case ast.Union:
			// implement the union members in a deferred pass
			for _, member := range schema.GetPossibleTypes(typ) {
				err = db.ExecStatement(statements.InsertUnionMember, typ.Name, member.Name)
				if err != nil {
					return fmt.Errorf("error linking union %s with member %s: %w", typ.Name, member.Name, err)
				}
			}
		}
	}

	// process directives
	for _, directive := range schema.Directives {
		err := db.ExecStatement(statements.InsertDirective, directive.Name)
		if err != nil {
			return fmt.Errorf("error inserting directive %s: %w", directive.Name, err)
		}
		for _, location := range directive.Locations {
			err = db.ExecStatement(statements.InsertDirectiveLocation, directive.Name, string(location))
			if err != nil {
				return fmt.Errorf("error inserting directive location %s for %s: %w", location, directive.Name, err)
			}
		}
		for _, arg := range directive.Arguments {
			err = db.ExecStatement(statements.InsertDirectiveArgument, directive.Name, arg.Name, arg.Type.String(), "")
			if err != nil {
				return fmt.Errorf("error inserting directive argument %s for %s: %w", arg.Name, directive.Name, err)
			}
		}
	}

	// we're done
	return nil
}

// write the houdini internal schema bits
func writeInternalSchema[PluginConfig any](db plugins.Database[PluginConfig], statements SchemaInsertStatements) error {
	var err error

	// Add the ComponentFields scalar
	err = db.ExecStatement(statements.InsertInternalType, "Component", "SCALAR")
	if err != nil {
		return err
	}

	// @list(name: String!) on FIELD_DEFINITION
	err = db.ExecStatement(statements.InsertInternalDirective, "list", "@list is used to mark a field for "+
		"the runtime as a place to add or remove entities in mutations")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, "list", "FIELD_DEFINITION")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, "list", "name", "String!", nil)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, "list", "connection", "Boolean", nil)
	if err != nil {
		return err
	}

	// PaginateMode scalar
	err = db.ExecStatement(statements.InsertInternalType, "PaginateMode", "ENUM")
	if err != nil {
		return err
	}
	for _, value := range []string{"Infinite", "SinglePage"} {
		err = db.ExecStatement(statements.InsertEnumValue, "PaginateMode", value)
		if err != nil {
			return err
		}
	}

	// @paginate(name: String!, mode: PaginateMode) on FIELD
	err = db.ExecStatement(statements.InsertInternalDirective, "paginate", "@paginate is used to to mark a field for pagination.")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, "paginate", "FIELD")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, "paginate", "name", "String!", nil)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, "paginate", "mode", "PaginateMode", nil)
	if err != nil {
		return err
	}

	// @prepend on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, "prepend", "@prepend is used to tell the runtime to add the result to the end of the list")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, "prepend", "FRAGMENT_SPREAD")
	if err != nil {
		return err
	}

	// @append on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, "append", "@append is used to tell the runtime to add the result to the start of the list")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, "append", "FRAGMENT_SPREAD")
	if err != nil {
		return err
	}

	// DedupeMatchMode scalar
	err = db.ExecStatement(statements.InsertInternalType, "DedupeMatchMode", "ENUM")
	if err != nil {
		return err
	}
	for _, value := range []string{"Variables", "Operation", "None"} {
		err = db.ExecStatement(statements.InsertEnumValue, "DedupeMatchMode", value)
		if err != nil {
			return err
		}
	}

	// @dedupe(cancelFirst: Boolean, match: DedupeMatchMode) on QUERY and MUTATION
	err = db.ExecStatement(statements.InsertInternalDirective, "dedupe", `@dedupe is used to prevent an operation from running more than once at the same time.
	If the cancelFirst arg is set to true, the response already in flight will be canceled instead of the second one.
	If match is set to Operation, then a request will be deduplicated any time there is a request with the same operation.
	If it's set to Variables then the request will only be deduplicated if the variables match. If match is set to None,
	then the request will never be deduplicated.`)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, "dedupe", "QUERY")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, "dedupe", "MUTATION")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, "dedupe", "cancelFirst", "Boolean", nil)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, "dedupe", "match", "DedupeMatchMode", nil)
	if err != nil {
		return err
	}

	// @optimisticKey on FIELD
	err = db.ExecStatement(statements.InsertInternalDirective, "optimisticKey", "@optimisticKey is used to tell the runtime to use the value of the field as the key for optimistic updates.")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, "optimisticKey", "FIELD")
	if err != nil {
		return err
	}

	// @allLists on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, "allLists", "@allLists is used to tell the runtime to add the result to all lists in the cache.")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, "allLists", "FRAGMENT_SPREAD")

	// @parentID(value: ID!) on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, "parentID", "@parentID is used to provide a parentID without specifying position or in situations where it doesn't make sense (eg when deleting a node.)")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, "parentID", "FRAGMENT_SPREAD")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, "parentID", "value", "ID!", nil)
	if err != nil {
		return err
	}

	// @when on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, "when", "@when is used to provide a conditional or in situations where it doesn't make sense (eg when removing or deleting a node.)")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, "when", "FRAGMENT_SPREAD")

	// @when_not on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, "when_not", "@when_not is used to provide a conditional or in situations where it doesn't make sense (eg when removing or deleting a node.)")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, "when_not", "FRAGMENT_SPREAD")

	// @arguments on FRAGMENT_DEFINITION
	err = db.ExecStatement(statements.InsertInternalDirective, "arguments", "@arguments is used to define the arguments of a fragment.")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, "arguments", "FRAGMENT_DEFINITION")
	if err != nil {
		return err
	}

	// @with on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, "with", "@with  is used to provide arguments to fragments that have been marked with @arguments")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, "with", "FRAGMENT_SPREAD")
	if err != nil {
		return err
	}

	// CachePolicy enum
	err = db.ExecStatement(statements.InsertInternalType, "CachePolicy", "ENUM")
	if err != nil {
		return err
	}
	for _, value := range []string{"CacheAndNetwork", "CacheOnly", "CacheOrNetwork", "NetworkOnly", "NoCache"} {
		err = db.ExecStatement(statements.InsertEnumValue, "CachePolicy", value)
		if err != nil {
			return err
		}
	}

	// @cache(policy: CachePolicy, partial: Boolean) on QUERY
	err = db.ExecStatement(statements.InsertInternalDirective, "cache", "@cache is is used to specify cache rules for a query")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, "cache", "QUERY")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, "cache", "policy", "CachePolicy", nil)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, "cache", "partial", "Boolean", nil)
	if err != nil {
		return err
	}

	// @mask_enable on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, "mask_enable", "@mask_enable is used to to enable masking on fragment (overwriting the global conf)")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, "mask_enable", "FRAGMENT_SPREAD")
	if err != nil {
		return err
	}

	// @mask_disable on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, "mask_disable", "@mask_disable is used to to disable masking on fragment (overwriting the global conf)")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, "mask_disable", "FRAGMENT_SPREAD")
	if err != nil {
		return err
	}

	// @loading(count: Int, cascade: Boolean) on QUERY | FIELD | FRAGMENT_DEFINITION | FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, "loading", "@loading is used to shape the value of your documents while they are loading")
	if err != nil {
		return err
	}
	for _, loc := range []string{"FRAGMENT_SPREAD", "QUERY", "FIELD", "FRAGMENT_DEFINITION"} {
		err = db.ExecStatement(statements.InsertDirectiveLocation, "loading", loc)
		if err != nil {
			return err
		}
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, "loading", "count", "Int", nil)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, "loading", "cascade", "Boolean", nil)
	if err != nil {
		return err
	}

	// @required on FIELD
	err = db.ExecStatement(statements.InsertInternalDirective, "required", "@required makes a nullable field always non-null by making the parent null when the field is")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, "required", "FIELD")
	if err != nil {
		return err
	}

	// @componentField on FRAGMENT_DEFINITION | INLINE_FRAGMENT | FIELD_DEFINITION
	err = db.ExecStatement(statements.InsertInternalDirective, "componentField", "@componentField is used to mark a field as a component field")
	if err != nil {
		return err
	}
	for _, loc := range []string{"FRAGMENT_DEFINITION", "INLINE_FRAGMENT", "FIELD_DEFINITION"} {
		err = db.ExecStatement(statements.InsertDirectiveLocation, "componentField", loc)
		if err != nil {
			return err
		}
	}

	// we're done
	return nil
}

type SchemaInsertStatements struct {
	InsertType                 *sqlite.Stmt
	InsertInternalType         *sqlite.Stmt
	InsertTypeField            *sqlite.Stmt
	InsertInputTypeField       *sqlite.Stmt
	InsertInterfaceImplementor *sqlite.Stmt
	InsertUnionMember          *sqlite.Stmt
	InsertEnumValue            *sqlite.Stmt
	InsertFieldArgument        *sqlite.Stmt
	InsertDirective            *sqlite.Stmt
	InsertInternalDirective    *sqlite.Stmt
	InsertDirectiveLocation    *sqlite.Stmt
	InsertDirectiveArgument    *sqlite.Stmt
}

func prepareSchemaInsertStatements[PluginConfig any](db plugins.Database[PluginConfig]) (SchemaInsertStatements, func(), error) {
	// Prepare statements. (Check errors and defer closing each statement.)
	insertTypeStmt, err := db.Prepare("INSERT INTO types (name, kind) VALUES (?, ?)")
	if err != nil {
		return SchemaInsertStatements{}, func() {}, err
	}
	insertInternalTypeStmt, err := db.Prepare("INSERT INTO types (name, kind, internal) VALUES (?, ?, true)")
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

	insertInternalDirectiveStmt, err := db.Prepare("INSERT INTO directives (name, description, internal) VALUES (?, ?, true)")
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
		insertInternalDirectiveStmt.Finalize()
		insertInternalTypeStmt.Finalize()
	}

	return SchemaInsertStatements{
		InsertType:                 insertTypeStmt,
		InsertInternalType:         insertInternalTypeStmt,
		InsertInputTypeField:       insertInputTypeFieldStmt,
		InsertTypeField:            insertTypeFieldStmt,
		InsertInterfaceImplementor: insertInterfaceImplementorStmt,
		InsertUnionMember:          insertUnionMemberStmt,
		InsertEnumValue:            insertEnumValueStmt,
		InsertFieldArgument:        insertFieldArgumentStmt,
		InsertDirective:            insertDirectiveStmt,
		InsertInternalDirective:    insertInternalDirectiveStmt,
		InsertDirectiveLocation:    insertDirectiveLocationStmt,
		InsertDirectiveArgument:    insertDirectiveArgumentStmt,
	}, finalize, nil
}
