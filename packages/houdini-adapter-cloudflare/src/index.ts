import { type Adapter, fs, path } from 'houdini'
import { fileURLToPath } from 'node:url'

const adapter: Adapter = async ({ adapterPath, outDir, sourceDir }) => {
	// the first thing we have to do is copy the source directory over
	await fs.recursiveCopy(sourceDir, path.join(outDir, 'assets'))

	// read the contents of the worker file
	let workerContents = (await fs.readFile(sourcePath('./worker.js')))!

	// make sure that the adapter module imports from the correct path
	workerContents = workerContents.replaceAll('houdini/adapter', adapterPath)

	await fs.writeFile(path.join(outDir, '_worker.js'), workerContents!)
}

export default adapter

function sourcePath(path: string) {
	return fileURLToPath(new URL(path, import.meta.url).href)
}
