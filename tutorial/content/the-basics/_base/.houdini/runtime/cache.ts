import { Cache } from 'houdini/runtime/cache'

import { getCurrentConfig } from './config'

export type { Cache }
export default new Cache(getCurrentConfig())
