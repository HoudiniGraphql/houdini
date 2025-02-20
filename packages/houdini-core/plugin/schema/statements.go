package schema

import "zombiezen.com/go/sqlite"

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

func PrepareSchemaInsertStatements(db *sqlite.Conn) (SchemaInsertStatements, func()) {
	// Prepare statements. (Check errors and defer closing each statement.)
	insertTypeStmt := db.Prep("INSERT INTO types (name, kind) VALUES (?, ?)")
	insertInternalTypeStmt := db.Prep("INSERT INTO types (name, kind, internal) VALUES (?, ?, true)")
	insertTypeFieldStmt := db.Prep("INSERT INTO type_fields (id, parent, name, type, type_modifiers, default_value, description) VALUES (?, ?, ?, ?, ?, ?, ?)")
	insertPossibleTypeStmt := db.Prep("INSERT INTO possible_types (type, member) VALUES (?, ?)")
	insertEnumValueStmt := db.Prep("INSERT INTO enum_values (parent, value) VALUES (?, ?)")
	insertFieldArgumentStmt := db.Prep("INSERT INTO field_argument_definitions (field, name, type, default_value, type_modifiers) VALUES (?, ?, ?, ?, ?)")
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
