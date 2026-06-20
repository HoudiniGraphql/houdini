// A marshaler turns a rich runtime value (e.g. a Date) into the transport form that
// belongs in the URL (e.g. a timestamp). Keyed by param / search-param name.
type Marshaler = (value: any) => any
type Marshalers = Record<string, Marshaler>

// scalarMarshalers builds a name→marshal map for the route's params or search params by
// looking each declared GraphQL type up in the config's custom scalars. Names without a
// custom-scalar marshal function are omitted, so callers fall back to String(value).
// Kept pure (scalars are passed in) so it can be unit-tested without the runtime config.
export function scalarMarshalers(
	defs: ReadonlyArray<{ name: string; type?: string }> | undefined,
	scalars: Record<string, { marshal?: Marshaler } | undefined> | undefined
): Marshalers {
	const out: Marshalers = {}
	for (const def of defs ?? []) {
		const marshal = def.type ? scalars?.[def.type]?.marshal : undefined
		if (marshal) {
			out[def.name] = marshal
		}
	}
	return out
}

// marshalValue applies the per-key marshaler (if any) and stringifies the result.
function marshalValue(value: unknown, marshal?: Marshaler): string {
	return String(marshal ? marshal(value) : value)
}

// An unmarshaler is the inverse of a Marshaler: it turns the transport form a URL carries
// back into a rich runtime value (e.g. a timestamp string into a Date).
type Unmarshaler = (value: any) => any
type Unmarshalers = Record<string, Unmarshaler>

// scalarUnmarshalers is the read-side mirror of scalarMarshalers: a name→unmarshal map for
// the declared params/search params whose GraphQL type is a custom scalar. Names without a
// custom-scalar unmarshal function are omitted (built-ins and UI-only keys are left as-is).
export function scalarUnmarshalers(
	defs: ReadonlyArray<{ name: string; type?: string }> | undefined,
	scalars: Record<string, { unmarshal?: Unmarshaler } | undefined> | undefined
): Unmarshalers {
	const out: Unmarshalers = {}
	for (const def of defs ?? []) {
		const unmarshal = def.type ? scalars?.[def.type]?.unmarshal : undefined
		if (unmarshal) {
			out[def.name] = unmarshal
		}
	}
	return out
}

// decodeScalar recovers the marshaled value from the string the URL carries. marshalValue
// wrote it with String(), which dropped the type, so we JSON.parse to get numbers, booleans
// and null back, falling back to the raw string when it isn't valid JSON (e.g. a custom
// scalar that marshals to a plain string). Consequence worth documenting: a value like
// "true" or "123" always decodes to a boolean / number before it reaches unmarshal.
function decodeScalar(value: string): unknown {
	try {
		return JSON.parse(value)
	} catch {
		return value
	}
}

// unmarshalScalars turns the transport values a parsed query string carries back into rich
// runtime values for every key that has a custom-scalar unmarshaler. Keys without one
// (built-ins, UI-only keys) pass through untouched; List values are unmarshaled
// element-wise. Used for both useRoute().location.search and the query variables the router feeds
// back into marshalInputs, so a custom-scalar search param round-trips correctly. When
// there's nothing to unmarshal the input object is returned as-is (no allocation).
export function unmarshalScalars(
	values: Record<string, any>,
	unmarshalers: Unmarshalers
): Record<string, any> {
	if (Object.keys(unmarshalers).length === 0) {
		return values
	}
	const out: Record<string, any> = { ...values }
	for (const [key, unmarshal] of Object.entries(unmarshalers)) {
		if (!(key in out) || out[key] == null) {
			continue
		}
		const value = out[key]
		out[key] = Array.isArray(value)
			? value.map((entry) => unmarshal(decodeScalar(entry)))
			: unmarshal(decodeScalar(value))
	}
	return out
}

// the per-route info buildHref needs to marshal: the declared param and search types.
export type RouteHrefInfo = {
	params?: ReadonlyArray<{ name: string; type?: string }>
	searchParams?: ReadonlyArray<{ name: string; type?: string }>
}

// buildHref assembles a full href for a route: it fills the path params and appends the
// search string, marshaling custom-scalar values in both so the URL always carries their
// transport form. This is the one place params + search become a URL, shared by <Link>
// and goto so they behave identically. `route` provides the type info (undefined for an
// external href, which is returned untouched).
export function buildHref(
	to: string,
	route: RouteHrefInfo | undefined,
	scalars: Record<string, { marshal?: Marshaler } | undefined> | undefined,
	params?: Record<string, unknown>,
	search?: Record<string, unknown>
): string {
	let href =
		params != null ? resolveHref(to, params, scalarMarshalers(route?.params, scalars)) : to
	if (search != null) {
		href += serializeSearch(search, scalarMarshalers(route?.searchParams, scalars))
	}
	return href
}

export function resolveHref(
	href: string,
	params: Record<string, unknown>,
	marshalers?: Marshalers
): string {
	// renders a present param value through its marshaler, or undefined when absent
	const render = (key: string): string | undefined => {
		const val = params[key]
		if (val === undefined || val === null) {
			return undefined
		}
		return marshalValue(val, marshalers?.[key])
	}
	// optional [[param]] — strip the whole /[[param]] segment when the value is absent
	href = href.replace(/\/\[\[([^\]]+)\]\]/g, (_, key: string) => {
		const val = render(key)
		return val !== undefined ? '/' + val : ''
	})
	// rest [...slug] — substitute [..slug] with the value (or empty string when absent)
	href = href.replace(/\[\.\.\.([^\]]+)\]/g, (_, key: string) => render(key) ?? '')
	// regular [param]
	return href.replace(/\[([^\]]+)\]/g, (_, key: string) => render(key) ?? key)
}

// serializeSearch turns a search object into a query string (including the leading
// "?"), skipping null/undefined values and expanding arrays into repeated keys so
// they round-trip with List-typed query variables. A custom-scalar value is run
// through its marshaler so the URL holds the transport form. Returns "" when nothing
// is set.
export function serializeSearch(search: Record<string, unknown>, marshalers?: Marshalers): string {
	const params = new URLSearchParams()
	for (const [key, value] of Object.entries(search)) {
		if (value === null || value === undefined) {
			continue
		}
		const marshal = marshalers?.[key]
		if (Array.isArray(value)) {
			for (const entry of value) {
				if (entry !== null && entry !== undefined) {
					params.append(key, marshalValue(entry, marshal))
				}
			}
		} else {
			params.append(key, marshalValue(value, marshal))
		}
	}
	const str = params.toString()
	return str ? '?' + str : ''
}
