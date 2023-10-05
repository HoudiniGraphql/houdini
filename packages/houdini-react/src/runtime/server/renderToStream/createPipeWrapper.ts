import type { Writable as StreamNodeWritable } from 'stream'

import { createDebugger } from '../utils'
import { createBuffer, StreamOperations } from './createBuffer'
import { loadNodeStreamModule } from './loadNodeStreamModule'

export { createPipeWrapper }
export type { Pipe }

const debug = createDebugger('react-streaming:createPipeWrapper')

// `pipeFromReact` is the pipe provided by React
// `pipeForUser` is the pipe we give to the user will (the wrapper)
// `writableFromUser` is the writable provided by the user (i.e. `pipeForUser(writableFromUser)`), for example a Express.js's `res` writable stream.
// `writableForReact` is the writable that React directly writes to.
// Essentially: what React writes to `writableForReact` is piped to `writableFromUser`

type Pipe = (writable: StreamNodeWritable) => void

async function createPipeWrapper(
	pipeFromReact: Pipe,
	{ onReactBug }: { onReactBug: (err: unknown) => void }
) {
	const { Writable } = await loadNodeStreamModule()
	const { pipeForUser, streamEnd } = createPipeForUser()
	const streamOperations: StreamOperations = {
		operations: null,
	}
	const { injectToStream, onBeforeWrite, onBeforeEnd } = createBuffer(streamOperations)
	return { pipeForUser, streamEnd, injectToStream }

	function createPipeForUser(): { pipeForUser: Pipe; streamEnd: Promise<void> } {
		debug('createPipeForUser()')
		let onEnded!: () => void
		const streamEnd = new Promise<void>((r) => {
			onEnded = () => r()
		})
		const pipeForUser: Pipe = (writableFromUser: StreamNodeWritable) => {
			const writableForReact = new Writable({
				write(chunk: unknown, encoding, callback) {
					debug('write')
					onBeforeWrite(chunk)
					if (!writableFromUser.destroyed) {
						writableFromUser.write(chunk, encoding, callback)
					} else {
						// Destroying twice is fine: https://github.com/brillout/react-streaming/pull/21#issuecomment-1554517163
						writableForReact.destroy()
					}
				},
				final(callback) {
					debug('final')
					onBeforeEnd()
					writableFromUser.end()
					onEnded()
					callback()
				},
				destroy(err) {
					debug(`destroy (\`!!err === ${!!err}\`)`)
					// Upon React internal errors (i.e. React bugs), React destroys the stream.
					if (err) onReactBug(err)
					writableFromUser.destroy(err ?? undefined)
					onEnded()
				},
			})
			const flush = () => {
				if (typeof (writableFromUser as any).flush === 'function') {
					;(writableFromUser as any).flush()
					debug('stream flushed (Node.js Writable)')
				}
			}
			streamOperations.operations = {
				flush,
				writeChunk(chunk: unknown) {
					writableFromUser.write(chunk)
				},
			}
			// Forward the flush() call. E.g. used by React to flush GZIP buffers, see https://github.com/brillout/vite-plugin-ssr/issues/466#issuecomment-1269601710
			;(writableForReact as any).flush = flush
			pipeFromReact(writableForReact)
		}
		return { pipeForUser, streamEnd }
	}
}
