import { CollectedGraphQLDocument } from '../../types'

export default function pagination(
	doc: CollectedGraphQLDocument
): { preamble: string; types: string; methods: string; imports: string } {
	// figure out the extra methods and their types when there's pagination
	let methods = ''
	let types = ''
	let preamble = ''
	let imports = ''

	const paginationMethod = doc.refetch?.paginated && doc.refetch.method
	if (paginationMethod === 'offset') {
		types = offsetTypes
		methods = offsetMethods
		preamble = offsetPreamble
		imports = offsetImports
	} else if (paginationMethod === 'cursor') {
		preamble = cursorPreamble
		imports = cursorImports

		// only add the handlers to match the pagination direction
		if (doc.refetch?.direction === 'forward') {
			types = forwardCursorTypes
			methods = forwardCursorMethods
		} else {
			types = backwardsCursorTypes
			methods = backwardsCursorMethods
		}
	}

	return {
		preamble,
		types: types ? `& ${types}` : '',
		methods: methods ? `...{${methods}    }` : '',
		imports,
	}
}

// Offset Pagination

const offsetImports = `
import { countPage } from '../runtime/utils'
`

const offsetPreamble = `
    // we need to track the most recent offset for this handler
    let currentOffset = (artifact.refetch?.start as number) || 0
`

const offsetMethods = `
      loadPage: async (limit) => {
        // build up the variables to pass to the query
        const queryVariables = {
            ...variables,
            offset: currentOffset,
        }
        if (limit) {
            queryVariables.limit = limit
        }

        // if we made it this far without a limit argument and there's no default page size,
        // they made a mistake
        if (!queryVariables.limit && !artifact.refetch.pageSize) {
            throw new Error(
                'Loading a page with no page size. If you are paginating a field with a variable page size, ' +
                    \`you have to pass a value to loadNextPage. If you don't care to have the page size vary, \` +
                    'consider passing a fixed value to the field instead.'
            )
        }

        // set the loading state to true
        update(s => ({...s, isFetching: true}))

        // send the query
        const { result, partial: partialData } = await executeQuery(
            artifact,
            queryVariables,
            sessionStore,
            false
        )
        update(s => ({...s, partial: partialData}))

        // update cache with the result
        cache.write({
            selection: artifact.selection,
            data: result.data,
            variables: queryVariables,
            applyUpdates: true,
        })

        // add the page size to the offset so we load the next page next time
        const pageSize = queryVariables.limit || artifact.refetch.pageSize
        currentOffset += pageSize

        // we're not loading any more
        update(s => ({...s, isFetching: false}))
      },
`

const offsetTypes = `
    loadNextPage(limit?: number) => Promise<void>
`

// Cursor Pagination

const cursorImports = `
import { extractPageInfo, PageInfo, countPage } from '../runtime/utils'
import { executeQuery } from '../runtime/network'
`

const cursorPreamble = `
    // track the current page info in an easy-to-reach store
    const initialPageInfo = extractPageInfo(initialValue, artifact.refetch.path) ?? {
        startCursor: null,
        endCursor: null,
        hasNextPage: false,
        hasPreviousPage: false,
    }

    const pageInfo = writable<PageInfo>(initialPageInfo)

    // hold onto the current value
    subscribe((val) => {
        pageInfo.set(extractPageInfo(val.result.data, artifact.refetch.path))
    })

    // dry up the page-loading logic
    const loadPage = async ({
        pageSizeVar,
        input,
        functionName,
    }) => {
        // set the loading state to true
        update(s => ({...s, isFetching: true}))

        // build up the variables to pass to the query
        const queryVariables = {
            ...variables,
            ...input,
        }

        // if we don't have a value for the page size, tell the user
        if (!queryVariables[pageSizeVar] && !artifact.refetch.pageSize) {
            throw new Error(
                'Loading a page with no page size. If you are paginating a field with a variable page size, ' +
                    \`you have to pass a value to \${functionName}. If you don't care to have the page size vary, \` +
                    'consider passing a fixed value to the field instead.'
            )
        }

        // send the query
        const { result, partial: partialData } = await executeQuery(
            artifact,
            queryVariables,
            sessionStore,
            false
        )

        // keep the partial state up to date
        update(s => ({...s, partial: partialData}))

        // if the query is embedded in a node field (paginated fragments)
        // make sure we look down one more for the updated page info
        const resultPath = [...artifact.refetch.path]
        if (artifact.refetch.embedded) {
            const { targetType } = artifact.refetch
            // make sure we have a type config for the pagination target type
            if (!config.types?.[targetType]?.resolve) {
                throw new Error(
                    \`Missing type resolve configuration for \${targetType}. For more information, see https://www.houdinigraphql.com/guides/pagination#paginated-fragments\`
                )
            }

            // make sure that we pull the value out of the correct query field
            resultPath.unshift(config.types[targetType].resolve.queryField)
        }

        // we need to find the connection object holding the current page info
        pageInfo.set(extractPageInfo(result.data, resultPath))

        // updating cache with the result will update the store value
        cache.write({
            selection: artifact.selection,
            data: result.data,
            variables: queryVariables,
            applyUpdates: true,
        })

        // we're not loading any more
        update(s => ({...s, isFetching: false }))
    }
`

const forwardCursorMethods = `
      loadNextPage: (pageCount) => {
          const value = get({subscribe}).result.data

          // we need to find the connection object holding the current page info
          const currentPageInfo = extractPageInfo(value, artifact.refetch.path)

          // if there is no next page, we're done
          if (!currentPageInfo.hasNextPage) {
              return
          }

          // only specify the page count if we're given one
          const input = {
              after: currentPageInfo.endCursor,
          }
          if (pageCount) {
              input.first = pageCount
          }

          // load the page
          return loadPage({
              pageSizeVar: 'first',
              functionName: 'loadNextPage',
              input,
          })
      },
      pageInfo: { subscribe: pageInfo.subscribe },
`

const forwardCursorTypes = `{
    loadNextPage(pageCount?: number, after?: string | number): Promise<void>
    pageInfo: Readable<PageInfo>
}`

const backwardsCursorMethods = `
      loadPreviousPage: (pageCount) => {
          const value = get({subscribe}).result.data

          // we need to find the connection object holding the current page info
          const currentPageInfo = extractPageInfo(value, artifact.refetch.path)

          // if there is no next page, we're done
          if (!currentPageInfo.hasPreviousPage) {
              return
          }

          // only specify the page count if we're given one
          const input = {
              before: currentPageInfo.startCursor,
          }
          if (pageCount) {
              input.last = pageCount
          }

          // load the page
          return loadPage({
              pageSizeVar: 'last',
              functionName: 'loadPreviousPage',
              input,
          })
      },
      pageInfo: { subscribe: pageInfo.subscribe },
`

const backwardsCursorTypes = `{
    loadPreviousPage(pageCount?: number, before?: string): Promise<void>
    pageInfo: Readable<PageInfo>
}`
