import type { RedirectTemplate } from './types.js'

/**
 * interpolateRedirect builds an @endpoint redirect URL from its parsed template and the
 * mutation result. Literal segments are emitted verbatim; interpolation paths are resolved
 * against the data and URL-encoded (closing the open-redirect hole at the value level, on
 * top of the compiler's build-time relative-path check).
 *
 * Returns `null` when any interpolation path resolves to null/undefined — the caller then
 * skips the redirect and falls back to PRG-back-to-the-page rather than navigating to
 * `/users/undefined`. Shared by the server form handler and the client form hook so both
 * paths produce the same target.
 */
export function interpolateRedirect(template: RedirectTemplate, data: any): string | null {
	let url = ''
	for (const part of template) {
		if (typeof part === 'string') {
			url += part
			continue
		}
		const value = valueAtPath(data, part)
		if (value === null || value === undefined) {
			return null
		}
		url += encodeURIComponent(String(value))
	}
	return url
}

// valueAtPath walks a dotted field path (as a segment array) into the result object.
function valueAtPath(data: any, path: readonly string[]): any {
	let cursor = data
	for (const key of path) {
		if (cursor == null) {
			return undefined
		}
		cursor = cursor[key]
	}
	return cursor
}
