import {
	GraphQLSchema,
	GraphQLObjectType,
	GraphQLInterfaceType,
	GraphQLUnionType,
	GraphQLEnumType,
	GraphQLInputObjectType,
	GraphQLScalarType,
	GraphQLNonNull,
	GraphQLList,
	GraphQLDirective,
	GraphQLString,
	GraphQLBoolean,
	GraphQLInt,
	GraphQLFloat,
	GraphQLID,
	isObjectType,
	isInterfaceType,
	DirectiveLocation,
	type GraphQLNamedType,
	type GraphQLType,
	type GraphQLFieldConfigMap,
	type GraphQLInputFieldConfigMap,
	type GraphQLArgumentConfig,
} from 'graphql'
import type { Db } from 'houdini/lib'

// ── type string helpers ───────────────────────────────────────────────────────

// type_modifiers is the suffix after the base type name from ParseFieldType.
// e.g. base="String", modifiers="!]!" → "[String!]!"
function reconstructTypeStr(base: string, modifiers: string | null): string {
	if (!modifiers) return base
	const listDepth = (modifiers.match(/\]/g) ?? []).length
	return '['.repeat(listDepth) + base + modifiers
}

const BUILTIN_SCALARS: Record<string, GraphQLNamedType> = {
	String: GraphQLString,
	Boolean: GraphQLBoolean,
	Int: GraphQLInt,
	Float: GraphQLFloat,
	ID: GraphQLID,
}

function parseTypeStr(typeStr: string, namedTypes: Map<string, GraphQLNamedType>): GraphQLType {
	if (typeStr.endsWith('!')) {
		return new GraphQLNonNull(parseTypeStr(typeStr.slice(0, -1), namedTypes))
	}
	if (typeStr.startsWith('[')) {
		return new GraphQLList(parseTypeStr(typeStr.slice(1, -1), namedTypes))
	}
	const known = BUILTIN_SCALARS[typeStr] ?? namedTypes.get(typeStr)
	if (known) return known
	// unknown reference — memoize the placeholder so every reference shares one
	// instance (two instances with the same name make the schema invalid)
	const placeholder = new GraphQLScalarType({ name: typeStr })
	namedTypes.set(typeStr, placeholder)
	return placeholder
}

function buildType(
	base: string,
	modifiers: string | null,
	namedTypes: Map<string, GraphQLNamedType>
): GraphQLType {
	return parseTypeStr(reconstructTypeStr(base, modifiers), namedTypes)
}

// ── row types ─────────────────────────────────────────────────────────────────

type TypeRow = { name: string; kind: string; description: string | null; operation: string | null }
type FieldRow = {
	id: string
	parent: string
	name: string
	type: string
	type_modifiers: string | null
	description: string | null
	default_value: string | null
}
type ArgRow = {
	field: string
	name: string
	type: string
	type_modifiers: string | null
	default_value: string | null
}
type DirectiveArgRow = {
	parent: string
	name: string
	type: string
	type_modifiers: string | null
	default_value: string | null
}

// ── main export ───────────────────────────────────────────────────────────────

