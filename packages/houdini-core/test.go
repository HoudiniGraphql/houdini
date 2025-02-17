package main

import (
	"strings"

	"zombiezen.com/go/sqlite"
	"zombiezen.com/go/sqlite/sqlitex"
)

// executeSchema creates the database schema.
func executeSchema(db *sqlite.Conn) error {
	statements := strings.Split(schema, ";")
	for _, stmt := range statements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}
		if err := sqlitex.ExecuteTransient(db, stmt, nil); err != nil {
			return err
		}
	}
	return nil
}

const schema = `
CREATE TABLE plugins (
    name TEXT NOT NULL PRIMARY KEY UNIQUE,
    port INTEGER NOT NULL,
    hooks TEXT NOT NULL,
    plugin_order TEXT NOT NULL CHECK (plugin_order IN ('before', 'after', 'core')),
    config JSON
);

-- Watch Schema Config
CREATE TABLE watch_schema_config (
    url TEXT NOT NULL,
    headers JSON,
    interval INTEGER,
    timeout INTEGER
);

-- Router Config
CREATE TABLE router_config (
    api_endpoint TEXT,
    redirect TEXT UNIQUE,
    session_keys TEXT NOT NULL UNIQUE,
    url TEXT,
    mutation TEXT UNIQUE
);

-- Runtime Scalar Definition
CREATE TABLE runtime_scalar_definitions (
    name TEXT NOT NULL PRIMARY KEY UNIQUE,
    type TEXT NOT NULL
);

CREATE TABLE component_fields (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	document INTEGER NOT NULL,
    type TEXT,
	prop TEXT,
    field TEXT,
	inline BOOLEAN default false,
	UNIQUE (document),
	FOREIGN KEY (document) REFERENCES raw_documents(id) DEFERRABLE INITIALLY DEFERRED
);

-- Static Config (main config table)
CREATE TABLE config (
    include JSON NOT NULL,
    exclude JSON NOT NULL,
    schema_path TEXT NOT NULL,
    definitions_path TEXT,
    cache_buffer_size INTEGER,
    default_cache_policy TEXT,
    default_partial BOOLEAN,
    default_lifetime INTEGER,
    default_list_position TEXT CHECK (default_list_position IN ('APPEND', 'PREPEND')),
    default_list_target TEXT CHECK (default_list_target IN ('ALL', 'NULL')),
    default_paginate_mode TEXT CHECK (default_paginate_mode IN ('INFINITE', 'SINGLE_PAGE')),
    suppress_pagination_deduplication BOOLEAN,
    log_level TEXT CHECK (log_level IN ('QUIET', 'FULL', 'SUMMARY', 'SHORT_SUMMARY')),
    default_fragment_masking BOOLEAN,
    default_keys JSON,
    persisted_queries_path TEXT,
    project_root TEXT,
    runtime_dir TEXT
);

CREATE TABLE scalar_config (
    name TEXT NOT NULL PRIMARY KEY UNIQUE,
    type TEXT NOT NULL
);

-- Types configuration
CREATE TABLE type_configs (
    name TEXT NOT NULL,
    keys TEXT NOT NULL
);

-- A table of original document contents (to be populated by plugins)
CREATE TABLE raw_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    offset_line INTEGER,
    offset_column INTEGER,
    filepath TEXT NOT NULL,
    content TEXT NOT NULL
);

-----------------------------------------------------------
-- Schema Definition Tables
-----------------------------------------------------------

CREATE TABLE types (
    name TEXT NOT NULL PRIMARY KEY UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('OBJECT', 'INTERFACE', 'UNION', 'ENUM', 'SCALAR', 'INPUT')),
	internal BOOLEAN default false
);

CREATE TABLE type_fields (
    id TEXT PRIMARY KEY, -- will be something like User.name so we don't have to look up the generated id
    parent TEXT NOT NULL, -- will be User
    name TEXT NOT NULL,
    type TEXT NOT NULL,
	type_modifiers TEXT,
    default_value TEXT,
    description TEXT,
	internal BOOLEAN default false,
    FOREIGN KEY (parent) REFERENCES types(name) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (type) REFERENCES types(name) DEFERRABLE INITIALLY DEFERRED,
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


CREATE TABLE enum_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent TEXT NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY (parent) REFERENCES types(name) DEFERRABLE INITIALLY DEFERRED,
    UNIQUE (parent, value)
);

CREATE TABLE possible_types (
    type TEXT NOT NULL,
    member TEXT NOT NULL,
    FOREIGN KEY (type) REFERENCES types(name) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (member) REFERENCES types(name) DEFERRABLE INITIALLY DEFERRED,
    PRIMARY KEY (type, member)
);

CREATE TABLE directives (
    name TEXT NOT NULL UNIQUE PRIMARY KEY,
	internal BOOLEAN default false,
    visible BOOLEAN default true,
    repeatable BOOLEAN default false,
	description TEXT
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

CREATE TABLE operation_variable_directives (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	parent INTEGER NOT NULL,
	directive TEXT NOT NULL,
    row INTEGER NOT NULL,
    column INTEGER NOT NULL,
	FOREIGN KEY (parent) REFERENCES operation_variables(id) DEFERRABLE INITIALLY DEFERRED,
	FOREIGN KEY (directive) REFERENCES directives(name) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE operation_variable_directive_arguments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent INTEGER NOT NULL,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY (parent) REFERENCES operation_variable_directives(id) DEFERRABLE INITIALLY DEFERRED
);

-----------------------------------------------------------
-- Document Tables
-----------------------------------------------------------

CREATE TABLE operation_variables (
 	id INTEGER PRIMARY KEY AUTOINCREMENT,
    document TEXT NOT NULL,
    name INTEGER NOT NULL,
    type TEXT NOT NULL,
    type_modifiers TEXT,
    default_value TEXT,
    FOREIGN KEY (document) REFERENCES documents(id)
);

-- this is pulled out separately from operations and fragments so foreign keys can be used
CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
	kind TEXT NOT NULL CHECK (kind IN ('query', 'mutation', 'subscription', 'fragment')),
	raw_document INTEGER NOT NULL,
    type_condition TEXT,
    FOREIGN KEY (type_condition) REFERENCES types(name) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (raw_document) REFERENCES raw_documents(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE selections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    field_name TEXT NOT NULL,
	kind TEXT NOT NULL CHECK (kind IN ('field', 'fragment', 'inline_fragment')),
    alias TEXT,
    type TEXT, -- should be something like User.Avatar
    path_index INTEGER NOT NULL,
    FOREIGN KEY (type) REFERENCES type_fields(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE selection_directives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    selection_id INTEGER NOT NULL,
    directive TEXT NOT NULL,
    row INTEGER NOT NULL,
    column INTEGER NOT NULL,
    FOREIGN KEY (selection_id) REFERENCES selections(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (directive) REFERENCES directives(name) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE selection_directive_arguments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent INTEGER NOT NULL,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY (parent) REFERENCES selection_directives(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE document_directives (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	document int NOT NULL,
	directive TEXT NOT NULL,
	row INTEGER NOT NULL,
	column INTEGER NOT NULL,
	FOREIGN KEY (document) REFERENCES documents(id) DEFERRABLE INITIALLY DEFERRED,
	FOREIGN KEY (directive) REFERENCES directives(name) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE document_directive_arguments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent INTEGER NOT NULL,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY (parent) REFERENCES document_directives(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE selection_refs (
    parent_id INTEGER,
    child_id INTEGER NOT NULL,
    document INTEGER NOT NULL,
	row INTEGER NOT NULL,
	column INTEGER NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES selections(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (child_id) REFERENCES selections(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (document) REFERENCES documents(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE selection_arguments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    selection_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY (selection_id) REFERENCES selections(id) DEFERRABLE INITIALLY DEFERRED
);

-----------------------------------------------------------
-- Indices
-----------------------------------------------------------

-- Selection traversal indices
CREATE INDEX idx_selection_refs_parent_id ON selection_refs(parent_id);
CREATE INDEX idx_selection_refs_child_id ON selection_refs(child_id);
CREATE INDEX idx_selection_refs_document ON selection_refs(document);

-- Field lookups
CREATE INDEX idx_type_fields_parent ON type_fields(parent);

-- Selection metadata lookups
CREATE INDEX idx_selection_directives_selection ON selection_directives(selection_id);
CREATE INDEX idx_selection_arguments_selection ON selection_arguments(selection_id);
CREATE INDEX idx_selection_directive_args_parent ON selection_directive_arguments(parent);

-- Type system lookups
CREATE INDEX idx_possible_types_type ON possible_types(type);
CREATE INDEX idx_possible_types_member ON possible_types(member);
CREATE INDEX idx_enum_values_parent ON enum_values(parent);
`
