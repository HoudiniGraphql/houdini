package schema

import "zombiezen.com/go/sqlite"

type SchemaInsertStatements struct {
	InsertType              *sqlite.Stmt
	InsertInternalType      *sqlite.Stmt
	InsertTypeField         *sqlite.Stmt
	InsertPossibleType      *sqlite.Stmt
	InsertEnumValue         *sqlite.Stmt
	InsertFieldArgument     *sqlite.Stmt
	InsertDirective         *sqlite.Stmt
	InsertInternalDirective *sqlite.Stmt
	InsertDirectiveLocation *sqlite.Stmt
	InsertDirectiveArgument *sqlite.Stmt
}

func PrepareSchemaInsertStatements(db *sqlite.Conn) (SchemaInsertStatements, func()) {
	// Prepare statements. (Check errors and defer closing each statement.)
	insertTypeStmt := db.Prep("INSERT INTO types (name, kind) VALUES ($name, $kind)")
	insertInternalTypeStmt := db.Prep("INSERT INTO types (name, kind, internal) VALUES ($name, $kind, true)")
	insertTypeFieldStmt := db.Prep("INSERT INTO type_fields (id, parent, name, type, type_modifiers, default_value, description) VALUES ($id, $parent, $name, $type, $type_modifiers, $default_value, $description)")
	insertPossibleTypeStmt := db.Prep("INSERT INTO possible_types (type, member) VALUES ($type, $member)")
	insertEnumValueStmt := db.Prep("INSERT INTO enum_values (parent, value) VALUES ($parent, $value)")
	insertFieldArgumentStmt := db.Prep("INSERT INTO field_argument_definitions (field, name, type, default_value, type_modifiers) VALUES ($field, $name, $type, $default_value, $type_modifiers)")
	insertDirectiveStmt := db.Prep("INSERT INTO directives (name, repeatable) VALUES ($name, $repeatable)")
	insertInternalDirectiveStmt := db.Prep("INSERT INTO directives (name, description, internal, visible) VALUES ($name, $description, true, $visible)")
	insertDirectiveLocationStmt := db.Prep("INSERT INTO directive_locations (directive, location) VALUES ($directive, $location)")
	insertDirectiveArgumentStmt := db.Prep("INSERT INTO directive_arguments (parent, name, type, default_value) VALUES ($directive, $name, $type, $default_value)")

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
		InsertPossibleType:      insertPossibleTypeStmt,
		InsertEnumValue:         insertEnumValueStmt,
		InsertFieldArgument:     insertFieldArgumentStmt,
		InsertDirective:         insertDirectiveStmt,
		InsertInternalDirective: insertInternalDirectiveStmt,
		InsertDirectiveLocation: insertDirectiveLocationStmt,
		InsertDirectiveArgument: insertDirectiveArgumentStmt,
	}, finalize
}
