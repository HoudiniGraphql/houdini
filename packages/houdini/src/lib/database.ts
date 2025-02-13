import * as graphql from 'graphql'
import sqlite from 'node:sqlite'

import { PluginSpec } from './codegen'
import { Config, default_config } from './project'

export const create_schema = `
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
    filepath TEXT NOT NULL,
    offset_line INTEGER,
    offset_column INTEGER,
    content TEXT NOT NULL
);

-- @componentField has some extra meta data associated with it that can pop up at different times. In order to
-- make querying this table easier, we'll give it a separate table
CREATE TABLE component_fields (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	document INTEGER NOT NULL,
	prop TEXT,
    field TEXT,
	type TEXT,
	inline BOOLEAN default false,
	UNIQUE (document),
	FOREIGN KEY (document) REFERENCES raw_documents(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (type) REFERENCES types(name) DEFERRABLE INITIALLY DEFERRED
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

CREATE TABLE implemented_interfaces (
    parent TEXT NOT NULL,
    interface_type TEXT NOT NULL,
    FOREIGN KEY (parent) REFERENCES types(name) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (interface_type) REFERENCES types(name) DEFERRABLE INITIALLY DEFERRED,
    PRIMARY KEY (parent, interface_type)
);

CREATE TABLE union_member_types (
    parent TEXT NOT NULL,
    member_type TEXT NOT NULL,
    FOREIGN KEY (parent) REFERENCES types(name) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (member_type) REFERENCES types(name) DEFERRABLE INITIALLY DEFERRED,
    PRIMARY KEY (parent, member_type),
    UNIQUE (parent, member_type)
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

-----------------------------------------------------------
-- Document Tables
-----------------------------------------------------------

CREATE TABLE operation_variables (
 	id INTEGER PRIMARY KEY AUTOINCREMENT,
    document TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    type_modifiers TEXT,
    default_value TEXT,
    FOREIGN KEY (document) REFERENCES documents(name)
);

CREATE TABLE operation_variable_directives (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	parent INTEGER NOT NULL,
	directive TEXT NOT NULL,
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

CREATE TABLE documents (
    name TEXT NOT NULL PRIMARY KEY,
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
	type TEXT,
    path_index INTEGER NOT NULL,
    FOREIGN KEY (type) REFERENCES type_fields(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE selection_directives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    selection_id INTEGER NOT NULL,
    directive TEXT NOT NULL,
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
	document TEXT NOT NULL,
	directive TEXT NOT NULL,
	FOREIGN KEY (document) REFERENCES documents(name) DEFERRABLE INITIALLY DEFERRED,
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
    document TEXT NOT NULL,
	row INTEGER,
	column INTEGER,
    FOREIGN KEY (parent_id) REFERENCES selections(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (child_id) REFERENCES selections(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (document) REFERENCES documents(name) DEFERRABLE INITIALLY DEFERRED
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
CREATE INDEX idx_implemented_interfaces_parent ON implemented_interfaces(parent);
CREATE INDEX idx_union_member_types_parent ON union_member_types(parent);
CREATE INDEX idx_enum_values_parent ON enum_values(parent);
CREATE INDEX idx_operation_variables_document ON operation_variables(document);
CREATE INDEX idx_op_var_directives_parent ON operation_variable_directives(parent);
CREATE INDEX idx_op_var_dir_args_parent ON operation_variable_directive_arguments(parent);
CREATE INDEX idx_document_directives_document ON document_directives(document);
CREATE INDEX idx_document_directive_arguments_parent ON document_directive_arguments(parent);
`

