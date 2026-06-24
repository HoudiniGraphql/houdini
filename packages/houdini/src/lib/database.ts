import { createHash } from 'node:crypto'
import path from 'node:path'

import type { PluginSpec } from './codegen.js'
import type { Db } from './db.js'
import type { Config } from './config.js'
import { Logger } from './logger.js'
import { default_config } from './project.js'
import { LogLevel } from './types.js'

export const create_schema = `
CREATE TABLE IF NOT EXISTS plugins (
    name TEXT NOT NULL PRIMARY KEY UNIQUE,
    port INTEGER NOT NULL,
    hooks JSON NOT NULL,
    plugin_order TEXT CHECK (plugin_order IS NULL OR plugin_order IN ('before', 'after', 'core')),
    include_runtime TEXT,
    include_static_runtime TEXT,
    config JSON,
	  config_module TEXT,
		client_plugins JSON
);

-- Watch Schema Config
CREATE TABLE IF NOT EXISTS watch_schema_config (
    url TEXT NOT NULL,
    headers JSON,
    interval INTEGER,
    timeout INTEGER
);

-- Router Config
CREATE TABLE IF NOT EXISTS router_config (
    api_endpoint TEXT,
    redirect TEXT UNIQUE,
    session_keys TEXT NOT NULL UNIQUE,
    url TEXT,
    mutation TEXT UNIQUE
);

-- Runtime Scalar Definition
CREATE TABLE IF NOT EXISTS runtime_scalar_definitions (
    name TEXT NOT NULL PRIMARY KEY UNIQUE,
    type TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS component_fields (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	document INTEGER NOT NULL,
  type TEXT,
	prop TEXT,
  field TEXT,
	inline BOOLEAN default false,
  type_field TEXT,
  fragment TEXT,
	UNIQUE (document),
	FOREIGN KEY (document) REFERENCES raw_documents(id) ON DELETE CASCADE
);

-- Static Config (main config table)
CREATE TABLE IF NOT EXISTS config (
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
    default_paginate_mode TEXT CHECK (default_paginate_mode IN ('Infinite', 'SinglePage')),
    suppress_pagination_deduplication BOOLEAN,
    log_level TEXT CHECK (log_level IN ('QUIET', 'FULL', 'SUMMARY', 'SHORT_SUMMARY')),
    default_fragment_masking BOOLEAN,
    default_keys JSON,
    persisted_queries_path TEXT NOT NULL,
    project_root TEXT,
    runtime_dir TEXT,
		path TEXT
);

CREATE TABLE IF NOT EXISTS scalar_config (
    name TEXT NOT NULL PRIMARY KEY UNIQUE,
    type TEXT NOT NULL,
	input_types JSON,
	module TEXT,
	default_import BOOLEAN
);

-- Types configuration
CREATE TABLE IF NOT EXISTS type_configs (
    name TEXT NOT NULL,
    keys JSON NOT NULL,
	resolve_query TEXT
);

-- A table of original document contents (to be populated by plugins)
CREATE TABLE IF NOT EXISTS raw_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    offset_line INTEGER,
    offset_column INTEGER,
    filepath TEXT NOT NULL,
    content TEXT NOT NULL,
    current_task TEXT,
    loaded_with TEXT
);

-----------------------------------------------------------
-- Schema Definition Tables
-----------------------------------------------------------

CREATE TABLE IF NOT EXISTS types (
    name TEXT NOT NULL PRIMARY KEY UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('OBJECT', 'INTERFACE', 'UNION', 'ENUM', 'SCALAR', 'INPUT')),
    operation TEXT,
	description TEXT,
	internal BOOLEAN default false,
	built_in BOOLEAN default false
);

CREATE TABLE IF NOT EXISTS type_fields (
    id TEXT PRIMARY KEY, -- will be something like User.name so we don't have to look up the generated id
    parent TEXT NOT NULL, -- will be User
    name TEXT NOT NULL,
    type TEXT NOT NULL,
	  type_modifiers TEXT,
    default_value TEXT,
    description TEXT,
	  internal BOOLEAN default false,
    document INT,

    FOREIGN KEY (document) REFERENCES raw_documents(id) ON DELETE CASCADE,
    FOREIGN KEY (parent) REFERENCES types(name) ON DELETE CASCADE,
    FOREIGN KEY (type) REFERENCES types(name) ON DELETE CASCADE,
    UNIQUE (parent, name)
);

CREATE TABLE IF NOT EXISTS type_field_arguments (
    id TEXT PRIMARY KEY,
    field TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    type_modifiers TEXT,
    default_value TEXT,
    FOREIGN KEY (field) REFERENCES type_fields(id) ON DELETE CASCADE,
    UNIQUE (field, name)
);


CREATE TABLE IF NOT EXISTS enum_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent TEXT NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    FOREIGN KEY (parent) REFERENCES types(name) ON DELETE CASCADE,
    UNIQUE (parent, value)
);

CREATE TABLE IF NOT EXISTS possible_types (
    type TEXT NOT NULL,
    member TEXT NOT NULL,
    FOREIGN KEY (type) REFERENCES types(name) ON DELETE CASCADE,
    FOREIGN KEY (member) REFERENCES types(name) ON DELETE CASCADE,
    PRIMARY KEY (type, member)
);

CREATE TABLE IF NOT EXISTS directives (
    name TEXT NOT NULL UNIQUE PRIMARY KEY,
	internal BOOLEAN default false,
    visible BOOLEAN default true,
    repeatable BOOLEAN default false,
	description TEXT
);

CREATE TABLE IF NOT EXISTS directive_arguments (
    parent TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
	type_modifiers TEXT,
    default_value TEXT,
    FOREIGN KEY (parent) REFERENCES directives(name),
    PRIMARY KEY (parent, name),
    UNIQUE (parent, name)
);

CREATE TABLE IF NOT EXISTS directive_locations (
    directive TEXT NOT NULL,
    location TEXT NOT NULL CHECK (location IN ('QUERY', 'MUTATION', 'SUBSCRIPTION', 'FIELD', 'FRAGMENT_DEFINITION', 'FRAGMENT_SPREAD', 'INLINE_FRAGMENT', 'SCHEMA', 'SCALAR', 'OBJECT', 'FIELD_DEFINITION', 'ARGUMENT_DEFINITION', 'INTERFACE', 'UNION', 'ENUM', 'ENUM_VALUE', 'INPUT_OBJECT', 'INPUT_FIELD_DEFINITION')),
    FOREIGN KEY (directive) REFERENCES directives(name),
    PRIMARY KEY (directive, location)
);

CREATE TABLE IF NOT EXISTS document_variable_directives (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	parent INTEGER NOT NULL,
	directive TEXT NOT NULL,
    row INTEGER NOT NULL,
    column INTEGER NOT NULL,
	FOREIGN KEY (parent) REFERENCES document_variables(id) ON DELETE CASCADE,
	FOREIGN KEY (directive) REFERENCES directives(name) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS document_variable_directive_arguments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent INTEGER NOT NULL,
    name TEXT NOT NULL,
    value INTEGER NOT NULL,

    FOREIGN KEY (value) REFERENCES argument_values(id) ON DELETE CASCADE,
    FOREIGN KEY (parent) REFERENCES document_variable_directives(id) ON DELETE CASCADE
);

-----------------------------------------------------------
-- Document Tables
-----------------------------------------------------------

CREATE TABLE IF NOT EXISTS document_variables (
 	id INTEGER PRIMARY KEY AUTOINCREMENT,
    document TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    type_modifiers TEXT,
    default_value INT,
    row INTEGER NOT NULL,
    column INTEGER NOT NULL,

    FOREIGN KEY (default_value) REFERENCES argument_values(id) ON DELETE CASCADE,
    FOREIGN KEY (document) REFERENCES documents(id) ON DELETE CASCADE,
    UNIQUE (document, name)
);

-- this is pulled out separately from operations and fragments so foreign keys can be used
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('query', 'mutation', 'subscription', 'fragment')),
    raw_document INTEGER,
    type_condition TEXT,
    hash TEXT,
    printed TEXT,
		internal boolean default false,
		visible boolean default true,
		processed boolean default false,
    FOREIGN KEY (type_condition) REFERENCES types(name) ON DELETE CASCADE,
    FOREIGN KEY (raw_document) REFERENCES raw_documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS selections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    field_name TEXT NOT NULL,
	kind TEXT NOT NULL CHECK (kind IN ('field', 'fragment', 'inline_fragment')),
    alias TEXT,
    type TEXT, -- should be something like User.Avatar
    fragment_ref TEXT, -- used when fragment arguments cause a hash to be inlined (removing the ability to track what the original fragment is)
		fragment_args JSON -- used to store the arguments that are used when fragment variables are expanded
);

CREATE TABLE IF NOT EXISTS selection_directives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    selection_id INTEGER NOT NULL,
    directive TEXT NOT NULL,
    row INTEGER NOT NULL,
    column INTEGER NOT NULL,
    FOREIGN KEY (selection_id) REFERENCES selections(id) ON DELETE CASCADE,
    FOREIGN KEY (directive) REFERENCES directives(name) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS selection_directive_arguments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent INTEGER NOT NULL,
    name TEXT NOT NULL,
    value INTEGER NOT NULL,
    document INTEGER NOT NULL,

    FOREIGN KEY (value) REFERENCES argument_values(id) ON DELETE CASCADE,
    FOREIGN KEY (parent) REFERENCES selection_directives(id) ON DELETE CASCADE,
    FOREIGN KEY (document) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS document_directives (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	document int NOT NULL,
	directive TEXT NOT NULL,
	row INTEGER NOT NULL,
	column INTEGER NOT NULL,
	FOREIGN KEY (document) REFERENCES documents(id) ON DELETE CASCADE,
	FOREIGN KEY (directive) REFERENCES directives(name) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS document_directive_arguments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent INTEGER NOT NULL,
    name TEXT NOT NULL,
    value INTEGER NOT NULL,

    FOREIGN KEY (value) REFERENCES argument_values(id) ON DELETE CASCADE,
    FOREIGN KEY (parent) REFERENCES document_directives(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS selection_refs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER,
    child_id INTEGER NOT NULL,
    path_index INTEGER NOT NULL,
    document INTEGER NOT NULL,
	row INTEGER NOT NULL,
	column INTEGER NOT NULL,
	internal BOOLEAN NOT NULL DEFAULT false,
    FOREIGN KEY (parent_id) REFERENCES selections(id) ON DELETE CASCADE,
    FOREIGN KEY (child_id) REFERENCES selections(id) ON DELETE CASCADE,
    FOREIGN KEY (document) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS selection_arguments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    selection_id INTEGER NOT NULL,
    document INTEGER NOT NULL,
    name TEXT NOT NULL,
    value INTEGER NOT NULL,
    row INTEGER NOT NULL,
    column INTEGER NOT NULL,
    field_argument TEXT NOT NULL,

    FOREIGN KEY (value) REFERENCES argument_values(id) ON DELETE CASCADE,
    FOREIGN KEY (selection_id) REFERENCES selections(id) ON DELETE CASCADE,
    FOREIGN KEY (document) REFERENCES documents(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS argument_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK (kind IN ('Variable', 'Int', 'Float', 'String', 'Block', 'Boolean', 'Null', 'Enum', 'List', 'Object')),
    raw TEXT NOT NULL,
    row INTEGER NOT NULL,
    column INTEGER NOT NULL,
    expected_type TEXT NOT NULL,
    expected_type_modifiers TEXT,
    document INTEGER NOT NULL,

    FOREIGN KEY (document) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS argument_value_children (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    parent INTEGER NOT NULL,
    value INTEGER NOT NULL,
    row INTEGER NOT NULL,
    column INTEGER NOT NULL,
    document INTEGER NOT NULL,

    FOREIGN KEY (document) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (parent) REFERENCES argument_values(id) ON DELETE CASCADE,
    FOREIGN KEY (value) REFERENCES argument_values(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS discovered_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    node_type TEXT NOT NULL,
    edge_type TEXT,
    connection_type TEXT NOT NULL,
    node INTEGER NOT NULL,
    page_size INTEGER NOT NULL,
    document INTEGER NOT NULL,
    mode TEXT NOT NULL,
    embedded BOOLEAN NOT NULL,
    target_type TEXT NOT NULL,
    connection BOOLEAN default false,
    list_field INTEGER NOT NULL,
    paginate TEXT,
    supports_forward BOOLEAN default false,
    supports_backward BOOLEAN default false,
    cursor_type TEXT,

    FOREIGN KEY (list_field) REFERENCES selections(id) ON DELETE CASCADE,
	  FOREIGN KEY (node) REFERENCES selections(id) ON DELETE CASCADE,
    FOREIGN KEY (node_type) REFERENCES types(name) ON DELETE CASCADE,
    FOREIGN KEY (document) REFERENCES documents(id) ON DELETE CASCADE
);

-- refetch_meta carries the "refetch" artifact-block metadata for documents that are
-- refetchable but are NOT lists (e.g. @refetchable fragments). Lists keep their refetch
-- metadata on discovered_lists since it is intrinsic to pagination; this table is for the
-- list-less case so we don't have to fake a discovered_lists row.
CREATE TABLE IF NOT EXISTS refetch_meta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document INTEGER NOT NULL,
    selection INTEGER NOT NULL,
    target_type TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'offset',
    mode TEXT NOT NULL DEFAULT 'Infinite',
    page_size INTEGER NOT NULL DEFAULT 0,
    embedded BOOLEAN NOT NULL DEFAULT false,

    FOREIGN KEY (document) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (selection) REFERENCES selections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS document_dependencies (
  document INTEGER NOT NULL,
  depends_on TEXT NOT NULL,

  FOREIGN KEY (document) REFERENCES documents(id) ON DELETE CASCADE,
  UNIQUE (document, depends_on)
);

-----------------------------------------------------------
-- Indices
-----------------------------------------------------------

-- component_fields
CREATE INDEX IF NOT EXISTS idx_component_fields_type_fields ON component_fields(type_field);

-- discovered_lists
CREATE INDEX IF NOT EXISTS idx_discovered_lists_document ON discovered_lists(document);
CREATE INDEX IF NOT EXISTS idx_discovered_lists_node ON discovered_lists(node);
CREATE INDEX IF NOT EXISTS idx_discovered_lists_list_field ON discovered_lists(list_field);
-- note: no index on discovered_lists(connection) — boolean column, ~2 distinct values

-- refetch_meta
CREATE INDEX IF NOT EXISTS idx_refetch_meta_selection ON refetch_meta(selection);
CREATE INDEX IF NOT EXISTS idx_refetch_meta_document ON refetch_meta(document);

-- types
CREATE INDEX IF NOT EXISTS idx_types_kind_operation ON types(kind, operation);
-- note: no index on types(name) — covered by PRIMARY KEY UNIQUE

-- documents
CREATE INDEX IF NOT EXISTS idx_documents_kind ON documents(kind);
CREATE INDEX IF NOT EXISTS idx_documents_type_condition ON documents(type_condition);
CREATE INDEX IF NOT EXISTS idx_documents_raw_document ON documents(raw_document);
CREATE INDEX IF NOT EXISTS idx_documents_name_kind ON documents(name, kind);

-- raw_documents
CREATE INDEX IF NOT EXISTS idx_raw_documents_current_task ON raw_documents(current_task);
CREATE INDEX IF NOT EXISTS idx_raw_documents_filepath ON raw_documents(filepath);

-- selections
CREATE INDEX IF NOT EXISTS idx_selections_type ON selections(type);
CREATE INDEX IF NOT EXISTS idx_selections_alias ON selections(alias);
CREATE INDEX IF NOT EXISTS idx_selections_field_name_kind ON selections(field_name, kind);

-- selection_refs: composite covers document-only lookups, so no separate single-column index needed
CREATE INDEX IF NOT EXISTS idx_selection_refs_parent_id ON selection_refs(parent_id);

CREATE INDEX IF NOT EXISTS idx_selection_refs_child_id ON selection_refs(child_id);
CREATE INDEX IF NOT EXISTS idx_selection_refs_document_parent_id ON selection_refs(document, parent_id);

-- selection_directives / selection_directive_arguments / selection_arguments
CREATE INDEX IF NOT EXISTS idx_selection_directives_selection ON selection_directives(selection_id);
CREATE INDEX IF NOT EXISTS idx_selection_directives_directive ON selection_directives(directive);
CREATE INDEX IF NOT EXISTS idx_selection_directive_arguments_parent_name ON selection_directive_arguments(parent, name);
-- note: no index on selection_directive_arguments(parent) alone — covered by (parent,name) composite
CREATE INDEX IF NOT EXISTS idx_selection_directive_arguments_value ON selection_directive_arguments(value);
-- document FK on selection_directive_arguments and selection_arguments: used in WHERE/JOIN in CollectDocuments
CREATE INDEX IF NOT EXISTS idx_selection_directive_arguments_document ON selection_directive_arguments(document);
CREATE INDEX IF NOT EXISTS idx_selection_arguments_document ON selection_arguments(document);
CREATE INDEX IF NOT EXISTS idx_selection_arguments_selection ON selection_arguments(selection_id);
CREATE INDEX IF NOT EXISTS idx_selection_arguments_value ON selection_arguments(value);

-- type_fields / type_field_arguments
-- note: no index on type_fields(id) or type_field_arguments(id) — covered by their TEXT PRIMARY KEYs
CREATE INDEX IF NOT EXISTS idx_type_fields_parent ON type_fields(parent);
CREATE INDEX IF NOT EXISTS idx_type_fields_name ON type_fields(name);
CREATE INDEX IF NOT EXISTS idx_type_configs_name ON type_configs(name);

-- possible_types
-- note: no index on possible_types(type) — covered by PRIMARY KEY(type,member) leading column
CREATE INDEX IF NOT EXISTS idx_possible_types_member ON possible_types(member);

-- type_fields: type and document FK columns have no implicit index
CREATE INDEX IF NOT EXISTS idx_type_fields_type ON type_fields(type);
CREATE INDEX IF NOT EXISTS idx_type_fields_document ON type_fields(document);

-- enum_values
-- note: no index on enum_values(parent) or (parent,value) — both covered by UNIQUE(parent,value)

-- document_directives / document_directive_arguments
CREATE INDEX IF NOT EXISTS idx_document_directives_document ON document_directives(document);
CREATE INDEX IF NOT EXISTS idx_document_directives_directive ON document_directives(directive);
CREATE INDEX IF NOT EXISTS idx_document_directive_arguments_parent_name ON document_directive_arguments(parent, name);
-- note: no index on document_directive_arguments(parent) alone — covered by (parent,name) composite
CREATE INDEX IF NOT EXISTS idx_document_directive_arguments_value on document_directive_arguments(value);

-- document_variables
-- note: no index on document_variables(document,name) — covered by UNIQUE(document,name)
-- default_value FK is used as a JOIN column in validate and fragmentArguments transforms
CREATE INDEX IF NOT EXISTS idx_document_variables_default_value ON document_variables(default_value);
CREATE INDEX IF NOT EXISTS idx_document_variables_document_id ON document_variables(document, id);
CREATE INDEX IF NOT EXISTS idx_document_variables_document_type_modifiers_default ON document_variables(document, type_modifiers, default_value);

-- document_variable_directives / document_variable_directive_arguments
CREATE INDEX IF NOT EXISTS idx_document_variable_directives_parent ON document_variable_directives(parent);
CREATE INDEX IF NOT EXISTS idx_document_variable_directives_directive ON document_variable_directives(directive);
CREATE INDEX IF NOT EXISTS idx_document_variable_directive_arguments_parent ON document_variable_directive_arguments(parent);

-- document_dependencies
-- note: no index on document_dependencies(document) — covered by UNIQUE(document,depends_on) leading column
CREATE INDEX IF NOT EXISTS idx_document_dependency_depends_on on document_dependencies(depends_on);

-- argument_values: composite (document,id) covers document-only lookups
-- note: no separate index on argument_values(document) alone
CREATE INDEX IF NOT EXISTS idx_argument_values_kind_raw ON argument_values(kind, raw);
CREATE INDEX IF NOT EXISTS idx_argument_values_document_id ON argument_values(document, id);
CREATE INDEX IF NOT EXISTS idx_argument_values_expected_type_document ON argument_values(expected_type, document);

-- argument_value_children: composite (parent,value) covers parent-only lookups
-- note: no separate index on argument_value_children(parent) alone
CREATE INDEX IF NOT EXISTS idx_argument_value_children_parent_value ON argument_value_children(parent, value);
CREATE INDEX IF NOT EXISTS idx_argument_value_children_value ON argument_value_children(value);
-- document FK: large table; index needed for efficient CASCADE DELETE from documents
CREATE INDEX IF NOT EXISTS idx_argument_value_children_document ON argument_value_children(document);
`

