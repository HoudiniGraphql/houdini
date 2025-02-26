package tests

import (
	"strings"

	"zombiezen.com/go/sqlite"
	"zombiezen.com/go/sqlite/sqlitex"
)

// ExecuteSchema creates the database schema.
func WriteHoudiniSchema(db *sqlite.Conn) error {
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
    keys JSON NOT NULL,
	resolve_query TEXT
);

-- A table of original document contents (to be populated by plugins)
CREATE TABLE raw_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    offset_line INTEGER,
    offset_column INTEGER,
    filepath TEXT NOT NULL,
    content TEXT NOT NULL,
    current_task TEXT
);

-----------------------------------------------------------
-- Schema Definition Tables
-----------------------------------------------------------

CREATE TABLE types (
    name TEXT NOT NULL PRIMARY KEY UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('OBJECT', 'INTERFACE', 'UNION', 'ENUM', 'SCALAR', 'INPUT')),
    operation BOOLEAN default false,
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
    id TEXT PRIMARY KEY,
    field TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    type_modifiers TEXT,
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
    type_modifiers TEXT,
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

CREATE TABLE document_variable_directives (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	parent INTEGER NOT NULL,
	directive TEXT NOT NULL,
    row INTEGER NOT NULL,
    column INTEGER NOT NULL,
	FOREIGN KEY (parent) REFERENCES document_variables(id) DEFERRABLE INITIALLY DEFERRED,
	FOREIGN KEY (directive) REFERENCES directives(name) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE document_variable_directive_arguments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent INTEGER NOT NULL,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    FOREIGN KEY (parent) REFERENCES document_variable_directives(id) DEFERRABLE INITIALLY DEFERRED
);

-- while we validate list operations we need to store metadata that we can use to generate the
-- necessary documents after everything has been validated
CREATE TABLE discovered_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    node INTEGER NOT NULL,
    raw_document INTEGER NOT NULL,
    connection BOOLEAN default false,

    FOREIGN KEY (node) REFERENCES selections(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (type) REFERENCES types(name) DEFERRABLE INITIALLY DEFERRED
    FOREIGN KEY (raw_document) REFERENCES raw_documents(id) DEFERRABLE INITIALLY DEFERRED
);

-----------------------------------------------------------
-- Document Tables
-----------------------------------------------------------

CREATE TABLE document_variables (
 	id INTEGER PRIMARY KEY AUTOINCREMENT,
    document TEXT NOT NULL,
    name INTEGER NOT NULL,
    type TEXT NOT NULL,
    type_modifiers TEXT,
    default_value TEXT,
    row INTEGER NOT NULL,
    column INTEGER NOT NULL,
    FOREIGN KEY (document) REFERENCES documents(id)
);

-- this is pulled out separately from operations and fragments so foreign keys can be used
CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
	kind TEXT NOT NULL CHECK (kind IN ('query', 'mutation', 'subscription', 'fragment')),
	raw_document INTEGER,
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
    value INTEGER NOT NULL,

    FOREIGN KEY (value) REFERENCES argument_values(id) DEFERRABLE INITIALLY DEFERRED,
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
    path_index INTEGER NOT NULL,
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
    value INTEGER NOT NULL,
	row INTEGER NOT NULL,
	column INTEGER NOT NULL,
    field_argument TEXT NOT NULL,

    FOREIGN KEY (value) REFERENCES argument_values(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (selection_id) REFERENCES selections(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (field_argument) REFERENCES field_argument_definitions(id) DEFERRABLE INITIALLY DEFERRED
);


CREATE TABLE argument_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK (kind IN ('Variable', 'Int', 'Float', 'String', 'Block', 'Boolean', 'Null', 'Enum', 'List', 'Object')),
    raw TEXT NOT NULL,
    row INTEGER NOT NULL,
    column INTEGER NOT NULL,
    expected_type TEXT NOT NULL,
    expected_type_modifiers TEXT,
    document INTEGER NOT NULL,

    FOREIGN KEY (document) REFERENCES documents(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (expected_type) REFERENCES types(name) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE argument_value_children (
    name TEXT,
    parent INTEGER NOT NULL,
    value INTEGER NOT NULL,
    row INTEGER NOT NULL,
    column INTEGER NOT NULL,

    FOREIGN KEY (value) REFERENCES argument_values(id) DEFERRABLE INITIALLY DEFERRED
);
`

// expectedDocument represents an operation or fragment definition.
type ExpectedDocument struct {
	Name          string
	RawDocument   int
	Kind          string // "query", "mutation", "subscription", or "fragment"
	TypeCondition *string
	Variables     []ExpectedOperationVariable
	Selections    []ExpectedSelection
	Directives    []ExpectedDirective
}

type ExpectedOperationVariable struct {
	Document      int
	VarName       string
	Type          string
	TypeModifiers string
	DefaultValue  *string
	Directives    []ExpectedDirective
}

type ExpectedArgument struct {
	Name  string
	Value string
}

type ExpectedArgumentValue struct {
	Kind     string
	Raw      string
	Children []ExpectedArgumentValueChild
}

type ExpectedArgumentValueChild struct {
	Name  string
	Value ExpectedArgumentValue
}

type ExpectedDirectiveArgument struct {
	Name  string
	Value string
}

type ExpectedDirective struct {
	Name      string
	Arguments []ExpectedDirectiveArgument
}

type ExpectedSelection struct {
	FieldName  string
	Alias      *string
	PathIndex  int
	Kind       string // "field", "fragment", "inline_fragment", etc.
	Arguments  []ExpectedArgument
	Directives []ExpectedDirective
	Children   []ExpectedSelection
}
