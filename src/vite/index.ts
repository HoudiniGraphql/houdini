import type { Plugin } from 'vite'
import watch_and_run from '@kitql/vite-plugin-watch-and-run'
import path from 'path'
import houdini from './plugin'
import { Config } from '../common'
import schema from './schema'

export default function (config: Config): Plugin[] {
	return [
		houdini(config),
		schema(config),
		watch_and_run([
			{
				name: 'Houdini',
				watch: path.resolve(config.sourceGlob),
				run: 'npx houdini generate',
				delay: 100,
				watchKind: ['add', 'change', 'unlink'],
			},
			{
				name: 'Houdini',
				watch: path.resolve(config.filepath),
				run: 'npx houdini generate',
				delay: 100,
			},
			{
				name: 'Houdini',
				watch: path.resolve(config.schemaPath || ''),
				run: 'npx houdini generate',
				delay: 50,
			},
		]),
	]
}
