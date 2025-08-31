import { createServerAdapter, type ServerAdapterRequestHandler } from '@whatwg-node/server'
import { YogaServer } from 'graphql-yoga'
import type { YogaSchemaDefinition } from 'graphql-yoga/typings/plugins/use-schema'

type YogaParams = Required<ConstructorParameters<typeof YogaServer>>[0]

type ConstructorParams = Omit<YogaParams, 'schema' | 'graphqlEndpoint'>

export class Server<
	ServerContext extends Record<string, any>,
	UserContext extends Record<string, any>
> {
	opts: ConstructorParams

	_yoga: YogaServer<any, any> | null = null

	constructor(opts: ConstructorParams) {
		this.opts = opts
	}

	init({
		endpoint,
		schema,
		getSession,
	}: {
		schema: YogaSchemaDefinition<any>
		endpoint: string
		getSession: (request: Request) => Promise<UserContext>
	}) {
		this._yoga = new YogaServer({
			...this.opts,
			schema: schema,
			graphqlEndpoint: endpoint,
			context: async (ctx) => {
				const userContext =
					typeof this.opts.context === 'function'
						? await this.opts.context(ctx)
						: this.opts.context || {}
				const sessionContext = (await getSession(ctx.request)) || {}
				return {
					...userContext,
					session: sessionContext,
				} as UserContext & ServerContext
			},
		})

		return createServerAdapter<ServerContext, Server<ServerContext, UserContext>>(this, {
			fetchAPI: this._yoga!.fetchAPI,
			plugins: this._yoga!['plugins'],
		})
	}

	handle: ServerAdapterRequestHandler<ServerContext> = (
		request: Request,
		serverContext: ServerContext
	) => {
		return this._yoga!.handle(request, serverContext)
	}
}
