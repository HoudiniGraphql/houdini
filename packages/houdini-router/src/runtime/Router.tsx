import React from 'react'

import client from './client'
import manifest from './manifest'
import { Router } from './routing/router'

export default () => {
	return <Router manifest={manifest} client={client} />
}
