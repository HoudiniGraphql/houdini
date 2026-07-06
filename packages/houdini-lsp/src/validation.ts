// The fast half of live validation. The real authority is the compiler pipeline,
// which the server runs against a buffer overlay on every (debounced) change — see
// overlay_validate in index.ts. This module only covers what the pipeline can't do
// well from the editor's point of view:
//   - syntax errors, reported instantly without a pipeline round trip
//   - @with / @when argument checks, which the pipeline attributes to the fragment's
//     file instead of the usage site — here they anchor on the exact argument node

import {
	GraphQLError,
	GraphQLList,
	GraphQLNonNull,
	Kind,
	Source,
	isInputType,
	parse,
	parseType,
	specifiedScalarTypes,
	validate,
	valueFromAST,
	type ASTNode,
	type DocumentNode,
	type FragmentDefinitionNode,
	type GraphQLSchema,
	type GraphQLType,
	type TypeNode,
	type ValidationRule,
} from 'graphql'
import { DiagnosticSeverity, type Diagnostic } from 'vscode-languageserver/node.js'

import { to_host, type Block, type Position } from './extract.js'

const BLOCK_SOURCE = 'houdini-lsp-block'

// name + declared type (SDL syntax); type '' means unknown — name check only
export type ArgSpec = { name: string; type: string }

// the ArgSpecs a fragment definition declares via @arguments — each argument is an
// object spec whose `type` field holds the SDL type string: @arguments(size: { type: "Int" })
export function fragment_arg_specs(def: FragmentDefinitionNode): ArgSpec[] {
	return (def.directives?.find((d) => d.name.value === 'arguments')?.arguments ?? []).map((a) => {
		let type = ''
		if (a.value.kind === Kind.OBJECT) {
			const typeField = a.value.fields.find((f) => f.name.value === 'type')
			if (typeField?.value.kind === Kind.STRING) {
				type = typeField.value.value
			}
		}
		return { name: a.name.value, type }
	})
}

// Per-spread argument knowledge sourced from the compiler database: what each
// fragment declares via @arguments, and what each named list's field accepts.
export type HoudiniArgKnowledge = {
	fragments: Map<string, ArgSpec[]>
	lists: Map<string, ArgSpec[]>
}

const NO_KNOWLEDGE: HoudiniArgKnowledge = { fragments: new Map(), lists: new Map() }

const LIST_OPERATION = /^(.+)_(insert|toggle|remove|upsert|update)$/

// Validate @with / @when arguments against the database: names must be declared,
// and literal values must satisfy the declared type. Fragments defined in the
// current block override the database (the buffer is fresher); unknown fragments,
// lists, types, and variable values are skipped so nothing here can false-positive.
function HoudiniDirectiveArgsRule(
	known: HoudiniArgKnowledge,
	localFragments: Map<string, ArgSpec[]>
): ValidationRule {
	return (context) => ({
		Directive(node, _key, parent, _path, ancestors) {
			const directive = node.name.value
			if (directive !== 'with' && directive !== 'when' && directive !== 'when_not') return

			// the owning node is the last non-array entry of the ancestor chain
			const chain = [...ancestors, parent]
			let owner: ASTNode | undefined
			for (let i = chain.length - 1; i >= 0; i--) {
				const c = chain[i]
				if (c && !Array.isArray(c)) {
					owner = c as ASTNode
					break
				}
			}
			if (owner?.kind !== Kind.FRAGMENT_SPREAD) return
			const spreadName = owner.name.value

			let declared: ArgSpec[] | undefined
			let describe: (declared: ArgSpec[]) => string
			if (directive === 'with') {
				declared = localFragments.get(spreadName) ?? known.fragments.get(spreadName)
				describe = (d) =>
					d.length
						? `fragment ${spreadName} declares (${d.map((a) => a.name).join(', ')})`
						: `fragment ${spreadName} declares no arguments`
			} else {
				const listOp = spreadName.match(LIST_OPERATION)
				if (!listOp) return
				declared = known.lists.get(listOp[1])
				describe = (d) =>
					d.length
						? `list ${listOp[1]} filters by (${d.map((a) => a.name).join(', ')})`
						: `list ${listOp[1]} has no filterable arguments`
			}
			if (!declared) return

			for (const arg of node.arguments ?? []) {
				const spec = declared.find((d) => d.name === arg.name.value)
				if (!spec) {
					context.reportError(
						new GraphQLError(
							`Unknown argument "${arg.name.value}" on @${directive}: ${describe(declared)}.`,
							{ nodes: arg }
						)
					)
					continue
				}

				// type-check literal values against the declared type. variables and
				// unresolvable types are skipped; custom scalars accept any literal.
				if (!spec.type || arg.value.kind === Kind.VARIABLE) continue
				let inputType
				try {
					inputType = resolve_type(context.getSchema(), parseType(spec.type))
				} catch {
					continue
				}
				if (!inputType || !isInputType(inputType)) continue
				if (valueFromAST(arg.value, inputType) === undefined) {
					context.reportError(
						new GraphQLError(
							`Invalid value for "${arg.name.value}" on @${directive}: expected ${spec.type}.`,
							{ nodes: arg.value }
						)
					)
				}
			}
		},
	})
}

