import { Config } from '../../../common'
import { ArtifactKind, CollectedGraphQLDocument } from '../../types'

export default function pagination(config: Config, doc: CollectedGraphQLDocument) {
	// figure out the extra methods and their types when there's pagination
	let methods = {}
	let types = ''
	let typeImports = !doc.refetch?.paginated
		? ''
		: `import type { PageInfo } from '../runtime/lib/utils'`

	// which functions we pull from the handlers depends on the pagination method
	// specified by the artifact
	const paginationMethod = doc.refetch?.paginated && doc.refetch.method

	// offset pagination
	if (paginationMethod === 'offset') {
		types = `
loadNextPage(limit?: number) => Promise<void>
    `
		methods = {
			loadNextPage: 'loadNextPage',
			fetch: 'refetch',
			loading: 'loading',
		}
	}
	// cursor pagination
	else if (paginationMethod === 'cursor') {
		// forwards cursor pagination
		if (doc.refetch?.direction === 'forward') {
			types = `{
    loadNextPage(pageCount?: number, after?: string | number): Promise<void>
    pageInfo: Readable<PageInfo>
}`
			methods = {
				loadNextPage: 'loadNextPage',
				pageInfo: 'pageInfo',
				fetch: 'refetch',
				loading: 'loading',
			}

			// backwards cursor pagination
		} else {
			types = `{
    loadPreviousPage(pageCount?: number, before?: string): Promise<void>
    pageInfo: Readable<PageInfo>
}`
			methods = {
				loadPreviousPage: 'loadPreviousPage',
				pageInfo: 'pageInfo',
				fetch: 'refetch',
				loading: 'loading',
			}
		}
	}

	return {
		types: types ? `& ${types}` : '',
		methods,
		typeImports,
	}
}
