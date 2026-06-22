// Builds the HTTP body for a GraphQL operation. When the variables carry File/Blob values
// (e.g. from a progressively-enhanced form with a file input) it produces a
// multipart/form-data body per the GraphQL multipart request spec
// (https://github.com/jaydenseric/graphql-multipart-request-spec); otherwise a plain JSON
// body. Shared so the server form handler sends uploads exactly like the client does.

export type GraphQLBody =
	| { contentType: 'application/json'; body: string }
	// no contentType: the platform sets multipart/form-data + boundary from the FormData
	| { contentType?: undefined; body: FormData }

export function buildGraphQLBody(query: string, variables: Record<string, any>): GraphQLBody {
	// collect files and a clone with each file replaced by null (the spec wants null in
	// `operations` and the real file in a separate part, located via `map`)
	const files = new Map<Blob, string[]>()
	const operationVariables = extractFiles(variables, ['variables'], files)

	if (files.size === 0) {
		return { contentType: 'application/json', body: JSON.stringify({ query, variables }) }
	}

	const form = new FormData()
	form.set('operations', JSON.stringify({ query, variables: operationVariables }))

	const map: Record<string, string[]> = {}
	const parts: Array<[string, Blob]> = []
	let i = 0
	for (const [file, paths] of files) {
		const key = String(++i)
		map[key] = paths
		parts.push([key, file])
	}
	form.set('map', JSON.stringify(map))
	for (const [key, file] of parts) {
		form.set(key, file, (file as File).name)
	}

	return { body: form }
}

// extractFiles walks a value, returning a structural clone with every File/Blob replaced by
// null and recording each file's object paths (dot-joined, e.g. "variables.input.avatar")
// for the multipart `map`. A file referenced more than once collects all its paths.
function extractFiles(value: any, path: string[], files: Map<Blob, string[]>): any {
	if (isFile(value)) {
		const dotted = path.join('.')
		const existing = files.get(value)
		if (existing) {
			existing.push(dotted)
		} else {
			files.set(value, [dotted])
		}
		return null
	}
	if (Array.isArray(value)) {
		return value.map((entry, i) => extractFiles(entry, [...path, String(i)], files))
	}
	if (value && typeof value === 'object') {
		const clone: Record<string, any> = {}
		for (const key of Object.keys(value)) {
			clone[key] = extractFiles(value[key], [...path, key], files)
		}
		return clone
	}
	return value
}

function isFile(value: any): value is Blob {
	if (typeof Blob !== 'undefined' && value instanceof Blob) {
		return true
	}
	if (typeof File !== 'undefined' && value instanceof File) {
		return true
	}
	return false
}
