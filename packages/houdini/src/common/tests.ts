import path from 'path'

import { Config } from '.'
import { ConfigFile } from '../../houdini-svelte/runtime'
import { testConfigFile } from '../../houdini-svelte/runtime/lib/test'

export function testConfig(config: Partial<ConfigFile> = {}) {
	return new Config({
		filepath: path.join(process.cwd(), 'config.cjs'),
		...testConfigFile(config),
	})
}

type Partial<T> = {
	[P in keyof T]?: T[P]
}
export { testConfigFile } from '../../houdini-svelte/runtime/lib/test'
