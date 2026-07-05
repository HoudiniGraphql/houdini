// The request handlers: completion, hover, and go-to-definition, all block-aware —
// positions are translated into the containing graphql document before the
// language services run, and results are translated back.

import { Kind } from 'graphql'
import {
	getAutocompleteSuggestions,
	getHoverInformation,
	getTokenAtPosition,
	Position as GQLPosition,
	type ContextToken,
} from 'graphql-language-service'
import { pathToFileURL } from 'node:url'
import type {
	CompletionItem,
	CompletionParams,
	DefinitionParams,
	HoverParams,
	Location,
} from 'vscode-languageserver/node.js'
import type { TextDocument } from 'vscode-languageserver-textdocument'

import {
	definition_position,
	houdiniCompletions,
	houdiniDirectiveContext,
	in_arguments,
	required_first,
} from './completions.js'
import { fragment_definition_location } from './db_query.js'
import { block_at, extract_blocks, to_local, type Block, type Position } from './extract.js'
import type { ServerState } from './state.js'

// find the graphql block containing a host-file position and translate into it
function locate(
	doc: TextDocument,
	position: Position
): { block: Block; local: Position } | null {
	const block = block_at(extract_blocks(doc.getText(), doc.uri), position)
	if (!block) return null
	return { block, local: to_local(block, position) }
}

export function register_handlers(state: ServerState) {
	const { connection, documents } = state

	connection.onCompletion(async (params: CompletionParams): Promise<CompletionItem[]> => {
		await state.ready
		const { schema, db } = state
		if (!schema || !db) return []

		const doc = documents.get(params.textDocument.uri)
		if (!doc) return []

		const located = locate(doc, params.position)
		if (!located) return []
		const { block, local } = located

		const cursor = new GQLPosition(local.line, local.character)
		// offset 1 = the token ending at the cursor. without it, a cursor at the end of
		// a line (the normal typing position) matches no token and the state collapses
		// to Document, which turns every completion into top-level keywords
		const token: ContextToken = getTokenAtPosition(block.content, cursor, 1)
		const ctx = houdiniDirectiveContext(token.state)

		if (ctx) {
			return houdiniCompletions(ctx, db)
		}

		// standard GraphQL completions, with project fragments available for spreads
		const suggestions = getAutocompleteSuggestions(
			schema,
			block.content,
			cursor,
			token as any,
			state.external_fragments
		)

		// a fragment defined in this block also exists as an external stub — dedupe
		const seen = new Set<string>()
		const items = (suggestions as CompletionItem[]).filter((s) => {
			if (seen.has(s.label)) return false
			seen.add(s.label)
			return true
		})

		return in_arguments(token.state) ? required_first(items) : items
	})

	connection.onHover(async (params: HoverParams) => {
		await state.ready
		const { schema } = state
		if (!schema) return null

		const doc = documents.get(params.textDocument.uri)
		if (!doc) return null

		const located = locate(doc, params.position)
		if (!located) return null
		const { block, local } = located

		// no token offset here: hovering targets the character under the pointer,
		// which is the containing-token semantic
		const result = getHoverInformation(
			schema,
			block.content,
			new GQLPosition(local.line, local.character)
		)
		if (!result || result === '') return null

		return {
			contents: typeof result === 'string' ? { kind: 'markdown', value: result } : result,
		}
	})

	connection.onDefinition(async (params: DefinitionParams): Promise<Location | null> => {
		await state.ready
		const { db } = state
		if (!db) return null

		const doc = documents.get(params.textDocument.uri)
		if (!doc) return null

		const located = locate(doc, params.position)
		if (!located) return null
		const { block, local } = located

		// offset 1 for the same end-of-line reason as completions
		const token = getTokenAtPosition(
			block.content,
			new GQLPosition(local.line, local.character),
			1
		)

		// Walk up to find a FragmentSpread node
		let s = token.state
		while (s) {
			if (s.kind === Kind.FRAGMENT_SPREAD && s.name) {
				const loc = fragment_definition_location(db, s.name)
				if (!loc) return null
				const position = definition_position(loc, s.name)
				return {
					uri: pathToFileURL(loc.filepath).toString(),
					range: { start: position, end: position },
				}
			}
			s = s.prevState as typeof s
		}

		return null
	})
}
