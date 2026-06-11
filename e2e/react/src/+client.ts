import { HoudiniClient } from '$houdini'

import devToolPlugin from '../plugins/devtool/plugin'

// Export the Houdini client
export default new HoudiniClient({
	plugins: [devToolPlugin],
})
