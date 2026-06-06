import { WebContainer } from '@webcontainer/api'
import type { DebugEntry } from './state'

let wc: WebContainer | null = null

export async function boot(
	tutorialId: string,
	onOutput: (chunk: string) => void,
	onServerReady: (url: string) => void,
	onDebug: (source: DebugEntry['source'], message: string) => void = () => {},
): Promise<WebContainer> {
	onDebug('boot', 'WebContainer.boot()')
	wc = await WebContainer.boot()
	onDebug('boot', 'WebContainer ready')

	onDebug('snapshot', `GET /snapshots/${tutorialId}.bin`)
	const res = await fetch(`/snapshots/${tutorialId}.bin`, { cache: 'reload' })
	onDebug('snapshot', `${res.status} ${res.statusText}, size: ${res.headers.get('content-length') ?? '?'} bytes`)
	await wc.mount(await res.arrayBuffer())
	onDebug('snapshot', 'mounted')

	let serverReadyFired = false
	wc.on('server-ready', (_port, url) => {
		if (serverReadyFired) { onDebug('wc', `server-ready again (ignored): ${url}`); return }
		serverReadyFired = true
		onServerReady(url)
	})
	wc.on('error', (err) => onDebug('wc', `error: ${err.message}`))

	return wc
}

export async function mountStepFiles(files: Record<string, string>, remove: string[] = []) {
	if (!wc) throw new Error('WebContainer not booted')

	for (const path of remove) {
		await wc.fs.rm(path, { force: true })
	}

	for (const [path, contents] of Object.entries(files)) {
		const dir = path.split('/').slice(0, -1).join('/')
		if (dir) await wc.fs.mkdir(dir, { recursive: true })
		await wc.fs.writeFile(path, contents)
	}
}

export async function writeFile(path: string, contents: string) {
	if (!wc) throw new Error('WebContainer not booted')
	const dir = path.split('/').slice(0, -1).join('/')
	if (dir) await wc.fs.mkdir(dir, { recursive: true })
	await wc.fs.writeFile(path, contents)
}

const SKIP_DIRS = new Set(['node_modules', '.git', '.npm', '.pnpm'])

export async function listFiles(dir = '/', result: string[] = []): Promise<string[]> {
	if (!wc) return result
	try {
		const entries = await wc.fs.readdir(dir, { withFileTypes: true })
		for (const entry of entries) {
			if (SKIP_DIRS.has(entry.name)) continue
			const full = `${dir === '/' ? '' : dir}/${entry.name}`
			if (entry.isDirectory()) {
				await listFiles(full, result)
			} else {
				// Strip the leading slash so paths are relative (e.g. "src/routes/+page.tsx")
				result.push(full.replace(/^\//, ''))
			}
		}
	} catch {}
	return result
}

export async function readWcFile(path: string): Promise<string> {
	if (!wc) throw new Error('WebContainer not booted')
	return wc.fs.readFile(path, 'utf-8')
}

export function getContainer(): WebContainer {
	if (!wc) throw new Error('WebContainer not booted')
	return wc
}

