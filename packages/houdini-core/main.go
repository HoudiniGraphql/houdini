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
	fs afero.Fs
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

func (p *HoudiniCore) prepareDocumentInsertStatements(conn *sqlite.Conn) (DocumentInsertStatements, error, func()) {
	insertDocument, err := conn.Prepare("INSERT INTO documents (name, raw_document, kind, type_condition) VALUES (?, ?, ?, ?)")
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertDocumentVariable, err := conn.Prepare("INSERT INTO operation_variables (document, name, type, type_modifiers, default_value, row, column) VALUES (?, ?, ?, ?, ?, ?, ?)")
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertSelection, err := conn.Prepare("INSERT INTO selections (field_name, alias, path_index, kind, type) VALUES (?, ?, ?, ?, ?)")
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertSelectionArgument, err := conn.Prepare("INSERT INTO selection_arguments (selection_id, name, value) VALUES (?, ?, ?)")
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertSelectionRef, err := conn.Prepare("INSERT INTO selection_refs (parent_id, child_id, document, row, column) VALUES (?, ?, ?, ?, ?)")
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertSelectionDirective, err := conn.Prepare("INSERT INTO selection_directives (selection_id, directive, row, column) VALUES (?, ?, ?, ?)")
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertSelectionDirectiveArgument, err := conn.Prepare("INSERT INTO selection_directive_arguments (parent, name, value) VALUES (?, ?, ?)")
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertDocumentDirective, err := conn.Prepare("INSERT INTO document_directives (document, directive, row, column) VALUES (?, ?, ?, ?)")
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertDocumentDirectiveArgument, err := conn.Prepare("INSERT INTO document_directive_arguments (parent, name, value) VALUES (?, ?, ?)")
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertDocumentVariableDirective, err := conn.Prepare("INSERT INTO operation_variable_directives (parent, directive, row, column) VALUES (?, ?, ?, ?)")
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}
	insertDocumentVariableDirectiveArgument, err := conn.Prepare("INSERT INTO operation_variable_directive_arguments (parent, name, value) VALUES (?, ?, ?)")
	if err != nil {
		return DocumentInsertStatements{}, err, nil
	}

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
	}, nil, finalize
}

type SchemaInsertStatements struct {
	InsertType              *sqlite.Stmt
	InsertInternalType      *sqlite.Stmt
	InsertTypeField         *sqlite.Stmt
	InsertPossibelType      *sqlite.Stmt
	InsertEnumValue         *sqlite.Stmt
	InsertFieldArgument     *sqlite.Stmt
	InsertDirective         *sqlite.Stmt
	InsertInternalDirective *sqlite.Stmt
	InsertDirectiveLocation *sqlite.Stmt
	InsertDirectiveArgument *sqlite.Stmt
}

func (p *HoudiniCore) prepareSchemaInsertStatements(db *sqlite.Conn) (SchemaInsertStatements, func()) {
	// Prepare statements. (Check errors and defer closing each statement.)
	insertTypeStmt := db.Prep("INSERT INTO types (name, kind) VALUES (?, ?)")
	insertInternalTypeStmt := db.Prep("INSERT INTO types (name, kind, internal) VALUES (?, ?, true)")
	insertTypeFieldStmt := db.Prep("INSERT INTO type_fields (id, parent, name, type, type_modifiers, default_value, description) VALUES (?, ?, ?, ?, ?, ?, ?)")
	insertPossibleTypeStmt := db.Prep("INSERT INTO possible_types (type, member) VALUES (?, ?)")
	insertEnumValueStmt := db.Prep("INSERT INTO enum_values (parent, value) VALUES (?, ?)")
	insertFieldArgumentStmt := db.Prep("INSERT INTO field_argument_definitions (field, name, type, default_value) VALUES (?, ?, ?, ?)")
	insertDirectiveStmt := db.Prep("INSERT INTO directives (name, repeatable) VALUES (?, ?)")
	insertInternalDirectiveStmt := db.Prep("INSERT INTO directives (name, description, internal, visible) VALUES (?, ?, true, ?)")
	insertDirectiveLocationStmt := db.Prep("INSERT INTO directive_locations (directive, location) VALUES (?, ?)")
	insertDirectiveArgumentStmt := db.Prep("INSERT INTO directive_arguments (parent, name, type, default_value) VALUES (?, ?, ?, ?)")

	finalize := func() {
		insertTypeStmt.Finalize()
		insertTypeFieldStmt.Finalize()
		insertPossibleTypeStmt.Finalize()
		insertEnumValueStmt.Finalize()
		insertFieldArgumentStmt.Finalize()
		insertDirectiveStmt.Finalize()
		insertDirectiveLocationStmt.Finalize()
		insertDirectiveArgumentStmt.Finalize()
		insertInternalDirectiveStmt.Finalize()
		insertInternalTypeStmt.Finalize()
	}

	return SchemaInsertStatements{
		InsertType:              insertTypeStmt,
		InsertInternalType:      insertInternalTypeStmt,
		InsertTypeField:         insertTypeFieldStmt,
		InsertPossibelType:      insertPossibleTypeStmt,
		InsertEnumValue:         insertEnumValueStmt,
		InsertFieldArgument:     insertFieldArgumentStmt,
		InsertDirective:         insertDirectiveStmt,
		InsertInternalDirective: insertInternalDirectiveStmt,
		InsertDirectiveLocation: insertDirectiveLocationStmt,
		InsertDirectiveArgument: insertDirectiveArgumentStmt,
	}, finalize
}
