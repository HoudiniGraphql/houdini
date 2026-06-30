import path from 'node:path'

// resolveAssetPath maps a request url to the file that should be served for it, or null if the
// request would escape the static assets directory (path traversal). Only files physically inside
// `<buildDir>/assets` may be web-served: a request like `/assets/../ssr/entries/adapter.js` (the
// SERVER bundle, which holds the session signing keys) or `/assets/../../etc/passwd` must be
// refused. path.join normalizes any `..`, so we confine the normalized result to the assets root.
export function resolveAssetPath(reqUrl: string | undefined, buildDir: string): string | null {
	const filePath = path.join(buildDir, reqUrl === '/' ? 'index.html' : (reqUrl ?? '/'))
	const assetsRoot = path.join(buildDir, 'assets')
	if (filePath !== assetsRoot && !filePath.startsWith(assetsRoot + path.sep)) {
		return null
	}
	return filePath
}