export async function write_config(
	db: sqlite.DatabaseSync,
	config: Config,
	invoke_hook: (
		plugin: string,
		hook: string,
		args: Record<string, any>
	) => Promise<Record<string, any>>,
	plugins: Record<string, PluginSpec>,
	mode: string
) {
	// in order to know our configuration values, we need to load the current environment
	// to do this we need to look at each plugin that supports the environment hook
	// and invoke it
	const env = {}

	console.time('Environment')
	// look at each plugin
	await Promise.all(
		Object.values(plugins).map(async (plugin) => {
			// if the plugin supports the environment hook
			if (plugin.hooks.has('Environment')) {
				// we need to hit the corresponding endpoint in the plugin server
				Object.assign(env, await invoke_hook(plugin.name, 'environment', { mode }))
			}
		})
	)
	console.timeEnd('Environment')

	// now that we have the environment, we can write our config values to the database
	const config_file = {
		...default_config,
		...config.config_file,
	}

	// write the config to the database
	db.prepare(
		`
		INSERT INTO config (
			include,
			exclude,
			schema_path,
			definitions_path,
			cache_buffer_size,
			default_cache_policy,
			default_partial,
			default_lifetime,
			default_list_position,
			default_list_target,
			default_paginate_mode,
			suppress_pagination_deduplication,
			log_level,
			default_fragment_masking,
			default_keys,
			persisted_queries_path,
			project_root,
			runtime_dir
		) VALUES (
			?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
		)
	`
	).run(
		JSON.stringify(
			typeof config_file.include === 'string'
				? [config_file.include]
				: config_file.include ?? []
		),
		JSON.stringify(
			typeof config_file.exclude === 'string'
				? [config_file.exclude]
				: config_file.exclude ?? []
		),
		config_file.schemaPath!,
		config_file.definitionsPath ?? '',
		config_file.cacheBufferSize ?? null,
		config_file.defaultCachePolicy ?? null,
		config_file.defaultPartial ? 1 : 0,
		config_file.defaultLifetime ?? null,
		config_file.defaultListPosition ?? null,
		config_file.defaultListTarget ?? null,
		config_file.defaultPaginateMode ?? null,
		config_file.supressPaginationDeduplication ? 1 : 0,
		config_file.logLevel ?? null,
		config_file.defaultFragmentMasking === 'enable' ? 1 : 0,
		JSON.stringify(config_file.defaultKeys ?? []),
		config_file.persistedQueriesPath ?? null,
		config.root_dir ?? null,
		config_file.runtimeDir ?? null
	)

	// write the scalar definitions
	let insert = db.prepare('INSERT INTO runtime_scalar_definitions (name, type) VALUES (?, ?)')
	for (const [name, { type }] of Object.entries(config.config_file.scalars ?? {})) {
		insert.run(name, type)
	}

	// write router config
	if (config.config_file.router) {
		let session_keys = config.config_file.router.auth?.sessionKeys.join(',') ?? ''
		let api_endpoint: string | null = null
		let url: string | null = null
		let mutation: string | null = null
		let redirect: string | null = null

		if (config.config_file.router.auth) {
			if ('mutation' in config.config_file.router.auth) {
				mutation = config.config_file.router.auth.mutation
			} else {
				redirect = config.config_file.router.auth.redirect
			}
			url = config.config_file.router.auth.url ?? null
		}

		db.prepare(
			`INSERT INTO router_config (
				redirect,
				session_keys,
				url,
				mutation,
				redirect,
				api_endpoint
			) VALUES (?, ?, ?, ?, ?, ?)`
		).run(redirect, session_keys, url, mutation, redirect, api_endpoint)
	}

	// add watch_schema_config
	if (config.config_file.watchSchema) {
		const url =
			typeof config.config_file.watchSchema.url === 'string'
				? config.config_file.watchSchema.url
				: config.config_file.watchSchema.url(env)
		const headers = !config.config_file.watchSchema.headers
			? {}
			: typeof config.config_file.watchSchema.headers === 'function'
			? typeof config.config_file.watchSchema.headers(env)
			: typeof config.config_file.watchSchema.headers
		db.prepare(
			`INSERT INTO watch_schema_config (
				url,
				headers,
				interval,
				timeout
			) VALUES (?, ?, ?, ?)`
		).run(
			url,
			JSON.stringify(headers),
			config.config_file.watchSchema.interval ?? null,
			config.config_file.watchSchema.timeout ?? null
		)
	}

	// write the scalar configs
	insert = db.prepare('INSERT INTO scalar_config (name, type) VALUES (?, ?)')
	for (const [name, { type }] of Object.entries(config.config_file.scalars ?? {})) {
		insert.run(name, type)
	}

	// write the type configs
	insert = db.prepare('INSERT INTO type_configs (name, keys) VALUES (?, ?)')
	for (const [name, { keys }] of Object.entries(config.config_file.types ?? {})) {
		insert.run(name, (keys || config_file.defaultKeys || []).join(','))
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
//     WHERE sr.document = ? AND sr.parent_id IS NULL

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
//     WHERE sr.document = ?  -- Same document as base case
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
