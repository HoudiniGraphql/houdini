import { type Adapter, fs, path, localApiEndpoint } from 'houdini'
import { fileURLToPath } from 'node:url'

const adapter: Adapter = async ({
	config,
	conventions,
	publicBase,
	outDir,
	sourceDir,
	manifest,
}) => {
	// the first thing we have to do is copy the source directory over
	await fs.recursiveCopy(sourceDir, outDir)

	// read the contents of the worker file
	let workerContents = (await fs.readFile(sourcePath('./worker.js')))!

	// start off with the base case
	let dynamicContent = `
		const schema = null
		const yoga = null

		const graphqlEndpoint = ${JSON.stringify(localApiEndpoint(config.configFile))}
	`

	// if the wants a custom yoga instance
	if (manifest.local_yoga) {
		dynamicContent = `
			import schema from '../src/api/+schema'
			import yoga from '../src/api/+yoga'

			const graphqlEndpoint = ${JSON.stringify(localApiEndpoint(config.configFile))}
		`
	}
	// we could just have a local schema defined without a custom yoga wrapper
	else if (manifest.local_schema) {
		dynamicContent = `
			import schema from '../src/api/+schema'

			const graphqlEndpoint = ${JSON.stringify(localApiEndpoint(config.configFile))}
			const yoga = null
		`
	}

	// if the project has a local schema, replace the schema import string with the
	// import
	workerContents = workerContents.replaceAll('console.log("DYNAMIC_CONTENT")', dynamicContent)

	await fs.writeFile(path.join(outDir, '_worker.js'), workerContents!)
}

export default adapter

function sourcePath(path: string) {
	return fileURLToPath(new URL(path, import.meta.url).href)
}
