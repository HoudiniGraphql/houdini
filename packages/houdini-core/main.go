package main

import (
	"fmt"
	"os"

	"code.houdinigraphql.com/plugins"
	"zombiezen.com/go/sqlite"

	"github.com/joho/godotenv"
)

func main() {
	// run the plugin
	err := plugins.Run(&HoudiniCore{})
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

type HoudiniCore struct {
	plugins.Plugin[PluginConfig]
	documentInsertStatements DocumentInsertStatements
	schemaInsertStatements   SchemaInsertStatements
}

type PluginConfig = any

func (p *HoudiniCore) Name() string {
	return "houdini-core"
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
	InsertDocument                   *sqlite.Stmt
	InsertDocumentVariable           *sqlite.Stmt
	InsertSelection                  *sqlite.Stmt
	InsertSelectionRef               *sqlite.Stmt
	InsertSelectionArgument          *sqlite.Stmt
	InsertSelectionDirective         *sqlite.Stmt
	InsertSelectionDirectiveArgument *sqlite.Stmt
	InsertDocumentDirective          *sqlite.Stmt
	InsertDocumentDirectiveArgument  *sqlite.Stmt
}

func (p *HoudiniCore) prepareDocumentInsertStatements(db plugins.Database[PluginConfig]) (DocumentInsertStatements, func()) {
	insertDocument := db.Conn.Prep("INSERT INTO documents (name, raw_document, kind, type_condition) VALUES (?, ?, ?, ?)")
	insertDocumentVariable := db.Conn.Prep("INSERT INTO operation_variables (document, name, type, default_value) VALUES (?, ?, ?, ?)")
	insertSelection := db.Conn.Prep("INSERT INTO selections (field_name, alias, path_index, kind) VALUES (?, ?, ?, ?)")
	insertSelectionArgument := db.Conn.Prep("INSERT INTO selection_arguments (selection_id, name, value) VALUES (?, ?, ?)")
	insertSelectionRef := db.Conn.Prep("INSERT INTO selection_refs (parent_id, child_id, document) VALUES (?, ?, ?)")
	insertSelectionDirective := db.Conn.Prep("INSERT INTO selection_directives (selection_id, directive) VALUES (?, ?)")
	insertSelectionDirectiveArgument := db.Conn.Prep("INSERT INTO selection_directive_arguments (parent, name, value) VALUES (?, ?, ?)")
	insertDocumentDirective := db.Conn.Prep("INSERT INTO document_directives (document, directive) VALUES (?, ?)")
	insertDocumentDirectiveArgument := db.Conn.Prep("INSERT INTO document_directive_arguments (parent, name, value) VALUES (?, ?, ?)")

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
	}

	return DocumentInsertStatements{
		InsertDocument:                   insertDocument,
		InsertDocumentVariable:           insertDocumentVariable,
		InsertSelection:                  insertSelection,
		InsertSelectionArgument:          insertSelectionArgument,
		InsertSelectionRef:               insertSelectionRef,
		InsertSelectionDirective:         insertSelectionDirective,
		InsertSelectionDirectiveArgument: insertSelectionDirectiveArgument,
		InsertDocumentDirective:          insertDocumentDirective,
		InsertDocumentDirectiveArgument:  insertDocumentDirectiveArgument,
	}, finalize
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

func (p *HoudiniCore) prepareSchemaInsertStatements(db plugins.Database[PluginConfig]) (SchemaInsertStatements, func(), error) {
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
