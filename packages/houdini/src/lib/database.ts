import * as graphql from 'graphql'
import sqlite from 'node:sqlite'

export const create_schema = `
-- Schema Definition Tables
CREATE TABLE types (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('OBJECT', 'INTERFACE', 'UNION', 'ENUM', 'SCALAR', 'INPUT')),
    description TEXT
);

CREATE TABLE type_fields (
    id INTEGER PRIMARY KEY,
    type_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type_ref TEXT NOT NULL,
    description TEXT,
    FOREIGN KEY (type_id) REFERENCES types(id),
    UNIQUE (type_id, name)
);

CREATE TABLE field_argument_definitions (
    id INTEGER PRIMARY KEY,
    field_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type_ref TEXT NOT NULL,
    default_value TEXT,
    description TEXT,
    FOREIGN KEY (field_id) REFERENCES type_fields(id),
    UNIQUE (field_id, name)
);

CREATE TABLE input_fields (
    id INTEGER PRIMARY KEY,
    type_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type_ref TEXT NOT NULL,
    default_value TEXT,
    description TEXT,
    FOREIGN KEY (type_id) REFERENCES types(id),
    UNIQUE (type_id, name)
);

CREATE TABLE enum_values (
    id INTEGER PRIMARY KEY,
    type_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    FOREIGN KEY (type_id) REFERENCES types(id),
    UNIQUE (type_id, name)
);

CREATE TABLE implemented_interfaces (
    type_id INTEGER NOT NULL,
    interface_type_id INTEGER NOT NULL,
    FOREIGN KEY (type_id) REFERENCES types(id),
    FOREIGN KEY (interface_type_id) REFERENCES types(id),
    PRIMARY KEY (type_id, interface_type_id)
);

CREATE TABLE union_member_types (
    union_type_id INTEGER NOT NULL,
    member_type_id INTEGER NOT NULL,
    FOREIGN KEY (union_type_id) REFERENCES types(id),
    FOREIGN KEY (member_type_id) REFERENCES types(id),
    PRIMARY KEY (union_type_id, member_type_id)
);

-- Document Tables
CREATE TABLE documents (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE selections (
    id INTEGER PRIMARY KEY,
    field_name TEXT NOT NULL,
    alias TEXT,
    path_index INTEGER NOT NULL
);

CREATE TABLE selection_refs (
    parent_id INTEGER,
    child_id INTEGER NOT NULL,
    document_id INTEGER NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES selections(id),
    FOREIGN KEY (child_id) REFERENCES selections(id),
    FOREIGN KEY (document_id) REFERENCES documents(id),
    PRIMARY KEY (child_id, document_id)
);

CREATE TABLE field_arguments (
    id INTEGER PRIMARY KEY,
    selection_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    value_type TEXT NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY (selection_id) REFERENCES selections(id)
);

CREATE TABLE directives (
    id INTEGER PRIMARY KEY,
    selection_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY (selection_id) REFERENCES selections(id)
);

CREATE TABLE directive_arguments (
    id INTEGER PRIMARY KEY,
    directive_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    value_type TEXT NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY (directive_id) REFERENCES directives(id)
);

-- Indices
CREATE INDEX idx_types_name ON types(name);

CREATE INDEX idx_type_fields_type ON type_fields(type_id);
CREATE INDEX idx_type_fields_name ON type_fields(name);
CREATE INDEX idx_type_fields_type_name ON type_fields(type_id, name);
CREATE INDEX idx_type_fields_type_ref ON type_fields(type_ref);

CREATE INDEX idx_field_arg_defs_field ON field_argument_definitions(field_id);
CREATE INDEX idx_field_arg_defs_name ON field_argument_definitions(name);
CREATE INDEX idx_field_arg_defs_type_ref ON field_argument_definitions(type_ref);

CREATE INDEX idx_input_fields_type ON input_fields(type_id);
CREATE INDEX idx_input_fields_name ON input_fields(name);
CREATE INDEX idx_input_fields_type_ref ON input_fields(type_ref);

CREATE INDEX idx_enum_values_type ON enum_values(type_id);
CREATE INDEX idx_enum_values_name ON enum_values(name);

CREATE INDEX idx_implemented_interfaces_type ON implemented_interfaces(type_id);
CREATE INDEX idx_implemented_interfaces_interface ON implemented_interfaces(interface_type_id);

CREATE INDEX idx_union_members_union ON union_member_types(union_type_id);
CREATE INDEX idx_union_members_member ON union_member_types(member_type_id);

CREATE INDEX idx_documents_name ON documents(name);

CREATE INDEX idx_selections_field_name ON selections(field_name);

CREATE INDEX idx_selection_refs_parent ON selection_refs(parent_id);
CREATE INDEX idx_selection_refs_child ON selection_refs(child_id);
CREATE INDEX idx_selection_refs_document ON selection_refs(document_id);
CREATE INDEX idx_selection_refs_hierarchy ON selection_refs(document_id, parent_id);

CREATE INDEX idx_field_arguments_selection ON field_arguments(selection_id);
CREATE INDEX idx_field_arguments_name ON field_arguments(name);

CREATE INDEX idx_directives_selection ON directives(selection_id);
CREATE INDEX idx_directives_name ON directives(name);

CREATE INDEX idx_directive_arguments_directive ON directive_arguments(directive_id);
CREATE INDEX idx_directive_arguments_name ON directive_arguments(name);
`

export const import_graphql_schema = (db: sqlite.DatabaseSync, schema: graphql.GraphQLSchema) => {}

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
