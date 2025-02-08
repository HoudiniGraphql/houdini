import * as graphql from 'graphql'
import sqlite from 'node:sqlite'

export const create_schema = `
-- A table of original document contents (to be populated by plugins)
CREATE TABLE raw_documents (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	filepath TEXT NOT NULL,
	content TEXT NOT NULL
);

-- Schema Definition Tables
CREATE TABLE types (
    name TEXT NOT NULL PRIMARY KEY UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('OBJECT', 'INTERFACE', 'UNION', 'ENUM', 'SCALAR', 'INPUT'))
);

CREATE TABLE type_fields (
    id TEXT PRIMARY KEY, -- will be something like User.name so we don't have to look up the generated id
    parent TEXT NOT NULL, -- will be User
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    FOREIGN KEY (parent) REFERENCES types(name),
    UNIQUE (parent, name)
);

CREATE TABLE field_argument_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    field TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    default_value TEXT,
    FOREIGN KEY (field) REFERENCES type_fields(id),
    UNIQUE (field, name)
);

CREATE TABLE input_fields (
    default_value TEXT,
    id TEXT PRIMARY KEY, -- will be something like User.name so we don't have to look up the generated id
    parent TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    FOREIGN KEY (parent) REFERENCES types(name),
    UNIQUE (parent, name)
);

CREATE TABLE enum_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent TEXT NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY (parent) REFERENCES types(name),
    UNIQUE (parent, value)
);

CREATE TABLE implemented_interfaces (
    parent TEXT NOT NULL,
    interface_type TEXT NOT NULL,
    FOREIGN KEY (parent) REFERENCES types(name),
    FOREIGN KEY (interface_type) REFERENCES types(name),
    PRIMARY KEY (parent, interface_type)
);

CREATE TABLE union_member_types (
    parent TEXT NOT NULL,
    member_type TEXT NOT NULL,
    FOREIGN KEY (parent) REFERENCES types(name),
    FOREIGN KEY (member_type) REFERENCES types(name),
    PRIMARY KEY (parent, member_type),
    UNIQUE (parent, member_type)
);

CREATE TABLE directives (
    name TEXT NOT NULL UNIQUE PRIMARY KEY
);

CREATE TABLE directive_arguments (
    parent TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    default_value TEXT,
    FOREIGN KEY (parent) REFERENCES directives(name),
    PRIMARY KEY (parent, name),
    UNIQUE (parent, name)
);

CREATE TABLE directive_locations (
    directive TEXT NOT NULL,
    location TEXT NOT NULL CHECK (location IN ('QUERY', 'MUTATION', 'SUBSCRIPTION', 'FIELD', 'FRAGMENT_DEFINITION', 'FRAGMENT_SPREAD', 'INLINE_FRAGMENT', 'SCHEMA', 'SCALAR', 'OBJECT', 'FIELD_DEFINITION', 'ARGUMENT_DEFINITION', 'INTERFACE', 'UNION', 'ENUM', 'ENUM_VALUE', 'INPUT_OBJECT', 'INPUT_FIELD_DEFINITION')),
    FOREIGN KEY (directive) REFERENCES directives(name),
    PRIMARY KEY (directive, location)
);

-- Document Tables
CREATE TABLE operations (
    name TEXT UNIQUE PRIMARY KEY NOT NULL,
    operation_type TEXT NOT NULL CHECK (operation_type IN ('query', 'mutation', 'subscription')),
    document_id INTEGER NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE TABLE operation_variables (
    operation TEXT NOT NULL,
    name TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL,
    default_value TEXT,
    FOREIGN KEY (operation) REFERENCES operations(name)
);

CREATE TABLE fragments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type_condition TEXT NOT NULL,
    document_id INTEGER NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id),
    FOREIGN KEY (type_condition) REFERENCES types(name)
);

-- this is pulled out separately from operations and fragments so foreign keys can be used
CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
);

CREATE TABLE selections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    field_name TEXT NOT NULL,
    alias TEXT,
    path_index INTEGER NOT NULL
);

CREATE TABLE selection_directives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    selection_id INTEGER NOT NULL,
    directive TEXT NOT NULL,
    FOREIGN KEY (selection_id) REFERENCES selections(id),
    FOREIGN KEY (directive) REFERENCES directives(name)
);

CREATE TABLE selection_directive_arguments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent INTEGER NOT NULL,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY (parent) REFERENCES selection_directives(id)
);

CREATE TABLE selection_refs (
    parent_id INTEGER,
    child_id INTEGER NOT NULL,
    document_id INTEGER NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES selections(id),
    FOREIGN KEY (child_id) REFERENCES selections(id),
    FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE TABLE field_arguments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    selection_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    value_type TEXT NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY (selection_id) REFERENCES selections(id)
);

-- Selection traversal indices
CREATE INDEX idx_selection_refs_parent_id ON selection_refs(parent_id);
CREATE INDEX idx_selection_refs_child_id ON selection_refs(child_id);
CREATE INDEX idx_selection_refs_document ON selection_refs(document_id);

-- Operation and Fragment lookup indices
CREATE INDEX idx_operations_document ON operations(document_id);
CREATE INDEX idx_fragments_document ON fragments(document_id);
CREATE INDEX idx_fragments_name ON fragments(name);

-- Field lookups
CREATE INDEX idx_type_fields_parent ON type_fields(parent);
CREATE INDEX idx_input_fields_parent ON input_fields(parent);

-- Selection metadata lookups
CREATE INDEX idx_selection_directives_selection ON selection_directives(selection_id);
CREATE INDEX idx_field_arguments_selection ON field_arguments(selection_id);
CREATE INDEX idx_selection_directive_args_parent ON selection_directive_arguments(parent);

-- Type system lookups
CREATE INDEX idx_implemented_interfaces_parent ON implemented_interfaces(parent);
CREATE INDEX idx_union_member_types_parent ON union_member_types(parent);
CREATE INDEX idx_enum_values_parent ON enum_values(parent);
`

