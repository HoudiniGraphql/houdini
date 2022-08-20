import path from 'path'

import { Config, LogLevel } from '../common'
import { ConfigFile } from '../runtime'
import { testConfigFile } from '../runtime/lib/test'

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
