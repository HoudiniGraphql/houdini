package main

import (
	"fmt"
	"os"

	"code.houdinigraphql.com/plugins"
	"zombiezen.com/go/sqlite"

	"github.com/joho/godotenv"
	"github.com/spf13/afero"
)

func main() {
	// run the plugin
	err := plugins.Run(&HoudiniCore{
		fs: afero.NewOsFs(),
	})
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

type HoudiniCore struct {
	plugins.Plugin[PluginConfig]
	fs                       afero.Fs
	documentInsertStatements DocumentInsertStatements
	schemaInsertStatements   SchemaInsertStatements
}

type PluginConfig = any

func (p *HoudiniCore) Name() string {
	return "houdini-core"
}

func (p *HoudiniCore) SetFs(fs afero.Fs) {
	p.fs = fs
}

func (p *HoudiniCore) Order() plugins.PluginOrder {
	return plugins.PluginOrderCore
}

func (p *HoudiniCore) Environment(mode string) (map[string]string, error) {
	// build up the environment variables using the vite rules laid out here: https://vite.dev/guide/env-and-mode
	result := map[string]string{}

	// process each file and add the variables to the result
	for _, file := range []string{
		".env",
		".env.local",
		fmt.Sprintf(".env.%s", mode),
		fmt.Sprintf(".env.%s.local", mode),
	} {
		env, err := godotenv.Read(file)
		// if the file doesn't exist then we keep to keep going
		if err != nil {
			continue
		}

		// assign the variables to the result
		for k, v := range env {
			result[k] = v
		}
	}

	// we're done
	return result, nil
}

type DocumentInsertStatements struct {
	InsertDocument                          *sqlite.Stmt
	InsertDocumentVariable                  *sqlite.Stmt
	InsertDocumentVariableDirective         *sqlite.Stmt
	InsertDocumentVariableDirectiveArgument *sqlite.Stmt
	InsertSelection                         *sqlite.Stmt
	InsertSelectionRef                      *sqlite.Stmt
	InsertSelectionArgument                 *sqlite.Stmt
	InsertSelectionDirective                *sqlite.Stmt
	InsertSelectionDirectiveArgument        *sqlite.Stmt
	InsertDocumentDirective                 *sqlite.Stmt
	InsertDocumentDirectiveArgument         *sqlite.Stmt
}

func (p *HoudiniCore) prepareDocumentInsertStatements(db plugins.Database[PluginConfig]) (DocumentInsertStatements, func()) {
	insertDocument := db.Conn.Prep("INSERT INTO documents (name, raw_document, kind, type_condition) VALUES (?, ?, ?, ?)")
	insertDocumentVariable := db.Conn.Prep("INSERT INTO operation_variables (document, name, type, type_modifiers, default_value) VALUES (?, ?, ?, ?, ?)")
	insertSelection := db.Conn.Prep("INSERT INTO selections (field_name, alias, path_index, kind, type) VALUES (?, ?, ?, ?, ?)")
	insertSelectionArgument := db.Conn.Prep("INSERT INTO selection_arguments (selection_id, name, value) VALUES (?, ?, ?)")
	insertSelectionRef := db.Conn.Prep("INSERT INTO selection_refs (parent_id, child_id, document, row, column) VALUES (?, ?, ?, ?, ?)")
	insertSelectionDirective := db.Conn.Prep("INSERT INTO selection_directives (selection_id, directive) VALUES (?, ?)")
	insertSelectionDirectiveArgument := db.Conn.Prep("INSERT INTO selection_directive_arguments (parent, name, value) VALUES (?, ?, ?)")
	insertDocumentDirective := db.Conn.Prep("INSERT INTO document_directives (document, directive) VALUES (?, ?)")
	insertDocumentDirectiveArgument := db.Conn.Prep("INSERT INTO document_directive_arguments (parent, name, value) VALUES (?, ?, ?)")
	insertDocumentVariableDirective := db.Conn.Prep("INSERT INTO operation_variable_directives (parent, directive) VALUES (?, ?)")
	insertDocumentVariableDirectiveArgument := db.Conn.Prep("INSERT INTO operation_variable_directive_arguments (parent, name, value) VALUES (?, ?, ?)")

	finalize := func() {
		insertDocument.Finalize()
		insertDocumentVariable.Finalize()
		insertSelection.Finalize()
		insertSelectionArgument.Finalize()
		insertSelectionRef.Finalize()
		insertSelectionDirective.Finalize()
		insertSelectionDirectiveArgument.Finalize()
		insertDocumentDirective.Finalize()
		insertDocumentDirectiveArgument.Finalize()
		insertDocumentVariableDirective.Finalize()
		insertDocumentVariableDirectiveArgument.Finalize()
	}

	return DocumentInsertStatements{
		InsertDocument:                          insertDocument,
		InsertDocumentVariable:                  insertDocumentVariable,
		InsertDocumentVariableDirective:         insertDocumentVariableDirective,
		InsertDocumentVariableDirectiveArgument: insertDocumentVariableDirectiveArgument,
		InsertSelection:                         insertSelection,
		InsertSelectionArgument:                 insertSelectionArgument,
		InsertSelectionRef:                      insertSelectionRef,
		InsertSelectionDirective:                insertSelectionDirective,
		InsertSelectionDirectiveArgument:        insertSelectionDirectiveArgument,
		InsertDocumentDirective:                 insertDocumentDirective,
		InsertDocumentDirectiveArgument:         insertDocumentDirectiveArgument,
	}, finalize
}

type SchemaInsertStatements struct {
	InsertType                 *sqlite.Stmt
	InsertInternalType         *sqlite.Stmt
	InsertTypeField            *sqlite.Stmt
	InsertInterfaceImplementor *sqlite.Stmt
	InsertUnionMember          *sqlite.Stmt
	InsertEnumValue            *sqlite.Stmt
	InsertFieldArgument        *sqlite.Stmt
	InsertDirective            *sqlite.Stmt
	InsertInternalDirective    *sqlite.Stmt
	InsertDirectiveLocation    *sqlite.Stmt
	InsertDirectiveArgument    *sqlite.Stmt
}

func (p *HoudiniCore) prepareSchemaInsertStatements(db plugins.Database[PluginConfig]) (SchemaInsertStatements, func()) {
	// Prepare statements. (Check errors and defer closing each statement.)
	insertTypeStmt := db.Prep("INSERT INTO types (name, kind) VALUES (?, ?)")
	insertInternalTypeStmt := db.Prep("INSERT INTO types (name, kind, internal) VALUES (?, ?, true)")
	insertTypeFieldStmt := db.Prep("INSERT INTO type_fields (id, parent, name, type, type_modifiers, default_value, description) VALUES (?, ?, ?, ?, ?, ?, ?)")
	insertInterfaceImplementorStmt := db.Prep("INSERT INTO implemented_interfaces (parent, interface_type) VALUES (?, ?)")
	insertUnionMemberStmt := db.Prep("INSERT INTO union_member_types (parent, member_type) VALUES (?, ?)")
	insertEnumValueStmt := db.Prep("INSERT INTO enum_values (parent, value) VALUES (?, ?)")
	insertFieldArgumentStmt := db.Prep("INSERT INTO field_argument_definitions (field, name, type, default_value) VALUES (?, ?, ?, ?)")
	insertDirectiveStmt := db.Prep("INSERT INTO directives (name, repeatable) VALUES (?, ?)")
	insertInternalDirectiveStmt := db.Prep("INSERT INTO directives (name, description, internal, visible) VALUES (?, ?, true, ?)")
	insertDirectiveLocationStmt := db.Prep("INSERT INTO directive_locations (directive, location) VALUES (?, ?)")
	insertDirectiveArgumentStmt := db.Prep("INSERT INTO directive_arguments (parent, name, type, default_value) VALUES (?, ?, ?, ?)")

	finalize := func() {
		insertTypeStmt.Finalize()
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
		InsertTypeField:            insertTypeFieldStmt,
		InsertInterfaceImplementor: insertInterfaceImplementorStmt,
		InsertUnionMember:          insertUnionMemberStmt,
		InsertEnumValue:            insertEnumValueStmt,
		InsertFieldArgument:        insertFieldArgumentStmt,
		InsertDirective:            insertDirectiveStmt,
		InsertInternalDirective:    insertInternalDirectiveStmt,
		InsertDirectiveLocation:    insertDirectiveLocationStmt,
		InsertDirectiveArgument:    insertDirectiveArgumentStmt,
	}, finalize
}
