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

// let with_persisted_queries = false
let with_persisted_queries = true

let store = {}
if (with_persisted_queries) {
	const operationsFilePath = path.join(
		path.dirname(url.fileURLToPath(import.meta.url)),
		'../kit/$houdini/persisted_queries.json'
	)
	try {
		store = JSON.parse(fs.readFileSync(operationsFilePath, 'utf-8'))
		console.log(`✅ persisted queries loaded`)
	} catch (error) {
		console.log(
			`❌ No persisted queries file "${operationsFilePath}" found (need to start frontend first)`
		)
	}
	plugins.push(
		usePersistedOperations({
			getPersistedOperation(hash) {
				return store[hash]
			},
			extractPersistedOperationId(params) {
				return params.doc_id
			},
			// allowArbitraryOperations: (request) => {
			// 	request.headers.get('x-allow-arbitrary-operations') === 'true'
			// },
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
					msg.payload.operationName = msg.payload.query
						.split(`{`)[0]
						.replace('subscription', '')
						.trim()
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
