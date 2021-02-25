import * as sapper from '@sapper/app'
import { setEnvironment } from '$houdini'
import env from './environment'

// configure the network layer for this application
setEnvironment(env)

sapper.start({
	target: document.querySelector('#sapper'),
})
