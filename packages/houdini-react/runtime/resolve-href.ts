export function resolveHref(
	href: string,
	params: Record<string, string | number | boolean>
): string {
	// optional [[param]] — strip the whole /[[param]] segment when the value is absent
	href = href.replace(/\/\[\[([^\]]+)\]\]/g, (_, key: string) => {
		const val = params[key]
		return val !== undefined ? '/' + String(val) : ''
	})
	// rest [...slug] — substitute [..slug] with the value (or empty string when absent)
	href = href.replace(/\[\.\.\.([^\]]+)\]/g, (_, key: string) => String(params[key] ?? ''))
	// regular [param]
	return href.replace(/\[([^\]]+)\]/g, (_, key: string) => String(params[key] ?? key))
}

// serializeSearch turns a search object into a query string (including the leading
// "?"), skipping null/undefined values and expanding arrays into repeated keys so
// they round-trip with List-typed query variables. Returns "" when nothing is set.
export function serializeSearch(search: Record<string, unknown>): string {
	const params = new URLSearchParams()
	for (const [key, value] of Object.entries(search)) {
		if (value === null || value === undefined) {
			continue
		}
		if (Array.isArray(value)) {
			for (const entry of value) {
				if (entry !== null && entry !== undefined) {
					params.append(key, String(entry))
				}
			}
		} else {
			params.append(key, String(value))
		}
	}
	const str = params.toString()
	return str ? '?' + str : ''
}
