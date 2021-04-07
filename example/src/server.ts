import sirv from 'sirv'
import polka from 'polka'
import compression from 'compression'
import * as sapper from '@sapper/server'
import { setEnvironment } from '$houdini'
import env from './environment'

const { PORT, NODE_ENV } = process.env
const dev = NODE_ENV === 'development'

// configure the network layer for this application
setEnvironment(env)

polka() // You can also use Express
	.use(compression({ threshold: 0 }), sirv('static', { dev }), sapper.middleware())
	.listen(PORT, (err) => {
		if (err) console.log('error', err)
	})