export function schema_from_db(db: Db): GraphQLSchema {
	// Load everything up-front to avoid N+1 queries inside thunks. Introspection
	// machinery (__-prefixed names) is stored in the same tables but reserved by
	// graphql-js — including it makes the schema fail validation.
	const typeRows = db.all<TypeRow>(
		`SELECT name, kind, description, operation FROM types
		 WHERE built_in = 0 AND name NOT LIKE '\\_\\_%' ESCAPE '\\'`
	)

	const enumValRows = db.all<{ parent: string; value: string; description: string | null }>(
		`SELECT parent, value, description FROM enum_values`
	)
	const enumValsByParent = groupBy(enumValRows, (r) => r.parent)

	// component fields are stored internal (they never reach the API) but users
	// query them like any other field, so they belong in editor completions
	const fieldRows = db.all<FieldRow>(
		`SELECT id, parent, name, type, type_modifiers, description, default_value
		 FROM type_fields
		 WHERE ((internal = 0 OR internal IS NULL)
		    OR id IN (SELECT type_field FROM component_fields))
		   AND name NOT LIKE '\\_\\_%' ESCAPE '\\'`
	)
	const fieldsByParent = groupBy(fieldRows, (r) => r.parent)

	const argRows = db.all<ArgRow>(
		`SELECT field, name, type, type_modifiers, default_value FROM type_field_arguments`
	)
	const argsByField = groupBy(argRows, (r) => r.field)

	// possible_types: type = interface/union, member = implementing/member type
	const possibleTypeRows = db.all<{ type: string; member: string }>(
		`SELECT type, member FROM possible_types`
	)
	// membersByType: interface/union → its members
	const membersByType = groupBy(
		possibleTypeRows,
		(r) => r.type,
		(r) => r.member
	)
	// interfacesByObject: object type → interfaces it implements
	const interfacesByObject = groupBy(
		possibleTypeRows,
		(r) => r.member,
		(r) => r.type
	)

	// ── build named type stubs ────────────────────────────────────────────
	const namedTypes = new Map<string, GraphQLNamedType>()

	for (const row of typeRows) {
		switch (row.kind) {
			case 'OBJECT':
				namedTypes.set(
					row.name,
					new GraphQLObjectType({
						name: row.name,
						description: row.description ?? undefined,
						fields: () =>
							buildObjectFields(row.name, namedTypes, fieldsByParent, argsByField),
						interfaces: () =>
							(interfacesByObject.get(row.name) ?? [])
								.map((n) => namedTypes.get(n))
								.filter(isInterfaceType),
					})
				)
				break

			case 'INTERFACE':
				namedTypes.set(
					row.name,
					new GraphQLInterfaceType({
						name: row.name,
						description: row.description ?? undefined,
						fields: () =>
							buildObjectFields(row.name, namedTypes, fieldsByParent, argsByField),
					})
				)
				break

			case 'UNION':
				namedTypes.set(
					row.name,
					new GraphQLUnionType({
						name: row.name,
						description: row.description ?? undefined,
						types: () =>
							(membersByType.get(row.name) ?? [])
								.map((n) => namedTypes.get(n))
								.filter(isObjectType),
					})
				)
				break

			case 'ENUM':
				namedTypes.set(
					row.name,
					new GraphQLEnumType({
						name: row.name,
						description: row.description ?? undefined,
						values: Object.fromEntries(
							(enumValsByParent.get(row.name) ?? []).map((v) => [
								v.value,
								{ description: v.description ?? undefined },
							])
						),
					})
				)
				break

			case 'INPUT':
				namedTypes.set(
					row.name,
					new GraphQLInputObjectType({
						name: row.name,
						description: row.description ?? undefined,
						fields: () => buildInputFields(row.name, namedTypes, fieldsByParent),
					})
				)
				break

			case 'SCALAR':
				namedTypes.set(
					row.name,
					new GraphQLScalarType({
						name: row.name,
						description: row.description ?? undefined,
					})
				)
				break
		}
	}

	// ── directives ────────────────────────────────────────────────────────
	// include invisible directives too: `visible` only governs whether the definition
	// is printed into the generated schema file — @list is invisible but user-written.
	// __-prefixed names (the runtime scalar marker) are reserved by graphql-js.
	const directiveRows = db.all<{
		name: string
		repeatable: number
		description: string | null
	}>(`SELECT name, repeatable, description FROM directives
	    WHERE name NOT LIKE '\\_\\_%' ESCAPE '\\'`)

	const directiveArgRows = db.all<DirectiveArgRow>(
		`SELECT parent, name, type, type_modifiers, default_value FROM directive_arguments`
	)
	const directiveArgsByParent = groupBy(directiveArgRows, (r) => r.parent)

	const directiveLocRows = db.all<{ directive: string; location: string }>(
		`SELECT directive, location FROM directive_locations`
	)
	const locationsByDirective = groupBy(
		directiveLocRows,
		(r) => r.directive,
		(r) => r.location
	)

	const directives = directiveRows.map((d) => {
		// generated delete directives (<Type>_delete) are stored with no locations;
		// they decorate mutation fields, and a directive needs at least one location
		// for the schema to be valid
		const locations = locationsByDirective.get(d.name) ?? []
		return new GraphQLDirective({
			name: d.name,
			description: d.description ?? undefined,
			isRepeatable: d.repeatable === 1,
			locations: (locations.length ? locations : ['FIELD']) as DirectiveLocation[],
			args: buildArgMap(directiveArgsByParent.get(d.name) ?? [], namedTypes),
		})
	})

	// ── assemble schema ───────────────────────────────────────────────────
	const queryRow = typeRows.find((t) => t.operation === 'query')
	const mutationRow = typeRows.find((t) => t.operation === 'mutation')
	const subscriptionRow = typeRows.find((t) => t.operation === 'subscription')

	return new GraphQLSchema({
		query: queryRow ? (namedTypes.get(queryRow.name) as GraphQLObjectType) : undefined,
		mutation: mutationRow ? (namedTypes.get(mutationRow.name) as GraphQLObjectType) : undefined,
		subscription: subscriptionRow
			? (namedTypes.get(subscriptionRow.name) as GraphQLObjectType)
			: undefined,
		types: [...namedTypes.values()],
		directives,
	})
}

// ── field map builders ────────────────────────────────────────────────────────

function buildObjectFields(
	typeName: string,
	namedTypes: Map<string, GraphQLNamedType>,
	fieldsByParent: Map<string, FieldRow[]>,
	argsByField: Map<string, ArgRow[]>
): GraphQLFieldConfigMap<unknown, unknown> {
	const result: GraphQLFieldConfigMap<unknown, unknown> = {}
	for (const f of fieldsByParent.get(typeName) ?? []) {
		result[f.name] = {
			type: buildType(f.type, f.type_modifiers, namedTypes) as any,
			description: f.description ?? undefined,
			args: buildArgMap(argsByField.get(f.id) ?? [], namedTypes),
		}
	}
	return result
}

function buildInputFields(
	typeName: string,
	namedTypes: Map<string, GraphQLNamedType>,
	fieldsByParent: Map<string, FieldRow[]>
): GraphQLInputFieldConfigMap {
	const result: GraphQLInputFieldConfigMap = {}
	for (const f of fieldsByParent.get(typeName) ?? []) {
		result[f.name] = {
			type: buildType(f.type, f.type_modifiers, namedTypes) as any,
			description: f.description ?? undefined,
			defaultValue: f.default_value ?? undefined,
		}
	}
	return result
}

function buildArgMap(
	rows: Array<{
		name: string
		type: string
		type_modifiers: string | null
		default_value: string | null
	}>,
	namedTypes: Map<string, GraphQLNamedType>
): Record<string, GraphQLArgumentConfig> {
	return Object.fromEntries(
		rows.map((a) => [
			a.name,
			{
				type: buildType(a.type, a.type_modifiers, namedTypes) as any,
				defaultValue: a.default_value ?? undefined,
			} satisfies GraphQLArgumentConfig,
		])
	)
}

// ── utility ───────────────────────────────────────────────────────────────────

function groupBy<T, V = T>(
	rows: T[],
	key: (row: T) => string,
	val: (row: T) => V = (r) => r as unknown as V
): Map<string, V[]> {
	const map = new Map<string, V[]>()
	for (const row of rows) {
		const k = key(row)
		const list = map.get(k) ?? []
		list.push(val(row))
		map.set(k, list)
	}
	return map
}
