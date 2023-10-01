import { type Adapter, fs, path } from 'houdini'
import { fileURLToPath } from 'node:url'

const adapter: Adapter = async ({ adapterPath, outDir, sourceDir }) => {
	// we want all of the assets in the assets directory
	const assetDir = path.join(outDir, 'assets')
	await fs.mkdirp(assetDir)

	// the first thing we have to do is copy the source directory over
	await fs.recursiveCopy(sourceDir, assetDir)

	// read the contents of the worker file
	let workerContents = (await fs.readFile(sourcePath('./worker.js')))!

	// if the project has a local schema, replace the schema import string with the
	// import
	workerContents = workerContents.replaceAll('houdini/adapter', './assets/' + adapterPath)
	const transformedPath = path.join(outDir, '_worker.js')

	await fs.writeFile(transformedPath, workerContents!)
}

export default adapter

function sourcePath(path: string) {
	return fileURLToPath(new URL(path, import.meta.url).href)
}
