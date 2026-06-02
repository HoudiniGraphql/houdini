import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plugin } from 'houdini/node'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

plugin({
	name: 'e2e-kit-node-plugin',
	order: 'after',
	hooks: {
		afterGenerate: () => {
			const outDir = resolve(projectRoot, 'src', 'routes', 'node-plugin')
			mkdirSync(outDir, { recursive: true })
			writeFileSync(
				resolve(outDir, 'plugin-artifact.ts'),
				`export const message = 'hello from the node plugin'\n`
			)
		},
	},
})
