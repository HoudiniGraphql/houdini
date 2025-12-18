import { Cache } from 'houdini/runtime/cache'

import { getCurrentConfig } from './config'

export default new Cache(getCurrentConfig())
