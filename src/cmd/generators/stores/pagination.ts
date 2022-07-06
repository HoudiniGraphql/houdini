import { Config } from '../../../common'
import { CollectedGraphQLDocument } from '../../types'

export default function pagination(
	config: Config,
	doc: CollectedGraphQLDocument,
	which: 'fragment' | 'query'
) {
	// figure out the extra methods and their types when there's pagination
	let methods = {}
	let types = ''
	let typeImports = ''
	let storeExtras = '{}'

	// which functions we pull from the handlers depends on the pagination method
	// specified by the artifact
	const paginationMethod = doc.refetch?.paginated && doc.refetch.method

	// offset pagination
	if (paginationMethod === 'offset') {
		typeImports = `import { type HoudiniFetchContext } from '../runtime/lib/types`

		types = `{
	loadNextPage: (context: HoudiniFetchContext, limit?: number) => Promise<void>
}`
		methods = {
			loadNextPage: 'loadNextPage',
			fetch: 'refetch',
			loading: 'loading',
		}
	}
	// cursor pagination
	else if (paginationMethod === 'cursor') {
		typeImports = `import type { Readable } from 'svelte/store'
import { type HoudiniFetchContext } from '../runtime/lib/types'
import type { PageInfo } from '../runtime/lib/utils'`

		// regardless of direction, the store needs to have the most recent page info attached
		storeExtras = '{ pageInfo: PageInfo } '

		// forwards cursor pagination
		if (doc.refetch?.direction === 'forward') {
			types = `{
    loadNextPage: (context: HoudiniFetchContext, pageCount?: number, after?: string | number) => Promise<void>
    ${which === 'query' ? 'pageInfo: Readable<PageInfo>' : ''}
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
    loadPreviousPage: (context: HoudiniFetchContext, pageCount?: number, before?: string) => Promise<void>
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
		storeExtras,
	}
}
