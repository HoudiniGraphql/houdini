import sirv from 'sirv'
import polka from 'polka'
import compression from 'compression'
import * as sapper from '@sapper/server'
import { setEnvironment, Environment } from 'houdini'
import { graphql as executeSchema } from 'graphql'
import schema from './schema'

const { PORT, NODE_ENV } = process.env
const dev = NODE_ENV === 'development'

// configure the network layer for this application
setEnvironment(
	new Environment(async ({ text, variables = {} }) => {
		// usually this would require a network request but we're going to
		// use the schema directly here to avoid starting the server
		const { data, errors } = await executeSchema(schema, text, null, null, variables)

		// if there are errors
		if (errors) {
			throw new Error(errors.map(({ message }) => message).join('.'))
		}

		return { data }
	})
)

polka() // You can also use Express
	.use(
		compression({ threshold: 0 }),
		sirv('static', { dev }),
		sapper.middleware({
			session: (req, res) => ({
				apiURL: 'https://rickandmortyapi.com/graphql',
			}),
		})
	)
	.listen(PORT, (err) => {
		if (err) console.log('error', err)
	})
