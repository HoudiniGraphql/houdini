import { type Adapter, fs, path } from 'houdini'
import { fileURLToPath } from 'node:url'

const adapter: Adapter = async ({ outDir, adapterPath }) => {
	// read the contents of the app file
	let workerContents = (await fs.readFile(
		fileURLToPath(new URL('./app.js', import.meta.url).href)
	))!

	// make sure that the adapter module imports from the correct path
	workerContents = workerContents.replaceAll('houdini/adapter', adapterPath)

	await fs.writeFile(path.join(outDir, 'index.js'), workerContents!)
}

export default adapter
