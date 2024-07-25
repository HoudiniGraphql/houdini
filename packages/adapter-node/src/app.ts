import { createServerAdapter } from 'houdini/adapter'
import * as fs from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import path from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// create the production server adapter
const serverAdapter = createServerAdapter({
	production: true,
	assetPrefix: '/assets',
})

// wrap the server adapter in a node http server
const nodeServer = createServer((req, res) => {
	if (req.url && req.url.startsWith('/assets')) {
		return handleAssets(req, res)
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
	let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url ?? '/')
	let extname = path.extname(filePath)
	let contentType = 'text/html'

	// Determine the content type based on the file extension
	switch (extname) {
		case '.js':
			contentType = 'application/javascript'
			break
		case '.css':
			contentType = 'text/css'
			break
		case '.json':
			contentType = 'application/json'
			break
		case '.png':
			contentType = 'image/png'
			break
		case '.jpg':
			contentType = 'image/jpg'
			break
		case '.ico':
			contentType = 'image/x-icon'
			break
		default:
			contentType = 'text/html'
	}

	// Read the file from the file system
	fs.readFile(filePath, (error, content) => {
		if (error) {
			if (error.code === 'ENOENT') {
				// If the file is not found, return a 404
				fs.readFile(path.join(__dirname, '404.html'), (error, content) => {
					res.writeHead(404, { 'Content-Type': 'text/html' })
					res.end(content, 'utf8')
				})
			} else {
				// For any other errors, return a 500
				res.writeHead(500)
				res.end(`Server Error: ${error.code}`)
			}
		} else {
			// If the file is found, serve it
			res.writeHead(200, { 'Content-Type': contentType })
			res.end(content, 'utf8')
		}
	})
}