// like graphql's typeFromAST, but falls back to the spec scalars — the schema we
// reconstruct from the database only contains built-ins that some field references
const BUILTIN_SCALARS = new Map(specifiedScalarTypes.map((t) => [t.name, t]))

function resolve_type(schema: GraphQLSchema, node: TypeNode): GraphQLType | undefined {
	if (node.kind === Kind.NON_NULL_TYPE) {
		const inner = resolve_type(schema, node.type)
		return inner && new GraphQLNonNull(inner as any)
	}
	if (node.kind === Kind.LIST_TYPE) {
		const inner = resolve_type(schema, node.type)
		return inner && new GraphQLList(inner)
	}
	return schema.getType(node.name.value) ?? BUILTIN_SCALARS.get(node.name.value)
}

// Fast diagnostics for one extracted block, in host-file coordinates: syntax errors
// plus the Houdini directive-argument rule. Everything else comes from the pipeline
// overlay.
export function validate_block(
	schema: GraphQLSchema,
	block: Block,
	houdini: HoudiniArgKnowledge = NO_KNOWLEDGE
): Diagnostic[] {
	let ast: DocumentNode
	try {
		ast = parse(new Source(block.content, BLOCK_SOURCE))
	} catch (err) {
		if (err instanceof GraphQLError && err.locations?.length) {
			const start = to_host(block, {
				line: err.locations[0].line - 1,
				character: err.locations[0].column - 1,
			})
			return [
				diagnostic(err.message, start, {
					line: start.line,
					character: start.character + 1,
				}),
			]
		}
		return []
	}

	// fragments defined in this block carry their @arguments in the buffer — always
	// fresher than the database
	const localFragments = new Map<string, ArgSpec[]>(
		ast.definitions
			.filter((d): d is FragmentDefinitionNode => d.kind === Kind.FRAGMENT_DEFINITION)
			.map((def) => [def.name.value, fragment_arg_specs(def)])
	)

	const diagnostics: Diagnostic[] = []
	for (const error of validate(schema, ast, [
		HoudiniDirectiveArgsRule(houdini, localFragments),
	])) {
		const loc = error.nodes?.find((n) => n.loc?.source.name === BLOCK_SOURCE)?.loc
		if (!loc) continue

		diagnostics.push(
			diagnostic(
				error.message,
				to_host(block, offset_position(block.content, loc.start)),
				to_host(block, offset_position(block.content, loc.end))
			)
		)
	}
	return diagnostics
}

function diagnostic(message: string, start: Position, end: Position): Diagnostic {
	return {
		severity: DiagnosticSeverity.Error,
		range: { start, end },
		message,
		source: 'houdini',
	}
}

function offset_position(content: string, offset: number): Position {
	let line = 0
	let lineStart = 0
	for (let i = 0; i < offset && i < content.length; i++) {
		if (content[i] === '\n') {
			line++
			lineStart = i + 1
		}
	}
	return { line, character: offset - lineStart }
}
