const express = require('express')
const { ApolloServer } = require('apollo-server-express')
const ws = require('ws')
const { useServer } = require('graphql-ws/lib/use/ws')
const { execute, subscribe } = require('graphql')
const schema = require('./schema')

// create express
const app = express()

// create apollo server
const apolloServer = new ApolloServer({ schema })

// apply middleware
apolloServer.applyMiddleware({ app })

const server = app.listen(4000, () => {
	// create and use the websocket server
	const wsServer = new ws.Server({
		server,
		path: '/graphql',
	})

	useServer(
		{
			schema,
			execute,
			subscribe,
		},
		wsServer
	)

	console.log(`🚀 Server ready at http://localhost:4000`)
})
