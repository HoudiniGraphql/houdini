import React from 'react'

import client from './client'
import manifest from './manifest'
import { Router as RouterImpl } from './routing/router'

export function Router() {
	return <RouterImpl manifest={manifest} client={client} />
}
