import { usePersistedOperations } from '@graphql-yoga/plugin-persisted-operations'
import { logGreen } from '@kitql/helper'
import fs from 'fs-extra'
import { useServer } from 'graphql-ws/lib/use/ws'
import { createYoga, createSchema } from 'graphql-yoga'
import { createServer } from 'node:http'
import path from 'path'
import url from 'url'
import { WebSocketServer } from 'ws'

import { resolvers, typeDefs } from './graphql.mjs'

const plugins = []

// Turn on and off (to link with 'with_persisted_queries' of "./e2e/kit/src/client.ts")
let with_persisted_queries = false

let store = {}

// Let's load the persisted queries file directly, in case subscription want to use it.
try {
	const operationsFilePath = path.join(
		path.dirname(url.fileURLToPath(import.meta.url)),
		'../kit/$houdini/persisted_queries.json'
	)
	store = JSON.parse(fs.readFileSync(operationsFilePath, 'utf-8'))
} catch (error) {}

if (with_persisted_queries) {
	if (Object.keys(store).length === 0) {
		console.log(
			`❌ No persisted queries file "${operationsFilePath}" found (need to start frontend first)`
		)
	} else {
		console.log(`✅ persisted queries loaded`)
	}

	plugins.push(
		usePersistedOperations({
			getPersistedOperation(hash) {
				return store[hash]
			},
			extractPersistedOperationId(params) {
				return params.doc_id
			},
		})
	)
}

async function main() {
	const yogaApp = createYoga({
		hostname: '::',
		logging: true,
		schema: createSchema({
			typeDefs,
			resolvers,
		}),
		cors: {
			origin: ['*'],
			credentials: true,
			methods: ['POST'],
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

		plugins,
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
				// if it's a persisted query, use the stored document instead
				if (with_persisted_queries) {
					msg.payload.query = store[msg.payload.extensions.persistedQuery]
				}

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

	httpServer.prependOnceListener('error', (err) => {
		if (err.code === 'EADDRINUSE') {
			console.info(logGreen(` 🧐 Port 4000 is already in use.`))
			console.info(logGreen(` ✅ API probably started by another e2e test, It's all good.`))
			process.exit(0)
		}
	})

	httpServer.listen(4000, () => {
		console.info('Server is running on http://localhost:4000/graphql')
	})
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
