import { type Adapter } from 'houdini'
import { fileURLToPath } from 'node:url'

// in order to prepare the app as a single-page app, we have 2 create 2 additional files:
// - an index.js that imports the application and calls React.render. This file needs to be built by vite so it's passed with the includePaths option for an adapter
// - an index.html containing the static shell that wraps the application.
const adapter: Adapter = async () => {
	//
}

// make sure we include the app entry point in the bundle
adapter.includePaths = {
	app: fileURLToPath(new URL('./app.js', import.meta.url).href),
}

// we dont want any server artifacts to be generated
adapter.disableServer = true

export default adapter
