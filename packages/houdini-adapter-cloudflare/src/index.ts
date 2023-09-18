import { type Adapter, fs, path } from 'houdini'
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

	// if the project has a local schema, replace the schema import string with the
	// import
	workerContents = workerContents.replace(
		";('SCHEMA_IMPORT')",
		manifest.local_schema ? 'import schema from "../src/api/schema"' : 'const schema = null'
	)

	await fs.writeFile(path.join(outDir, '_worker.js'), workerContents!)
}

export default adapter

function sourcePath(path: string) {
	return fileURLToPath(new URL(path, import.meta.url).href)
}
