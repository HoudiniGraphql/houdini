import { createServer } from '@graphql-yoga/node'
import { useServer } from 'graphql-ws/lib/use/ws'
import { WebSocketServer } from 'ws'

import { resolvers, typeDefs } from './graphql.mjs'

async function main() {
	const yogaApp = createServer({
		hostname: "::",
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
	const httpServer = await yogaApp.start()

	// Create WebSocket server instance from our Node server
	const wsServer = new WebSocketServer({
		server: httpServer,
		path: yogaApp.getAddressInfo().endpoint,
	})

	// Integrate Yoga's Envelop instance and NodeJS server with graphql-ws
	useServer(
		{
			execute: (args) => args.rootValue.execute(args),
			subscribe: (args) => args.rootValue.subscribe(args),
			onSubscribe: async (ctx, msg) => {
				// prettier-ignore
				const {
          schema,
          execute,
          subscribe,
          contextFactory,
          parse,
          validate
        } = yogaApp.getEnveloped(ctx);

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
				if (errors.length) return errors
				return args
			},
		},
		wsServer
	)
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
