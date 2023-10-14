import { createServerAdapter } from 'houdini/adapter'
import { createServer } from 'node:http'

// create the production server adapter
const serverAdapter = createServerAdapter({
	production: true,
	assetPrefix: '/assets',
})

// wrap the server adapter in a node http server
const nodeServer = createServer(serverAdapter)

// start listening on the designated port
nodeServer.listen(process.env.PORT ?? 3000)
