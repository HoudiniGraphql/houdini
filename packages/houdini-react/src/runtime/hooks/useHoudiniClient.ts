import type { HoudiniClient } from '$houdini/runtime/client'
import * as React from 'react'

import { HoudiniContext } from '../context'

export function useHoudiniClient(): HoudiniClient {
	const client = React.useContext(HoudiniContext)
	if (!client) {
		throw new Error('Could not find client')
	}

	return client
}
