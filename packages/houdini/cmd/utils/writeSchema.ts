import { getIntrospectionQuery } from 'graphql'
import fs from 'fs/promises'
import fetch from 'node-fetch'

export async function writeSchema(url: string, schemaPath: string) {
	// send the request
	const resp = await fetch(url, {
		method: 'POST',
		body: JSON.stringify({
			query: getIntrospectionQuery(),
		}),
		headers: { 'Content-Type': 'application/json' },
	})
	const content = await resp.text()

	try {
		// write the schema file
		await fs.writeFile(schemaPath, JSON.stringify(JSON.parse(content).data), 'utf-8')
	} catch (e) {
		console.log('encountered error parsing response as json: ' + e.message)
		console.log('full body: ' + content)
		process.exit(0)
	}
}
