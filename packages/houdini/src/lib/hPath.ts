/**
 * Houdini join with forward slashes & taking care of OS paths
 */
export function hJoin(...path: string[]) {
	const fullPath = path.map((c) => c.replaceAll('\\', '/')).join('/')
	return fullPath.startsWith('/') ? fullPath : `file:///${fullPath}`
}
