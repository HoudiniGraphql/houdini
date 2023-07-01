// this file defines the compatibility layer between the vite dev server and houdini's
// server infrastrcture
import { Config } from 'houdini'
import { Connect } from 'vite'

import type { Server, ServerMiddleware } from '.'

// wrap vite's dev server in something our handlers can integrate with
export function dev_server({ server, config }: { server: Connect.Server; config: Config }): Server {
	return {
		use(fn: ServerMiddleware) {
			server.use((req, res, next) => {
				fn(
					{
						url: req.url,
						headers: new Headers(req.headers as Record<string, string>),
					},
					{
						...res,
						redirect(url: string, status: number = 307) {
							// Respond with a redirect
							res.statusCode = status
							res.setHeader('location', url)
							res.setHeader('content-length', '0')

							// dont call next
							return res.end()
						},
						set_header: res.setHeader.bind(res),
					},
					next
				)
			})
		},
	}
}
