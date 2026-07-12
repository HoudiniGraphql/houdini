import { createServerAdapter } from 'houdini/adapter'
import { lookup } from 'mrmime'
import * as fs from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { resolveAssetPath, resolvePublicPath } from './assets.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// the adapter replaces this identifier with the list of files copied from the project's public/
// directory (see index.ts). they live at the root of the build output next to the server bundle,
// so serving anything outside this manifest would risk exposing ssr/ — fail closed.
declare const __HOUDINI_PUBLIC_FILES__: string[]
const publicFiles = new Set<string>(__HOUDINI_PUBLIC_FILES__)

// create the production server adapter
const serverAdapter = createServerAdapter({
	production: true,
	assetPrefix: '/assets',
})

// wrap the server adapter in a node http server
const nodeServer = createServer((req, res) => {
	if (req.url?.startsWith('/assets')) {
		return handleAssets(req, res)
	}

	// files from the project's public/ directory sit at the build root — serve any request
	// that names one of them (robots.txt, .well-known/..., etc.)
	const publicPath = resolvePublicPath(req.url, __dirname, publicFiles)
	if (publicPath !== null) {
		return serveFile(publicPath, res)
	}

	// if we got this far we can pass the request onto the server adapter
	serverAdapter(req, res)
})

const port = process.env.PORT ?? 3000

// start listening on the designated port
nodeServer.listen(port, () => {
	console.log(`Server is listening on port ${port} 🚀`)
})

function handleAssets(
	req: IncomingMessage,
	res: ServerResponse<IncomingMessage> & {
		req: IncomingMessage
	}
) {
	// confine the request to build/assets — a traversal like `/assets/../ssr/entries/adapter.js`
	// (the server bundle, which holds the session signing keys) or `/assets/../../etc/passwd` must
	// not be readable. resolveAssetPath returns null when the path would escape; fail closed.
	const filePath = resolveAssetPath(req.url, __dirname)
	if (filePath === null) {
		res.writeHead(404, { 'Content-Type': 'text/html' })
		res.end('Not found', 'utf8')
		return
	}

	serveFile(filePath, res)
}

function serveFile(filePath: string, res: ServerResponse<IncomingMessage>) {
	// Read the file from the file system
	fs.readFile(filePath, (error, content) => {
		if (error) {
			if (error.code === 'ENOENT') {
				// If the file is not found, return a 404
				fs.readFile(path.join(__dirname, '404.html'), (_error, content) => {
					res.writeHead(404, { 'Content-Type': 'text/html' })
					res.end(content, 'utf8')
				})
			} else {
				// For any other errors, return a 500
				res.writeHead(500)
				res.end(`Server Error: ${error.code}`)
			}
		} else {
			// If the file is found, serve it. binary types (fonts, images) must not go through
			// a utf8 re-encode, so hand the buffer over as-is.
			res.writeHead(200, {
				'Content-Type': lookup(filePath) ?? 'application/octet-stream',
			})
			res.end(content)
		}
	})
}
