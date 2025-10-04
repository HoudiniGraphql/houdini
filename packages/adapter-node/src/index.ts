import { fileURLToPath } from "node:url"
import { type Adapter, fs, path } from "houdini"

const adapter: Adapter = async ({ outDir, adapterPath }) => {
	// read the contents of the app file
	const serverContents = await fs.readFile(
		fileURLToPath(new URL("./app.js", import.meta.url).href),
	)

	if (!serverContents) {
		throw new Error("Failed to read app.js file")
	}

	// make sure that the adapter module imports from the correct path
	const updatedServerContents = serverContents.replaceAll(
		"houdini/adapter",
		`${adapterPath}.js`,
	)

	await fs.writeFile(path.join(outDir, "index.js"), updatedServerContents)
}

export default adapter
