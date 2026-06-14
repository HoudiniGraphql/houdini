export function resolveHref(href: string, params: Record<string, string | number | boolean>): string {
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
