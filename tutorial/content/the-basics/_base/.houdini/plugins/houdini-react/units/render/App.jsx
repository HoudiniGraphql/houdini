import { Router } from '$houdini/plugins/houdini-react/runtime'
import React from 'react'

import Shell from '../../../../../src/+index'

export default (props) => (
	<Shell>
		<Router {...props} />
	</Shell>
)
