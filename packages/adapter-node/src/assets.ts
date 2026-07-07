import path from 'node:path'

// normalize a request url into a decoded pathname: strip the query/hash and decode any
// percent-encoding (public files can have spaces or unicode in their names). returns null for
// malformed encodings so callers fail closed.
function pathname(reqUrl: string | undefined): string | null {
	const raw = (reqUrl ?? '/').split('?')[0].split('#')[0]
	try {
		return decodeURIComponent(raw)
	} catch {
		return null
	}
}

// resolveAssetPath maps a request url to the file that should be served for it, or null if the
// request would escape the static assets directory (path traversal). Only files physically inside
// `<buildDir>/assets` may be web-served: a request like `/assets/../ssr/entries/adapter.js` (the
// SERVER bundle, which holds the session signing keys) or `/assets/../../etc/passwd` must be
// refused. path.join normalizes any `..`, so we confine the normalized result to the assets root.
export function resolveAssetPath(reqUrl: string | undefined, buildDir: string): string | null {
	const url = pathname(reqUrl)
	if (url === null) {
		return null
	}
	const filePath = path.join(buildDir, url === '/' ? 'index.html' : url)
	const assetsRoot = path.join(buildDir, 'assets')
	if (filePath !== assetsRoot && !filePath.startsWith(assetsRoot + path.sep)) {
		return null
	}
	return filePath
}

// resolvePublicPath maps a request to a file copied from the project's public/ directory. Those
// files land at the ROOT of the build output, right next to the server bundle (ssr/, index.js),
// so we can't serve by existence check alone — only paths named in the manifest baked in at
// adapter time may be served, everything else fails closed to the router.
export function resolvePublicPath(
	reqUrl: string | undefined,
	buildDir: string,
	publicFiles: Set<string>
): string | null {
	const url = pathname(reqUrl)
	if (url === null || !publicFiles.has(url)) {
		return null
	}
	// the manifest entry came from walking public/ at build time, so joining it can't escape
	return path.join(buildDir, url)
}
