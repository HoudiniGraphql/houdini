import * as sapper from '@sapper/app'
import { setEnvironment, Environment } from 'houdini'
import { graphql as executeSchema } from 'graphql'
import schema from './schema'

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

sapper.start({
	target: document.querySelector('#sapper'),
})
