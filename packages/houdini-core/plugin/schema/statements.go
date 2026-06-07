package schema

import "code.houdinigraphql.com/plugins"

type SchemaInsertStatements struct {
	InsertType              plugins.Stmt
	InsertInternalType      plugins.Stmt
	InsertTypeField         plugins.Stmt
	InsertPossibleType      plugins.Stmt
	InsertEnumValue         plugins.Stmt
	InsertFieldArgument     plugins.Stmt
	InsertDirective         plugins.Stmt
	InsertInternalDirective plugins.Stmt
	InsertDirectiveLocation plugins.Stmt
	InsertDirectiveArgument plugins.Stmt
}

func PrepareSchemaInsertStatements(conn plugins.Conn) (SchemaInsertStatements, func()) {
	// Prepare statements. (Check errors and defer closing each statement.)
	insertTypeStmt, _ := conn.Prepare(
		`INSERT INTO types
        (name, kind, operation, description, built_in)
    VALUES
        ($name, $kind, $operation, $description, $built_in)
    ON CONFLICT DO UPDATE SET
        kind = excluded.kind,
        operation = excluded.operation,
        description = excluded.description,
        built_in = excluded.built_in
    `,
	)
	insertInternalTypeStmt, _ := conn.Prepare(
		`INSERT INTO types
        (name, kind, internal)
    VALUES 
        ($name, $kind, true) 
    ON CONFLICT DO UPDATE SET 
        kind = excluded.kind
    `,
	)
	insertTypeFieldStmt, _ := conn.Prepare(
		`INSERT INTO type_fields 
        (id, parent, name, type, type_modifiers, default_value, description, internal) 
    VALUES 
        ($id, $parent, $name, $type, $type_modifiers, $default_value, $description, $internal) 
    ON CONFLICT DO UPDATE SET 
        parent = excluded.parent, 
        name = excluded.name,
        type = excluded.type,
        type_modifiers = excluded.type_modifiers,
        default_value = excluded.default_value,
        description = excluded.description
    
    `,
	)
	insertPossibleTypeStmt, _ := conn.Prepare(
		`INSERT INTO possible_types 
        (type, member) 
    VALUES 
        ($type, $member) 
    ON CONFLICT DO UPDATE SET 
        member = excluded.member
    
    `,
	)
	insertEnumValueStmt, _ := conn.Prepare(
		`INSERT INTO enum_values
        (parent, value, description)
    VALUES
        ($parent, $value, $description)
    ON CONFLICT DO UPDATE SET
        value = excluded.value,
        description = excluded.description
    `,
	)
	insertFieldArgumentStmt, _ := conn.Prepare(
		`INSERT INTO type_field_arguments
        (id, field, name, type, type_modifiers, default_value)
    VALUES
        ($id, $field, $name, $type, $type_modifiers, $default_value)
    ON CONFLICT DO UPDATE SET
      field = excluded.field,
      name = excluded.name,
      type = excluded.type,
      type_modifiers = excluded.type_modifiers,
      default_value = excluded.default_value
    `,
	)
	insertDirectiveStmt, _ := conn.Prepare(
		`INSERT INTO directives 
        (name, repeatable) 
    VALUES 
        ($name, $repeatable) 
    ON CONFLICT DO UPDATE SET  
      repeatable = excluded.repeatable
    `,
	)
	insertInternalDirectiveStmt, _ := conn.Prepare(
		`INSERT INTO directives 
        (name, description, internal, visible) 
    VALUES 
        ($name, $description, true, $visible) 
    ON CONFLICT DO UPDATE SET  
        description = excluded.description,
        visible = excluded.visible
    `,
	)
	insertDirectiveLocationStmt, _ := conn.Prepare(
		`INSERT INTO directive_locations 
        (directive, location) 
    VALUES 
        ($directive, $location) 
    ON CONFLICT DO UPDATE SET  
      location = excluded.location
    `,
	)
	insertDirectiveArgumentStmt, _ := conn.Prepare(
		`INSERT INTO directive_arguments 
        (parent, name, type, default_value, type_modifiers) 
    VALUES 
        ($directive, $name, $type, $default_value, $type_modifiers) 
    ON CONFLICT DO UPDATE SET  
        name = excluded.name,
        type = excluded.type,
        default_value = excluded.default_value,
        type_modifiers = excluded.type_modifiers
    `,
	)

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
