import { useServer } from 'graphql-ws/lib/use/ws'
import { createYoga, createSchema } from 'graphql-yoga'
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'

import { resolvers, typeDefs } from './schema/index.mjs'

async function main() {
	const yogaApp = createYoga({
		schema: createSchema({
			typeDefs,
			resolvers,
		}),
		graphiql: {
			// Use WebSockets in GraphiQL
			subscriptionsProtocol: 'WS',
			defaultQuery: `
query Items {
	items{
		totalCount
		edges{
			node{
				id
				text
			}
		}
	}
}

mutation AddItem {
	addItem(input:{text: "coucou"}) {
		item {
			id
		}
	}
}

subscription SubToNewItem {
	newItem {
		item {
			id
			text
		}
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
					yogaApp.getEnveloped(ctx)

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

	httpServer.listen(4000, () => {
		console.info('Server is running on http://localhost:4000/graphql')
	})
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
