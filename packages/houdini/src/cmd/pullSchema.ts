import * as path from '../lib/path'
import { get_config } from '../lib/project'
import { pull_schema } from '../lib/schema'

export default async function (args: { headers: string[]; output?: string }) {
	const config = await get_config()
	const apiURL = ''
	// Check if apiUrl is set in config
	if (!apiURL) {
		console.log(
			'❌ Your project does not have a remote endpoint configured. Please provide one with the `apiUrl` value in your houdini.config.js file.'
		)
		process.exit(1)
		return
	}

	// let headers = await config.pullHeaders()
	let headers = {}
	let headerStrings: string[] = []

	if (args.headers) {
		headerStrings = args.headers
	}
	if (headerStrings.length > 0) {
		headers = headerStrings.reduce((total, header) => {
			const [key, value] = header.split(/=(.*)/s)
			return {
				...total,
				[key]: value,
			}
		}, headers)
	}

	// the destination for the schema can come from the cli arguments, the config file, or a default
	const targetPath = args.output
		? path.resolve(args.output)
		: config.config_file.schemaPath ?? path.resolve(process.cwd(), 'schema.json')

	// Write the schema
	await pull_schema(apiURL, config.config_file.watchSchema?.timeout ?? 30000, targetPath, headers)
}
