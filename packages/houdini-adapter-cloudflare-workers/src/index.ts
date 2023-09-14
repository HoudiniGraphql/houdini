import { type Adapter, fs, path } from 'houdini'
import { fileURLToPath } from 'node:url'

const adapter: Adapter = async ({ config, conventions, publicBase, outDir, sourceDir }) => {
	// the first thing we have to do is copy the source directory over
	await fs.recursiveCopy(sourceDir, outDir)

	// read the contents of the worker file
	const workerContents = await fs.readFile(sourcePath('./app.js'))

	await fs.writeFile(path.join(outDir, 'index.js'), workerContents!)
}

export default adapter

function sourcePath(path: string) {
	return fileURLToPath(new URL(path, import.meta.url).href)
}
