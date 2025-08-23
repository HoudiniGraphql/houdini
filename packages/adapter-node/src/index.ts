import { type Adapter, fs, path } from 'houdini'
import { fileURLToPath } from 'node:url'

const adapter: Adapter = async ({ outDir, adapterPath }) => {
	// read the contents of the app file
	let serverContents = (await fs.readFile(
		fileURLToPath(new URL('./app.js', import.meta.url).href)
	))!

	// make sure that the adapter module imports from the correct path
	serverContents = serverContents.replaceAll('houdini/adapter', adapterPath + '.js')

	await fs.writeFile(path.join(outDir, 'index.js'), serverContents!)
}

export default adapter
