// Diagnostics for the "Premature close" failures in `changeset version`.
//
// Preloaded (via `node --require`) before @changesets/get-github-info loads
// node-fetch, so we can wrap node-fetch and log the HTTP status + response
// headers GitHub returns. The failure surfaces as "Premature close" at the
// `.json()` body read, which hides whether GitHub actually sent an error
// (502 / 429 / auth) or severed a healthy 200 response mid-body. Logging the
// status + headers (which arrive before the body) tells us which.
//
// We only read status/headers and never touch the body, so this cannot change
// the timing or outcome of the real request. Response headers contain no
// secrets (the Authorization request header is never logged). Enabled in CI via
// HOUDINI_CHANGESET_DIAGNOSTICS; off by default so local runs stay quiet.

const Module = require('module')

const origLoad = Module._load
Module._load = function (request, parent, isMain) {
	const loaded = origLoad.apply(this, arguments)
	if (request !== 'node-fetch') {
		return loaded
	}

	// node-fetch v2's module.exports IS the fetch function (with `.default`,
	// `Headers`, `Request`, etc. hung off it for interop / named imports).
	const realFetch = loaded.default || loaded
	if (realFetch.__houdiniWrapped) {
		return loaded
	}

	const wrapped = async function (url, opts) {
		const method = (opts && opts.method) || 'GET'
		const startedAt = Date.now()
		let res
		try {
			res = await realFetch(url, opts)
		} catch (e) {
			console.error(`[changeset-fetch] ${method} ${url} threw before a response arrived: ${e.message}`)
			throw e
		}

		const headers = {}
		res.headers.forEach((value, key) => {
			headers[key] = value
		})
		console.error(
			`[changeset-fetch] ${method} ${url} -> ${res.status} ${res.statusText} (${Date.now() - startedAt}ms before body)`
		)
		console.error(`[changeset-fetch] response headers: ${JSON.stringify(headers)}`)
		return res
	}
	wrapped.__houdiniWrapped = true

	// Preserve the module's shape so both `fetch(...)` and `fetch.default(...)`
	// call styles, plus named imports (Headers/Request/Response), keep working.
	Object.assign(wrapped, realFetch)
	wrapped.default = wrapped
	return wrapped
}
