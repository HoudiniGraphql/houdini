import type { Plugin } from 'vite'
import watchAndRun from '@kitql/vite-plugin-watch-and-run'
import path from 'path'
import houdini from './plugin'
import { Config } from '../common'

export default function (houdini_config: Config): Plugin[] {
	return [
		houdini(houdini_config),
		watchAndRun([
			{
				name: 'Houdini',
				watch: path.resolve(houdini_config.sourceGlob),
				run: 'npm run generate',
				delay: 100,
				watchKind: ['ready', 'add', 'change', 'unlink'],
			},
			{
				name: 'Houdini',
				watch: path.resolve(houdini_config.filepath),
				run: 'npm run generate',
				delay: 100,
			},
		]),
	]
}
