import { cyan } from '@kitql/helpers'
import * as graphql from 'graphql'
import fetch from 'node-fetch'

import * as fs from './fs'

export async function pullSchema(
	url: string,
	fetchTimeout: number,
	schemaPath: string,
	headers?: Record<string, string>,
	writeToDisk: boolean = true
): Promise<string | null> {
	let content = ''
	try {
		// Fetch handler that will cancel the request after the provided timeout.
		// Code adopted from https://stackoverflow.com/questions/46946380/fetch-api-request-timeout/57888548#57888548
		const fetchWithTimeout = (
			url: string,
			timeoutMs: number,
			options: Parameters<typeof fetch>[1] // `RequestInit` is not working for some reason, so I'm using this hack
		): Promise<Response> => {
			const controller = new AbortController()

			const promise = fetch(url, {
				signal: controller.signal,
				...options,
			})

			const timeout = setTimeout(() => {
				controller.abort()
			}, timeoutMs)

			return promise
				.catch((err) => {
					if (err.type === 'aborted') {
						throw Error(
							`reached timeout of ${timeoutMs}ms. Make sure the API is available and tweak this timeout in your config if your API is slow to respond.`
						)
					} else {
						return err
					}
				})
				.finally(() => clearTimeout(timeout))
		}

		// send the request
		const resp = await fetchWithTimeout(url, fetchTimeout, {
			method: 'POST',
			body: JSON.stringify({
				query: graphql.getIntrospectionQuery(),
			}),
			headers: { 'Content-Type': 'application/json', ...headers },
		})
		content = await resp.text()

		const jsonSchema = JSON.parse(content).data
		let fileData = ''

		// Check if the schemapath ends with .gql or .graphql - if so write the schema as string
		// Otherwise write the json/introspection
		if (
			schemaPath!.endsWith('gql') ||
			schemaPath!.endsWith('graphql') ||
			schemaPath.endsWith('graphqls')
		) {
			const schema = graphql.buildClientSchema(jsonSchema)
			fileData = graphql.printSchema(graphql.lexicographicSortSchema(schema))
		} else {
			fileData = JSON.stringify(jsonSchema)
		}
		if (writeToDisk) {
			try {
				await fs.writeFile(schemaPath, fileData)
			} catch (e) {
				console.warn(
					`⚠️  Couldn't write your pulled schema to disk: ${(e as Error).message}
If this is expected, please set watchSchema.skipWriting to true in your config file.`
				)
			}
		}

		return fileData
	} catch (e) {
		if (content) {
			console.warn(
				`⚠️  Couldn't pull your schema.
${cyan('   Reponse:')} ${content}
${cyan('   Error  :')} ${(e as Error).message}`
			)
		} else {
			console.warn(`⚠️  Couldn't pull your schema: ${(e as Error).message}`)
		}
	}
	return null
}

export function extractHeadersStr(str: string | undefined) {
	const regex = /(\w+)=("[^"]*"|[^ ]*)/g
	const obj: Record<string, string> = {}

	let match
	while ((match = regex.exec(str ?? '')) !== null) {
		obj[match[1]] = match[2].replaceAll('"', '')
	}

	return obj
}

export function extractHeaders(headers?: string[] | undefined) {
	if ((headers ?? []).length > 0) {
		return headers!.reduce((total, header) => {
			const [key, value] = header.split(/=(.*)/s)

			return {
				...total,
				[key]: value.replaceAll('"', ''),
			}
		}, {})
	}
	return {}
}
