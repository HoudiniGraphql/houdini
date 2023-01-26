import { useServer } from 'graphql-ws/lib/use/ws'
import { createYoga } from 'graphql-yoga'
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'

import { resolvers, typeDefs } from './graphql.mjs'

async function main() {
	const yogaApp = createYoga({
		hostname: '::',
		logging: true,
		schema: {
			typeDefs,
			resolvers,
		},
		maskedErrors: false,
		graphiql: {
			// Use WebSockets in GraphiQL
			subscriptionsProtocol: 'WS',
			defaultQuery: `
query List {
	usersList{
		id
		name
		birthDate
	}
}

mutation AddUser {
	addUser(name: "JYC", birthDate: 531747620000){
		id
	}
}
			`,
		},
	})

	// Get NodeJS Server from Yoga
	const httpServer = createServer(yogaApp)

	// Create WebSocket server instance from our Node server
	const wsServer = new WebSocketServer({
		server: httpServer,
		path: yogaApp.graphqlEndpoint,
	})

	// Integrate Yoga's Envelop instance and NodeJS server with graphql-ws
	useServer(
		{
			execute: (args) => args.rootValue.execute(args),
			subscribe: (args) => args.rootValue.subscribe(args),
			onSubscribe: async (ctx, msg) => {
				const { schema, execute, subscribe, contextFactory, parse, validate } =
					yogaApp.getEnveloped({
						...ctx,
						req: ctx.extra.request,
						socket: ctx.extra.socket,
						params: msg.payload,
					})

				const args = {
					schema,
					operationName: msg.payload.operationName,
					document: parse(msg.payload.query),
					variableValues: msg.payload.variables,
					contextValue: await contextFactory(),
					rootValue: {
						execute,
						subscribe,
					},
				}

				const errors = validate(args.schema, args.document)
				if (errors.length) {
					console.log(errors)
					return errors
				}
				return args
			},
		},
		wsServer
	)

	httpServer.listen(4000, () => {
		console.info('Server is running on http://localhost:4000/graphql')
	})
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
