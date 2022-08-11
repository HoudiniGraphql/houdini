import path from 'path'

import { getConfig } from '../common'
import { pullSchema } from './utils'

export default async function (args: { headers: string[] }) {
	const config = await getConfig()

	// Check if apiUrl is set in config
	if (!config.apiUrl) {
		throw new Error(
			'❌ Your project does not have a remote endpoint configured. Please provide one with the `apiUrl` value in your houdini.config.js file.'
		)
	}

	// The target path -> current working directory by default. Should we allow passing custom paths?
	const targetPath = process.cwd()

	let headers = {}
	let headerStrings: string[] = []

	if (args.headers) {
		headerStrings = args.headers
	}
	if (headerStrings.length > 0) {
		headers = headerStrings.reduce((total, header) => {
			const [key, value] = header.split('=')
			return {
				...total,
				[key]: value,
			}
		}, {})
	}

	// Write the schema
	await pullSchema(
		config.apiUrl,
		config.schemaPath ? config.schemaPath : path.resolve(targetPath, 'schema.json'),
		headers
	)
}
