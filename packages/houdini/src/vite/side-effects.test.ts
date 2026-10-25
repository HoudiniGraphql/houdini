import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build, type Plugin, type Rolldown } from 'vite'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { side_effect_free } from './side-effects.js'

let root: string

beforeAll(async () => {
	root = await fs.mkdtemp(path.join(os.tmpdir(), 'houdini-side-effects-'))

	// mirrors the generated stores: a barrel re-exporting one class per document, each
	// extending a base class from a module the bundler can't prove pure (the real store
	// runtime holds module state and reads config at import time), with two lazily
	// loaded routes that each use one store
	const files: Record<string, string> = {
		'base.js': `const config = globalThis.config
export class Store { constructor(opts) { this.opts = opts; this.config = config } }`,
		'artifacts/A.js': "export default { name: 'ArtifactA' }",
		'artifacts/B.js': "export default { name: 'ArtifactB' }",
		'stores/A.js': store('A'),
		'stores/B.js': store('B'),
		'stores/index.js': "export * from './A.js'\nexport * from './B.js'",
		'routeA.js':
			"import { AStore } from './stores/index.js'\nexport default () => new AStore()",
		'routeB.js':
			"import { BStore } from './stores/index.js'\nexport default () => new BStore()",
		'entry.js': "console.log([() => import('./routeA.js'), () => import('./routeB.js')])",
	}
	await Promise.all(
		Object.entries(files).map(async ([file, contents]) => {
			await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true })
			await fs.writeFile(path.join(root, file), contents)
		})
	)
})

afterAll(async () => {
	await fs.rm(root, { recursive: true, force: true })
})

function store(name: string) {
	return `import artifact from '../artifacts/${name}.js'
import { Store } from '../base.js'
export class ${name}Store extends Store { constructor() { super({ artifact }) } }`
}

// the names of the chunks each artifact ended up in
async function artifact_chunks(plugins: Array<Plugin>) {
	const { output } = (await build({
		root,
		configFile: false,
		logLevel: 'silent',
		plugins,
		build: { write: false, rollupOptions: { input: path.join(root, 'entry.js') } },
	})) as Rolldown.RolldownOutput
	const chunks = output.filter((c) => c.type === 'chunk')
	const containing = (marker: string) =>
		chunks.filter((c) => c.code.includes(marker)).map((c) => c.name)
	return { ArtifactA: containing('ArtifactA'), ArtifactB: containing('ArtifactB') }
}

test('without the hint, every artifact behind the barrel shares one chunk', async () => {
	const chunks = await artifact_chunks([])
	expect(chunks.ArtifactA).toHaveLength(1)
	expect(chunks.ArtifactB).toEqual(chunks.ArtifactA)
})

test('marking stores and artifacts side-effect free splits them per route', async () => {
	const chunks = await artifact_chunks([
		side_effect_free(path.join(root, 'stores')),
		side_effect_free(path.join(root, 'artifacts')),
	])
	expect(chunks).toEqual({ ArtifactA: ['routeA'], ArtifactB: ['routeB'] })
})
