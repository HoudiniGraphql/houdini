import type { ConfigFile } from 'houdini'

import { unmarshalValue } from './coerce.js'
import { getCurrentConfig } from './config.js'
import type { InputObject } from './types.js'

/**
 * coerceFormData turns a browser FormData into GraphQL variables, driven by a document's
 * compiled `input` metadata. It is the single coercion shared by the client (enhanced
 * form submit) and the server (no-JS form endpoint) so the two paths can't drift.
 *
 * It is a domain wrapper over the shared coercion core (`unmarshalValue`): it folds the
 * flat FormData keys into the right shape, applies the form-specific rules below, and
 * hands custom-scalar leaves to the core. The result holds **rich** runtime values (e.g.
 * Dates), so the normal mutation send re-marshals them — no special, marshal-bypassing
 * code path is needed.
 *
 * Form-specific rules:
 *   - an unchecked checkbox is absent from FormData → a missing Boolean becomes `false`
 *   - an empty string is "absent" for numbers/enums/custom scalars → `null` (but a real
 *     "" is kept for String/ID)
 *   - File/Blob values pass through untouched for multipart handling
 *
 * Field-name conventions:
 *   - `.` nests:        name="input.address.city"
 *   - trailing `[]`:    name="tags[]"   (a scalar list; repeat the field per item)
 */
export function coerceFormData(
	formData: FormData,
	input: InputObject,
	config: ConfigFile = getCurrentConfig(),
	// optional `@endpoint(fields: […])` allowlist; when present, any submitted key not in it
	// is dropped (the over-posting / mass-assignment mitigation). Both the server and client
	// pass `artifact.endpoint.fields`, so the two paths enforce the same list.
	allowedFields?: readonly string[]
): Record<string, any> {
	// step 1: fold the flat keys into a nested structure of raw strings / arrays / Files
	const raw = foldFormData(formData, allowedFields ? new Set(allowedFields) : undefined)

	// step 2: coerce against the metadata starting from the top-level fields
	return coerceObject(raw, input.fields, input, config)
}

// foldFormData turns flat FormData keys into a nested object following the
// dot/`[]` path convention. Values stay as their raw FormData form (string | File). When an
// allowlist is given, keys outside it are skipped before they ever enter the structure.
function foldFormData(formData: FormData, allowed?: Set<string>): Record<string, any> {
	const root: Record<string, any> = {}

	formData.forEach((value, key) => {
		if (allowed && !allowed.has(key)) {
			return
		}
		const segments = key.split('.')
		let cursor = root

		segments.forEach((segment, i) => {
			const isLast = i === segments.length - 1
			const isList = segment.endsWith('[]')
			const name = isList ? segment.slice(0, -2) : segment

			if (!isLast) {
				cursor[name] = cursor[name] ?? {}
				cursor = cursor[name]
				return
			}

			if (isList) {
				cursor[name] = cursor[name] ?? []
				cursor[name].push(value)
			} else {
				cursor[name] = value
			}
		})
	})

	return root
}

// coerceObject walks the known fields for a level (top-level `input.fields` or a nested
// `input.types[type]`) and coerces each one. Iterating the metadata — rather than the raw
// keys — is what lets absent booleans default to false and drops unknown form fields
// (e.g. the hidden __houdini_form markers).
function coerceObject(
	raw: Record<string, any> | undefined,
	fields: Record<string, string>,
	input: InputObject,
	config: ConfigFile
): Record<string, any> {
	const result: Record<string, any> = {}

	for (const [field, type] of Object.entries(fields)) {
		const value = raw?.[field]
		const nestedFields = input.types[type]

		// input object types recurse
		if (nestedFields) {
			if (Array.isArray(value)) {
				result[field] = value.map((entry) => coerceObject(entry, nestedFields, input, config))
			} else if (value !== undefined) {
				result[field] = coerceObject(value, nestedFields, input, config)
			}
			continue
		}

		// scalar / enum leaf
		if (value === undefined) {
			// an unchecked checkbox never appears in FormData — a missing Boolean is false
			if (type === 'Boolean') {
				result[field] = false
			}
			continue
		}

		if (Array.isArray(value)) {
			result[field] = value.map((entry) => coerceLeaf(entry, type, config))
		} else {
			result[field] = coerceLeaf(value, type, config)
		}
	}

	return result
}

// coerceLeaf applies the form-specific scalar rules, delegating custom scalars to the
// shared coercion core so a form value unmarshals exactly like a URL one.
function coerceLeaf(value: any, type: string, config: ConfigFile): any {
	// uploads ride through untouched so extractFiles can build the multipart request
	if (isFile(value)) {
		return value
	}

	const text = typeof value === 'string' ? value : String(value)

	// custom scalars run through the shared core (decode + unmarshal → a rich value the
	// normal send re-marshals); an empty string means "absent".
	if (config.scalars?.[type]) {
		return text === '' ? null : unmarshalValue(text, config.scalars[type]?.unmarshal)
	}

	switch (type) {
		case 'Int': {
			if (text === '') return null
			const parsed = Number.parseInt(text, 10)
			return Number.isNaN(parsed) ? null : parsed
		}
		case 'Float': {
			if (text === '') return null
			const parsed = Number.parseFloat(text)
			return Number.isNaN(parsed) ? null : parsed
		}
		case 'Boolean':
			// a present checkbox sends its value ("on" by default); explicit true-ish wins
			return text === 'true' || text === 'on' || text === '1'
		case 'String':
		case 'ID':
			// strings pass through verbatim — "" is a meaningful value
			return text
		default:
			// enums (and anything unrecognized) pass through; "" means absent
			return text === '' ? null : text
	}
}

// isFile reports whether a value is a File/Blob, guarding for environments (e.g. older
// Node) where those globals may be missing.
function isFile(value: any): boolean {
	if (typeof Blob !== 'undefined' && value instanceof Blob) {
		return true
	}
	if (typeof File !== 'undefined' && value instanceof File) {
		return true
	}
	return false
}
