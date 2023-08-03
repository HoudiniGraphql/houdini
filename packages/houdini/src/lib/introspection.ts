import { logCyan } from '@kitql/helper'
import * as graphql from 'graphql'
import fetch from 'node-fetch'

import * as fs from './fs'

export async function pullSchema(
	url: string,
	schemaPath: string,
	headers?: Record<string, string>
): Promise<boolean> {
	let content = ''
	try {
		// send the request
		const resp = await fetch(url, {
			method: 'POST',
			body: JSON.stringify({
				query: graphql.getIntrospectionQuery(),
			}),
			headers: { 'Content-Type': 'application/json', ...headers },
		})
		content = await resp.text()

		const jsonSchema = JSON.parse(content).data
		const schema = graphql.buildClientSchema(jsonSchema)

		// Check if the schemapath ends with .gql or .graphql - if so write the schema as string
		// Otherwise write the json/introspection
		if (schemaPath!.endsWith('gql') || schemaPath!.endsWith('graphql')) {
			const schemaAsString = graphql.printSchema(graphql.lexicographicSortSchema(schema))
			await fs.writeFile(schemaPath, schemaAsString)
		} else {
			await fs.writeFile(schemaPath, JSON.stringify(jsonSchema))
		}

		return true
	} catch (e) {
		if (content) {
			console.warn(
				`⚠️  Couldn't pull your schema.
${logCyan('   Reponse:')} ${content}
${logCyan('   Error  :')} ${(e as Error).message}`
			)
		} else {
			console.warn(`⚠️  Couldn't pull your schema: ${(e as Error).message}`)
		}
	}
	return false
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
