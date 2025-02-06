import * as graphql from 'graphql'
import sqlite from 'node:sqlite'

export const create_schema = `
-- Schema Definition Tables
CREATE TABLE types (
    name TEXT NOT NULL PRIMARY KEY UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('OBJECT', 'INTERFACE', 'UNION', 'ENUM', 'SCALAR', 'INPUT')),
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
    name TEXT NOT NULL,
    FOREIGN KEY (parent) REFERENCES types(name),
    UNIQUE (parent, name)
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
    value_type TEXT NOT NULL,
    value TEXT NOT NULL,
    default_value TEXT,
    FOREIGN KEY (parent) REFERENCES directives(name),
    PRIMARY KEY (parent, name),
    UNIQUE (parent, name),
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
    selection_id INTEGER NOT NULL,
    directive TEXT NOT NULL,
    FOREIGN KEY (selection_id) REFERENCES selections(id),
    FOREIGN KEY (directive) REFERENCES directives(name),
    PRIMARY KEY (selection_id, directive)
);

CREATE TABLE selection_directive_arguments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent INTEGER NOT NULL,
    name TEXT NOT NULL,
    value_type TEXT NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY (parent) REFERENCES selection_directives(id),
)

CREATE TABLE selection_refs (
    parent_id INTEGER,
    child_id INTEGER NOT NULL,
    document_id INTEGER NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES selections(id),
    FOREIGN KEY (child_id) REFERENCES selections(id),
    FOREIGN KEY (document_id) REFERENCES documents(id),
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

	// load the types
	for (const namedType of Object.values(schema.getTypeMap())) {
		if (namedType instanceof graphql.GraphQLObjectType) {
			// insert the type
			insert_type.run(namedType.name, 'OBJECT')
			const type_id = db.prepare('SELECT id FROM types WHERE name = ?').get(namedType.name).id

			// insert the fields
			for (const field of Object.values(namedType.getFields())) {
				db.prepare(
					'INSERT INTO type_fields (type_id, name, type_ref) VALUES (?, ?, ?)'
				).run(type_id, field.name, field.type.toString())
			}
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
