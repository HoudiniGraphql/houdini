// Shared coercion core: turning the transport-form values that a URL or a form carries
// back into the rich runtime values Houdini works with. Both the router (search / route
// params) and progressively-enhanced forms are thin domain wrappers over this.

// An unmarshaler turns a transport value into a rich runtime value (e.g. a timestamp into
// a Date). It is a custom scalar's `unmarshal` from the config.
export type Unmarshaler = (value: any) => any

// decodeScalar recovers the marshaled value from the string a transport carries. The value
// was written with String(), which dropped its type, so we JSON.parse to get numbers,
// booleans and null back, falling back to the raw string when it isn't valid JSON (e.g. a
// custom scalar that marshals to a plain string). Consequence worth knowing: a value like
// "true" or "123" always decodes to a boolean / number before it reaches an unmarshaler.
export function decodeScalar(value: string): unknown {
	try {
		return JSON.parse(value)
	} catch {
		return value
	}
}

// unmarshalValue is the per-leaf coercion shared by every domain wrapper: it decodes the
// transport string and, when the leaf is a custom scalar, runs its unmarshaler — list
// values element-wise, null/undefined untouched. A leaf with no unmarshaler (built-in or
// UI-only key) is returned decoded but otherwise as-is.
export function unmarshalValue(value: any, unmarshal?: Unmarshaler): any {
	if (value === null || value === undefined) {
		return value
	}
	if (Array.isArray(value)) {
		return value.map((entry) => unmarshalValue(entry, unmarshal))
	}
	const decoded = typeof value === 'string' ? decodeScalar(value) : value
	return unmarshal ? unmarshal(decoded) : decoded
}
