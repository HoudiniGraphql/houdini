import { Config } from '../../../common'
import { ArtifactKind, CollectedGraphQLDocument } from '../../types'

export default function pagination(config: Config, doc: CollectedGraphQLDocument) {
	// figure out the extra methods and their types when there's pagination
	let methods = ''
	let types = ''
	let preamble = ''
	let imports = ''

	// if the document points to a fragment, we will need to import the pagination artifact
	if (doc.kind === ArtifactKind.Fragment) {
		// make sure that we import the pagination artifact
		// and the fragment handlers
		imports = `import _PaginationArtifact from '${config.artifactImportPath(
			config.paginationQueryName(doc.name)
		)}'
import { fragmentHandlers } from '../runtime/pagination'
`

		// create the handlers we'll use for paginating the fragment
		preamble = `
const handlers = fragmentHandlers({
    config: houdiniConfig,
    paginationArtifact: _PaginationArtifact.default || _PaginationArtifact,
    initialValue,
    store: fragmentStore,
})
`
	} else if (doc.kind === ArtifactKind.Query) {
		// make sure we import the handler util
		imports = `import { queryHandlers } from '../runtime/pagination'
`

		// create the query handlers
		preamble = `
    const handlers = queryHandlers({
        config: houdiniConfig,
        artifact,
        store: { subscribe },
        queryVariables: () => variables 
    })
        `
	}

	// which functions we pull from the handlers depends on the pagination method
	// specified by the artifact
	const paginationMethod = doc.refetch?.paginated && doc.refetch.method

	// offset pagination
	if (paginationMethod === 'offset') {
		types = `
loadNextPage(limit?: number) => Promise<void>
    `
		methods = `
        loadNextPage: handlers.loadNextPage,
        query: handlers.refetch,
        loading: handlers.loading,
`
	}
	// cursor pagination
	else if (paginationMethod === 'cursor') {
		// forwards cursor pagination
		if (doc.refetch?.direction === 'forward') {
			types = `{
    loadNextPage(pageCount?: number, after?: string | number): Promise<void>
    pageInfo: Readable<PageInfo>
}`
			methods = `
        loadNextPage: handlers.loadNextPage,
        pageInfo: handlers.pageInfo,
        query: handlers.refetch,
        loading: handlers.loading,
`

			// backwards cursor pagination
		} else {
			types = `{
    loadPreviousPage(pageCount?: number, before?: string): Promise<void>
    pageInfo: Readable<PageInfo>
}`
			methods = `
loadPreviousPage: handlers.loadPreviousPage,
pageInfo: handlers.pageInfo,
query: handlers.refetch,
loading: handlers.loading,
`
		}
	}

	return {
		preamble,
		types: types ? `& ${types}` : '',
		methods: methods ? `...{${methods.replaceAll('\n', '\n    ')}    }` : '',
		imports,
	}
}
