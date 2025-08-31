import { YogaServer } from 'graphql-yoga'
import {
  createServerAdapter, 
  ServerAdapterRequestHandler,
} from '@whatwg-node/server';

type YogaParams = Required<ConstructorParameters<typeof YogaServer>>[0]

type ConstructorParams = Omit<YogaParams, 'schema' | 'graphqlEndpoint'>

export class Server<
  ServerContext extends Record<string, any>,
  UserContext extends Record<string, any>,
> {
  opts: ConstructorParams

  _yoga: YogaServer<any, any> | null = null

  constructor(opts: ConstructorParams) {
    this.opts = opts
  }

  init({ endpoint, schema }: { schema: Required<YogaParams>['schema'], endpoint: string }) {
    this._yoga = new YogaServer({ 
      ...this.opts, 
      schema,
      graphqlEndpoint: endpoint,
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
