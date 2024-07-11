import { getConfig, pullSchema, path } from '../lib'

export default async function (args: { headers: string[]; output?: string }) {
	const config = await getConfig({ noSchema: true })
	const apiURL = await config.apiURL()
	// Check if apiUrl is set in config
	if (!apiURL) {
		console.log(
			'❌ Your project does not have a remote endpoint configured. Please provide one with the `apiUrl` value in your houdini.config.js file.'
		)
		process.exit(1)
		return
	}

	let headers = await config.pullHeaders()
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
		: config.schemaPath ?? path.resolve(process.cwd(), 'schema.json')

	// Write the schema
	await pullSchema(apiURL, config.schemaPollTimeout, targetPath, headers)
}
