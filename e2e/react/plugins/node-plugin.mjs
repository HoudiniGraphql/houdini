import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runPlugin } from 'houdini/node'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

runPlugin({
	name: 'e2e-node-plugin',
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