export const import_graphql_schema = (db: sqlite.DatabaseSync, schema: graphql.GraphQLSchema) => {
	// prepare the statements we need
	const insert_type = db.prepare('INSERT INTO types (name, kind) VALUES (?, ?)')
	const insert_input_type_field = db.prepare(
		'INSERT INTO input_fields (id, parent, name, type, default_value) VALUES (?, ?, ?, ?, ?)'
	)
	const insert_type_field = db.prepare(
		'INSERT INTO type_fields (id, parent, name, type) VALUES (?, ?, ?, ?)'
	)
	const insert_interface_implementor = db.prepare(
		'INSERT INTO implemented_interfaces (parent, interface_type) VALUES (?, ?)'
	)
	const insert_union_member = db.prepare(
		'INSERT INTO union_member_types (parent, member_type) VALUES (?, ?)'
	)
	const insert_enum_value = db.prepare('INSERT INTO enum_values (parent, value) VALUES (?, ?)')
	const insert_field_argument = db.prepare(
		'INSERT INTO field_argument_definitions (field, name, type, default_value) VALUES (?, ?, ?, ?)'
	)
	const insert_directive = db.prepare('INSERT INTO directives (name) VALUES (?)')
	const insert_directive_location = db.prepare(
		'INSERT INTO directive_locations (directive, location) VALUES (?, ?)'
	)
	const insert_directive_argument = db.prepare(
		'INSERT INTO directive_arguments (parent, name, type, default_value) VALUES (?, ?, ?, ?)'
	)

	// we need to register the types before we can add the implementors for interfaces and unions
	const interfaces: Array<string> = []
	const unions: Array<string> = []

	// first we need to add scalars to the database
	for (const schemaType of Object.values(schema.getTypeMap())) {
		// load the scalars
		if (schemaType instanceof graphql.GraphQLScalarType) {
			// insert the type
			insert_type.run(schemaType.name, 'SCALAR')
		}
	}

	// process each type in the schema
	for (const schemaType of Object.values(schema.getTypeMap())) {
		// load the named types
		if (schemaType instanceof graphql.GraphQLObjectType) {
			// insert the type
			insert_type.run(schemaType.name, 'OBJECT')

			// insert the fields
			for (const field of Object.values(schemaType.getFields())) {
				insert_type_field.run(
					`${schemaType.name}.${field.name}`,
					schemaType.name,
					field.name,
					field.type.toString()
				)

				// we need to add the arguments for the field
				for (const arg of field.args) {
					insert_field_argument.run(
						`${schemaType.name}.${field.name}`,
						arg.name,
						arg.type.toString(),
						arg.defaultValue?.toString() ?? null
					)
				}
			}
		} else if (schemaType instanceof graphql.GraphQLInputObjectType) {
			// insert the type
			insert_type.run(schemaType.name, 'OBJECT')

			// insert the fields
			for (const field of Object.values(schemaType.getFields())) {
				insert_input_type_field.run(
					`${schemaType.name}.${field.name}`,
					schemaType.name,
					field.name,
					field.type.toString(),
					field.defaultValue?.toString() ?? null
				)
			}
		}

		// load the interfaces
		else if (schemaType instanceof graphql.GraphQLInterfaceType) {
			// insert the type
			insert_type.run(schemaType.name, 'INTERFACE')

			// insert the fields
			for (const field of Object.values(schemaType.getFields())) {
				insert_type_field.run(
					`${schemaType.name}.${field.name}`,
					schemaType.name,
					field.name,
					field.type.toString()
				)
			}

			// add the interface to the list of interfaces
			interfaces.push(schemaType.name)
		}

		// load the unions
		else if (schemaType instanceof graphql.GraphQLUnionType) {
			// insert the type
			insert_type.run(schemaType.name, 'UNION')

			// and remember it for later to add the members
			unions.push(schemaType.name)
		}

		// load the enums
		else if (schemaType instanceof graphql.GraphQLEnumType) {
			// insert the type
			insert_type.run(schemaType.name, 'ENUM')

			// insert the values
			for (const value of schemaType.getValues()) {
				insert_enum_value.run(schemaType.name, value.name)
			}
		}
	}

	for (const iface of interfaces) {
		// add any implemented interfaces
		for (const implementor of schema.getPossibleTypes(
			schema.getType(iface)! as graphql.GraphQLInterfaceType
		)) {
			insert_interface_implementor.run(iface, implementor.name)
		}
	}

	for (const union of unions) {
		// add any implemented interfaces
		for (const implementor of schema.getPossibleTypes(
			schema.getType(union)! as graphql.GraphQLUnionType
		)) {
			insert_union_member.run(union, implementor.name)
		}
	}

	// add the directives
	for (const directive of schema.getDirectives()) {
		insert_directive.run(directive.name)

		// add the locations
		for (const location of directive.locations) {
			insert_directive_location.run(directive.name, location)
		}

		// add the arguments
		for (const arg of directive.args) {
			insert_directive_argument.run(
				directive.name,
				arg.name,
				arg.type.toString(),
				arg.defaultValue?.toString() ?? null
			)
		}
	}
}

