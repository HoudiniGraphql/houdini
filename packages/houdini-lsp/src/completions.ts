// Houdini-specific completion logic, factored out of the server entrypoint so it
// can be unit tested without starting an LSP connection.

import { Kind } from 'graphql'
import type { ContextToken } from 'graphql-language-service'
import type { Db } from 'houdini/lib'
import { CompletionItemKind, type CompletionItem } from 'vscode-languageserver/node.js'

import {
	fragment_arguments,
	fragment_type_fields,
	list_exists,
	list_field_arguments,
	type DefinitionLocation,
} from './db_query.js'
import type { Position } from './extract.js'

// ── Houdini directive context ─────────────────────────────────────────────────

export type HoudiniCtx =
	| { kind: 'with'; fragmentName: string }
	| { kind: 'when' | 'when_not'; fragmentName: string }
	| { kind: 'arguments'; fragmentName: string }

export function houdiniDirectiveContext(state: ContextToken['state']): HoudiniCtx | null {
	let s: ContextToken['state'] | null = state
	while (s) {
		if (s.kind === Kind.DIRECTIVE && s.name) {
			const name = s.name
			if (name === 'with' || name === 'when' || name === 'when_not' || name === 'arguments') {
				const fragmentName = findEnclosingFragmentName(s.prevState ?? null)
				if (!fragmentName) return null
				return { kind: name as HoudiniCtx['kind'], fragmentName }
			}
		}
		s = s.prevState ?? null
	}
	return null
}

function findEnclosingFragmentName(state: ContextToken['state'] | null): string | null {
	let s = state
	while (s) {
		if ((s.kind === Kind.FRAGMENT_SPREAD || s.kind === Kind.FRAGMENT_DEFINITION) && s.name) {
			return s.name
		}
		s = s.prevState ?? null
	}
	return null
}

const LIST_OPERATION = /^(.+)_(insert|toggle|remove|upsert|update)$/

export function houdiniCompletions(ctx: HoudiniCtx, db: Db): CompletionItem[] {
	switch (ctx.kind) {
		case 'with':
		case 'arguments': {
			const args = fragment_arguments(db, ctx.fragmentName)
			return required_first(
				args.map((a) => ({
					label: a.name,
					detail: a.type,
					kind: CompletionItemKind.Field,
					insertText: `${a.name}: `,
				}))
			)
		}

		case 'when':
		case 'when_not': {
			// on a list operation spread (Friends_insert @when(...)), the filters are
			// the arguments of the field the list was declared on — even when that's
			// none. only fall back to type fields for non-list fragment names.
			const listOp = ctx.fragmentName.match(LIST_OPERATION)
			const fields =
				listOp && list_exists(db, listOp[1])
					? list_field_arguments(db, listOp[1])
					: fragment_type_fields(db, ctx.fragmentName)
			return required_first(
				fields.map((f) => ({
					label: f.name,
					detail: buildTypeLabel(f.type, f.type_modifiers),
					documentation: f.description ?? undefined,
					kind: CompletionItemKind.Field,
					insertText: `${f.name}: `,
				}))
			)
		}
	}
}

export function buildTypeLabel(type: string, modifiers: string | null): string {
	if (!modifiers) return type
	const listDepth = (modifiers.match(/\]/g) ?? []).length
	return '['.repeat(listDepth) + type + modifiers
}

// ── argument ordering ─────────────────────────────────────────────────────────

// is the cursor inside an argument list (field or directive)?
export function in_arguments(state: ContextToken['state']): boolean {
	let s: ContextToken['state'] | null = state
	while (s) {
		if (s.kind === 'Arguments' || s.kind === Kind.ARGUMENT) return true
		// don't look past the enclosing field/directive
		if (s.kind === 'SelectionSet' || s.kind === Kind.DOCUMENT) return false
		s = s.prevState ?? null
	}
	return false
}

// order required arguments (non-null type) before optional ones; clients sort by
// sortText when present. graphql-language-service puts the type on item.type /
// labelDetails.detail; our own completions use detail.
export function required_first(items: CompletionItem[]): CompletionItem[] {
	return items.map((item) => {
		const typeStr = String(
			(item as { type?: unknown }).type ?? item.labelDetails?.detail ?? item.detail ?? ''
		).trim()
		return {
			...item,
			sortText: `${typeStr.endsWith('!') ? '0' : '1'}${item.label}`,
		}
	})
}

// ── definition ────────────────────────────────────────────────────────────────

// find the `fragment <name>` keyword inside the raw document and translate it
// through the document's (0-based) offset into file coordinates
export function definition_position(loc: DefinitionLocation, name: string): Position {
	const match = new RegExp(`fragment\\s+${name}\\b`).exec(loc.content)
	if (!match) {
		return { line: loc.line, character: loc.column }
	}
	const before = loc.content.slice(0, match.index)
	const lines = before.split('\n')
	return {
		line: loc.line + lines.length - 1,
		character: lines.length === 1 ? loc.column + match.index : lines[lines.length - 1].length,
	}
}
