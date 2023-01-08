import { RequestPayload, type SubscriptionSpec } from '../lib'
import { extractFiles } from '../lib/networkUtils'
import { type HoudiniMiddleware } from './networkMiddleware'

export const marshalInputsMiddleware: HoudiniMiddleware = function () {
	return {}
}

export const queryMiddleware: HoudiniMiddleware = function () {
	// track the bits of state we need to hold onto
	let lastVariables = null
	let subscriptionSpec: SubscriptionSpec | null = null

	// the function to call when a query is sent
	return {}
}

export const mutationMiddleware: HoudiniMiddleware = function () {
	return {}
}

export const subscriptionMiddleware: HoudiniMiddleware = function () {
	return {}
}

export const cachePolicyMiddleware: HoudiniMiddleware = function () {
	return {}
}

export const fetchMiddleware = (fetchFn: RequestHandler): HoudiniMiddleware => {
	return () => {
		return {
			phaseTwo: {
				async enter(ctx, { terminate }) {
					let url = ''

					// figure out which fetch to use
					const fetch = ctx.fetch ?? globalThis.fetch

					// build up the params object
					const fetchParams: FetchParams = {
						text: ctx.artifact.raw,
						hash: ctx.artifact.hash,
						variables: ctx.variables ?? {},
					}

					// invoke the function
					const result = await fetchFn({
						// wrap the user's fetch function so we can identify SSR by checking
						// the response.url
						fetch: async (...args: Parameters<FetchContext['fetch']>) => {
							// figure out if we need to do something special for multipart uploads
							const newArgs = handleMultipart(fetchParams, args)

							// use the new args if they exist, otherwise the old ones are good
							const response = await fetch(...(newArgs || args))
							if (response.url) {
								url = response.url
							}

							return response
						},
						...fetchParams,
						metadata: ctx.metadata,
						session: ctx.session || {},
					})

					// return the result
					terminate(ctx, result)
				},
			},
		}
	}
}

export type FetchContext = {
	fetch: typeof window.fetch
	metadata?: App.Metadata | null
	session: App.Session | null
}

/**
 * ## Tip 👇
 *
 * To define types for your metadata, create a file `src/app.d.ts` containing the followingI:
 *
 * ```ts
 * declare namespace App { *
 * 	interface Metadata {}
 * }
 * ```
 *
 */
export type RequestHandlerArgs = FetchContext & FetchParams

export type RequestHandler<_Data = any> = (
	args: RequestHandlerArgs
) => Promise<RequestPayload<_Data>>

export type FetchParams = {
	text: string
	hash: string
	variables: { [key: string]: any }
}

function handleMultipart(
	params: FetchParams,
	args: Parameters<FetchContext['fetch']>
): Parameters<FetchContext['fetch']> | undefined {
	// process any files that could be included
	const { clone, files } = extractFiles({
		query: params.text,
		variables: params.variables,
	})

	// if there are files in the request
	if (files.size) {
		const [url, req] = args
		let headers: Record<string, string> = {}

		// filters `content-type: application/json` if received by client.ts
		if (req?.headers) {
			const filtered = Object.entries(req?.headers).filter(([key, value]) => {
				return !(
					key.toLowerCase() == 'content-type' && value.toLowerCase() == 'application/json'
				)
			})
			headers = Object.fromEntries(filtered)
		}

		// See the GraphQL multipart request spec:
		// https://github.com/jaydenseric/graphql-multipart-request-spec
		const form = new FormData()
		const operationJSON = JSON.stringify(clone)

		form.set('operations', operationJSON)

		const map: Record<string, Array<string>> = {}

		let i = 0
		files.forEach((paths) => {
			map[++i] = paths
		})
		form.set('map', JSON.stringify(map))

		i = 0
		files.forEach((paths, file) => {
			form.set(`${++i}`, file as Blob, (file as File).name)
		})

		return [url, { ...req, headers, body: form as any }]
	}
}