// Query to Load a Selection Tree
//
// WITH RECURSIVE selection_tree AS (
//     -- Base case: get root selections for document
//     SELECT
//         s.id,
//         s.field_name,
//         s.alias,
//         s.path_index,
//         0 as depth,
//         s.field_name as path
//     FROM selections s
//     JOIN selection_refs sr ON s.id = sr.child_id
//     WHERE sr.document_id = ? AND sr.parent_id IS NULL

//     UNION ALL

//     -- Recursive case: get all children
//     SELECT
//         s.id,
//         s.field_name,
//         s.alias,
//         s.path_index,
//         st.depth + 1,
//         st.path || '.' || s.field_name
//     FROM selections s
//     JOIN selection_refs sr ON s.id = sr.child_id
//     JOIN selection_tree st ON sr.parent_id = st.id
//     WHERE sr.document_id = ?  -- Same document_id as base case
// )
// SELECT
//     st.*,
//     tf.name as field_name,
//     t.name as type_name,
//     tm.id as type_modifier_id,
//     tm.base_type_name,
//     tm.is_non_null,
//     tm.parent_id as next_modifier
// FROM selection_tree st
// LEFT JOIN type_fields tf ON st.field_name = tf.name
// LEFT JOIN types t ON tf.type_id = t.id
// LEFT JOIN type_modifiers tm ON tf.type_modifier_id = tm.id
// ORDER BY st.depth, st.path_index;