// schema_version is a checksum of create_schema, stamped into the database's
// PRAGMA user_version. When the schema changes the checksum changes, so a
// persisted database from an older compiler is detected as stale and rebuilt
// from scratch (we deliberately don't migrate — see connect_db). The value is
// masked to 31 bits to fit SQLite's signed 32-bit user_version field.
export const schema_version =
	parseInt(createHash('sha1').update(create_schema).digest('hex').slice(0, 8), 16) & 0x7fffffff

export async function write_config(
	db: Db,
	config: Config,
	invoke_hook: (
		plugin: string,
		hook: string,
		args: Record<string, any>
	) => Promise<Record<string, any>>,
	plugins: Array<PluginSpec>,
	mode: string,
	logger: Logger = new Logger(LogLevel.Summary)
) {
	// in order to know our configuration values, we need to load the current environment
	// to do this we need to look at each plugin that supports the environment hook
	// and invoke it
	const env = {}

	logger.time('Environment')
	// look at each plugin
	await Promise.all(
		plugins.map(async (plugin) => {
			// if the plugin supports the environment hook
			if (plugin.hooks.has('Environment')) {
				// we need to hit the corresponding endpoint in the plugin server
				Object.assign(env, await invoke_hook(plugin.name, 'environment', { mode }))
			}
		})
	)
	logger.timeEnd('Environment', LogLevel.Summary)

	// now that we have the environment, we can write our config values to the database
	const config_file = {
		...default_config,
		...config.config_file,
	}

	// before we write the config row, let's delete the existing one
	db.run('DELETE FROM config')
	db.run('DELETE FROM router_config')
	db.run('DELETE FROM watch_schema_config')
	db.run('DELETE FROM scalar_config')
	db.run('DELETE FROM type_configs')

	// write the config to the database
	db.run(
		`INSERT INTO config (
			include, exclude, schema_path, definitions_path, cache_buffer_size,
			default_cache_policy, default_partial, default_lifetime,
			default_list_position, default_list_target, default_paginate_mode,
			suppress_pagination_deduplication, log_level, default_fragment_masking,
			default_keys, persisted_queries_path, project_root, runtime_dir, path
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			JSON.stringify(config.include),
			JSON.stringify(config.exclude),
			config_file.schemaPath!,
			config_file.definitionsPath ?? '',
			config_file.cacheBufferSize ?? null,
			config_file.defaultCachePolicy ?? null,
			config_file.defaultPartial ? 1 : 0,
			config_file.defaultLifetime ?? null,
			config_file.defaultListPosition ?? null,
			config_file.defaultListTarget ?? null,
			config_file.defaultPaginateMode ?? 'Infinite',
			config_file.supressPaginationDeduplication ? 1 : 0,
			config_file.logLevel?.toUpperCase().replace(/-/g, '_') ?? null,
			config_file.defaultFragmentMasking === 'enable' ? 1 : 0,
			JSON.stringify(config_file.defaultKeys ?? []),
			config_file.persistedQueriesPath ?? path.join(config_file.runtimeDir!, 'queries.json'),
			config.root_dir ?? null,
			config_file.runtimeDir ?? null,
			config.filepath ?? null,
		]
	)

	// write the scalar definitions
	for (const [name, { type }] of Object.entries(config.config_file.runtimeScalars ?? {})) {
		db.run('INSERT INTO runtime_scalar_definitions (name, type) VALUES (?, ?)', [name, type])
	}

	// write router config
	if (config.config_file.router) {
		const session_keys = config.config_file.router.auth?.sessionKeys.join(',') ?? ''
		const url = config.config_file.router.auth?.url ?? null

		db.run(
			`INSERT INTO router_config (api_endpoint, redirect, session_keys, url, mutation)
			 VALUES (?, ?, ?, ?, ?)`,
			[null, null, session_keys, url, null]
		)
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
		db.run(
			`INSERT INTO watch_schema_config (url, headers, interval, timeout) VALUES (?, ?, ?, ?)`,
			[
				url,
				JSON.stringify(headers),
				config.config_file.watchSchema.interval ?? null,
				config.config_file.watchSchema.timeout ?? null,
			]
		)
	}

	// write the scalar configs
	for (const [name, { type, inputTypes, module, default: isDefault }] of Object.entries(
		config.config_file.scalars ?? {}
	)) {
		db.run(
			'INSERT INTO scalar_config (name, type, input_types, module, default_import) VALUES (?, ?, ?, ?, ?)',
			[
				name,
				type,
				JSON.stringify(((inputTypes as Array<string>) ?? []).concat(name)),
				module ?? null,
				isDefault ? 1 : null,
			]
		)
	}

	// write the type configs
	for (const [name, { keys, resolve }] of Object.entries(config.config_file.types ?? {})) {
		db.run('INSERT INTO type_configs (name, keys, resolve_query) VALUES (?, ?, ?)', [
			name,
			JSON.stringify(keys || config_file.defaultKeys || []),
			resolve?.queryField || null,
		])
	}
}
