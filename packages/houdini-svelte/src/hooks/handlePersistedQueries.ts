import type { Handle } from '@sveltejs/kit'
import { readFileSync } from 'fs'
import path from 'node:path'

// import { fs, path } from 'houdini';

export type PersistedQueriesOptions = {
	/**
	 * your real endpoint url
	 */
	endpointUrl: string

	/**
	 * the local url of SvelteKit. You will need to set the same url in your HoudiniClient. (default: `/api/houdini/graphql`)
	 */
	localUrl?: string

	/**
	 * Path of the file holding all operations  (default: `./$houdini/persisted_queries.json`)
	 */
	operationsPath?: string
}

/**
 *
 * Basic Usage:
 *
 * ```js
 * import { sequence } from '@sveltejs/kit/hooks';
 * import { handlePersistedQueries } from '$houdini';
 *
 * export const handle = sequence(
 *   // Proxy requests through kit
 *   handlePersistedQueries({
 *     endpointUrl: 'http://localhost:4000/graphql'
 *   })
 * );
 * ```
 *
 * MultipartRequest are not supported yet.
 * Subscription is not supported.
 */
export const handlePersistedQueries = (options: PersistedQueriesOptions): Handle => {
	const { localUrl, operationsPath } = {
		localUrl: '/api/houdini/graphql',
		operationsPath: './$houdini/persisted_queries.json',
		...options,
	}

	const operationsFilePath = path.join(operationsPath)
	const store = JSON.parse(readFileSync(operationsFilePath, 'utf-8')!)

	return async ({ event, resolve }) => {
		if (event.url.pathname === localUrl) {
			let body = null
			if (
				event.request.headers.get('Content-Type') === 'application/json' ||
				event.request.headers.get('Content-Type') === 'application/graphql+json'
			) {
				const dataJson = await event.request.json()

				body = JSON.stringify({
					query: store[dataJson.doc_id],
					variables: dataJson.variables,
				})
				// update the content length
				event.request.headers.set('content-length', body?.length?.toString() ?? '')
			} else {
				// const formData = await event.request.formData();
				// const operationsFound = formData.get('operations');

				throw new Error('handlePersistedQueries: MultipartRequest are not supported yet.')
			}

			return event
				.fetch(
					new Request(options.endpointUrl, {
						body,
						method: event.request.method,
						headers: event.request.headers,
						// @ts-ignore
						duplex: 'half',
					})
				)
				.catch((err) => {
					console.log('handlePersistedQueries ERROR', err)
					throw err
				})
		}

		// Fallback to normal request
		return resolve(event)
	}
}
