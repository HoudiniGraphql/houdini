import type { Readable as StreamNodeReadable, Writable as StreamNodeWritable } from 'stream'

export { loadNodeStreamModule }
export { nodeStreamModuleIsAvailable }

type StreamModule = {
	Readable: typeof StreamNodeReadable
	Writable: typeof StreamNodeWritable
}

async function loadNodeStreamModule(): Promise<StreamModule> {
	const streamModule = await loadModule()
	const { Readable, Writable } = streamModule
	return { Readable, Writable }
}
async function nodeStreamModuleIsAvailable(): Promise<boolean> {
	try {
		await loadModule()
		return true
	} catch (err) {
		return false
	}
}
function loadModule() {
	return import('stream') as Promise<StreamModule>
}
