import path from 'path'

import { ConfigFile } from '../runtime/lib'
import { testConfigFile } from '../runtime/lib/test'
import { Config } from './config'

export function testConfig(config: Partial<ConfigFile> = {}) {
	return new Config({
		filepath: path.join(process.cwd(), 'config.cjs'),
		...testConfigFile(config),
	})
}

type Partial<T> = {
	[P in keyof T]?: T[P]
}
export { testConfigFile } from '../runtime/lib/test'
