import { type Adapter, fs, path } from 'houdini'
import { fileURLToPath } from 'node:url'

// the only thing we need to do for the cloudflare adapter is to copy the worker file
// to the dist directory
const adapter: Adapter = async ({ adapterPath, outDir }) => {
	// read the contents of the worker file
	let workerContents = (await fs.readFile(
		fileURLToPath(new URL('./worker.js', import.meta.url).href)
	))!

	// make sure that the adapter module imports from the correct path
	workerContents = workerContents.replaceAll('houdini/adapter', adapterPath)

	await fs.writeFile(path.join(outDir, '_worker.js'), workerContents!)
}

export default adapter
