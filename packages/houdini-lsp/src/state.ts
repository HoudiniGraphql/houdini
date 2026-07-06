// The server's shared state, threaded explicitly through every module. All of it
// is owned by the pipeline lifecycle: setup populates it, config-change restarts
// rebuild it, shutdown tears it down.

import { Kind, Source, parse, type FragmentDefinitionNode, type GraphQLSchema } from 'graphql'
import type { CompilerProxy, Db } from 'houdini/lib'
import type { Connection, Diagnostic } from 'vscode-languageserver/node.js'
import type { TextDocuments } from 'vscode-languageserver/node.js'
import type { TextDocument } from 'vscode-languageserver-textdocument'

import {
	all_fragment_arguments,
	all_list_field_arguments,
	project_fragments,
} from './db_query.js'
import { schema_from_db } from './schema_from_db.js'
import type { HoudiniArgKnowledge } from './validation.js'

export type ServerState = {
	connection: Connection
	documents: TextDocuments<TextDocument>

	compiler: CompilerProxy | null
	db: Db | null
	root_dir: string
	// resolves once the pipeline is set up; reassigned on config-change restarts
	ready: Promise<void>

	// rebuilt from the database after every pipeline run (rebuild_schema)
	schema: GraphQLSchema | null
	external_fragments: FragmentDefinitionNode[]
	houdini_args: HoudiniArgKnowledge

	// debounce timers for live validation, keyed by uri
	live_timers: Map<string, ReturnType<typeof setTimeout>>
	// files we last published pipeline diagnostics to, so stale ones clear on the next run
	pipeline_diagnostic_uris: Set<string>
	// the live-path diagnostics currently published per uri — full pipeline runs
	// merge with these instead of wiping them
	live_diagnostics: Map<string, Diagnostic[]>
	// whether the client supports dynamic didChangeWatchedFiles registration
	// (captured at initialize; registration happens after initialized)
	watch_registration_supported: boolean
}

export function create_state(
	connection: Connection,
	documents: TextDocuments<TextDocument>
): ServerState {
	return {
		connection,
		documents,
		compiler: null,
		db: null,
		root_dir: '',
		ready: Promise.resolve(),
		schema: null,
		external_fragments: [],
		houdini_args: { fragments: new Map(), lists: new Map() },
		live_timers: new Map(),
		pipeline_diagnostic_uris: new Set(),
		live_diagnostics: new Map(),
		watch_registration_supported: false,
	}
}

// rebuild the in-memory schema, fragment stubs, and argument knowledge from
// whatever the pipeline last wrote
export function rebuild_schema(state: ServerState) {
	if (!state.db) return
	state.db.reload()
	state.schema = schema_from_db(state.db)
	state.external_fragments = load_external_fragments(state.db)
	state.houdini_args = {
		fragments: all_fragment_arguments(state.db),
		lists: all_list_field_arguments(state.db),
	}
}

// stub definitions for every project fragment so spreads resolve in completions and
// validation without concatenating full document sources
function load_external_fragments(db: Db): FragmentDefinitionNode[] {
	const text = project_fragments(db)
		.map((f) => `fragment ${f.name} on ${f.type_condition} { __typename }`)
		.join('\n')
	if (!text) return []
	try {
		return parse(new Source(text, 'houdini-project-fragments')).definitions.filter(
			(d): d is FragmentDefinitionNode => d.kind === Kind.FRAGMENT_DEFINITION
		)
	} catch {
		return []
	}
}
