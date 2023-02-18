import { ArtifactKind, RequestPayload } from '../../lib/types'
import { DataSource } from '../../lib/types'
import type { ClientPlugin, ClientPluginContext } from '../documentStore'

export const fetch = (target?: RequestHandler | string): ClientPlugin => {
	return () => {
		return {
			async network(ctx, { client, initialValue, resolve, marshalVariables }) {
				// there is no fetch for a fragment
				if (ctx.artifact.kind === ArtifactKind.Fragment) {
					return resolve(ctx, initialValue)
				}

				// figure out which fetch to use
				const fetch = ctx.fetch ?? globalThis.fetch

				// build up the params object
				const fetchParams: FetchParams = {
					text: ctx.text,
					hash: ctx.hash,
					variables: marshalVariables(ctx),
				}

				let fetchFn = defaultFetch(client.url, ctx.fetchParams)
				// the provided parameter either specifies the URL or is the entire function to
				// use
				if (target) {
					if (typeof target === 'string') {
						fetchFn = defaultFetch(target, ctx.fetchParams)
					} else {
						fetchFn = target
					}
				}

				const result = await fetchFn({
					// wrap the user's fetch function so we can identify SSR by checking
					// the response.url
					fetch: (url: URL | RequestInfo, args: RequestInit | undefined) => {
						// figure out if we need to do something special for multipart uploads
						const newArgs = handleMultipart(fetchParams, args) ?? args

						// use the new args if they exist, otherwise the old ones are good
						return fetch(url, newArgs)
					},
					metadata: ctx.metadata,
					session: ctx.session || {},
					...fetchParams,
				})

				// return the result
				resolve(ctx, {
					fetching: false,
					variables: ctx.variables ?? {},
					data: result.data,
					errors: !result.errors || result.errors.length === 0 ? null : result.errors,
					partial: false,
					stale: false,
					source: DataSource.Network,
				})
			},
		}
	}
}

const defaultFetch = (
	url: string,
	params?: Required<ClientPluginContext>['fetchParams']
): RequestHandler => {
	// if there is no configured url, we can't use this plugin
	if (!url) {
		throw new Error(
			'Could not find configured client url. Please specify one in your HoudiniClient constructor.'
		)
	}

	return async ({ fetch, text, variables }) => {
		// regular fetch (Server & Client)
		const result = await fetch(url, {
			method: 'POST',
			body: JSON.stringify({ query: text, variables }),
			...params,
			headers: {
				Accept: 'application/graphql+json, application/json',
				'Content-Type': 'application/json',
				...params?.headers,
			},
		})

		return await result.json()
	}
}

export type FetchContext = {
	fetch: typeof globalThis.fetch
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
	args: RequestInit | undefined
): RequestInit | undefined {
	// process any files that could be included
	const { clone, files } = extractFiles({
		query: params.text,
		variables: params.variables,
	})

	// if there are files in the request
	if (files.size) {
		const req = args
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

		return { ...req, headers, body: form as any }
	}
}

/// This file contains a modified version of the functions found here: https://github.com/jaydenseric/extract-files/blob/master/extractFiles.mjs
/// The associated license is at the end of the file (per the project's license agreement)

export function isExtractableFile(value: any): value is ExtractableFile {
	return (
		(typeof File !== 'undefined' && value instanceof File) ||
		(typeof Blob !== 'undefined' && value instanceof Blob)
	)
}

type ExtractableFile = File | Blob

/** @typedef {import("./isExtractableFile.mjs").default} isExtractableFile */

export function extractFiles(value: any) {
	if (!arguments.length) throw new TypeError('Argument 1 `value` is required.')

	/**
	 * Map of values recursed within the input value and their clones, for reusing
	 * clones of values that are referenced multiple times within the input value.
	 * @type {Map<Cloneable, Clone>}
	 */
	const clones = new Map()

	/**
	 * Extracted files and their object paths within the input value.
	 * @type {Extraction<Extractable>["files"]}
	 */
	const files = new Map()

	/**
	 * Recursively clones the value, extracting files.
	 */
	function recurse(value: any, path: string | string[], recursed: Set<any>) {
		if (isExtractableFile(value)) {
			const filePaths = files.get(value)

			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			filePaths ? filePaths.push(path) : files.set(value, [path])

			return null
		}

		const valueIsList =
			Array.isArray(value) || (typeof FileList !== 'undefined' && value instanceof FileList)
		const valueIsPlainObject = isPlainObject(value)

		if (valueIsList || valueIsPlainObject) {
			let clone = clones.get(value)

			const uncloned = !clone

			if (uncloned) {
				clone = valueIsList
					? []
					: // Replicate if the plain object is an `Object` instance.
					value instanceof /** @type {any} */ Object
					? {}
					: Object.create(null)

				clones.set(value, /** @type {Clone} */ clone)
			}

			if (!recursed.has(value)) {
				const pathPrefix = path ? `${path}.` : ''
				const recursedDeeper = new Set(recursed).add(value)

				if (valueIsList) {
					let index = 0

					// @ts-ignore
					for (const item of value) {
						const itemClone = recurse(item, pathPrefix + index++, recursedDeeper)

						if (uncloned) /** @type {Array<unknown>} */ clone.push(itemClone)
					}
				} else
					for (const key in value) {
						const propertyClone = recurse(value[key], pathPrefix + key, recursedDeeper)

						if (uncloned)
							/** @type {Record<PropertyKey, unknown>} */ clone[key] = propertyClone
					}
			}

			return clone
		}

		return value
	}

	return {
		clone: recurse(value, '', new Set()),
		files,
	}
}

/**
 * An extraction result.
 * @template [Extractable=unknown] Extractable file type.
 * @typedef {object} Extraction
 * @prop {unknown} clone Clone of the original value with extracted files
 *   recursively replaced with `null`.
 * @prop {Map<Extractable, Array<ObjectPath>>} files Extracted files and their
 *   object paths within the original value.
 */

/**
 * String notation for the path to a node in an object tree.
 * @typedef {string} ObjectPath
 * @see [`object-path` on npm](https://npm.im/object-path).
 * @example
 * An object path for object property `a`, array index `0`, object property `b`:
 *
 * ```
 * a.0.b
 * ```
 */

function isPlainObject(value: any) {
	if (typeof value !== 'object' || value === null) {
		return false
	}

	const prototype = Object.getPrototypeOf(value)
	return (
		(prototype === null ||
			prototype === Object.prototype ||
			Object.getPrototypeOf(prototype) === null) &&
		!(Symbol.toStringTag in value) &&
		!(Symbol.iterator in value)
	)
}

// MIT License
// Copyright Jayden Seric

// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
