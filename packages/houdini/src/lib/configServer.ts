// our config server is a graphql api that makes the current config file available to
// plugins
import { createSchema, createYoga } from 'graphql-yoga'
import http from 'node:http'

import { Config } from './config'

const typeDefs = `
type Query {
  """Get the static configuration"""
  config: StaticConfig!

  """Get configuration for a specific plugin"""
  pluginConfig(name: String!): JSON
}

"""
Type definitions for Houdini configuration system
"""

# Enums
enum ModuleType {
  ESM
  COMMONJS
}

enum ListPosition {
  APPEND
  PREPEND
}

enum ListTarget {
  ALL
  NULL
}

enum PaginateMode {
  INFINITE
  SINGLE_PAGE
}

enum LogLevel {
  QUIET
  FULL
  SUMMARY
  SHORT_SUMMARY
}

enum FragmentMasking {
  ENABLE
  DISABLE
}

type WatchSchemaConfig {
  url: String!
  headers: JSON
  interval: Int
}

type RouterConfig {
  options: JSON
}

type ScalarDefinition {
  typeName: String!
}

type TypeConfig {
  keys: [String!]!
}

type RuntimeScalar {
  type: String!
}

# Main Types
type StaticConfig {
  """Files to include in Houdini's processing"""
  include: [String!]!

  """Files to exclude from processing"""
  exclude: [String!]!

  """The schema of the project as specified by the introspection query"""
  schema: JSON!

  """Custom scalar definitions"""
  scalars: JSON

  """Path for internal fragment and directive definitions"""
  definitionsPath: String

  """Module type: ESM or CommonJS"""
  module: ModuleType

  """Cache configuration"""
  cacheBufferSize: Int
  defaultCachePolicy: String
  defaultPartial: Boolean
  defaultLifetime: Int

  """List configuration"""
  defaultListPosition: ListPosition
  defaultListTarget: ListTarget

  """Pagination configuration"""
  defaultPaginateMode: PaginateMode
  suppressPaginationDeduplication: Boolean

  """Record ID configuration"""
  defaultKeys: [String!]
  types: JSON

  """Logging configuration"""
  logLevel: LogLevel

  """Fragment masking configuration"""
  defaultFragmentMasking: FragmentMasking

  """Schema watching configuration"""
  watchSchema: WatchSchemaConfig

  """Persisted queries configuration"""
  persistedQueriesPath: String

  """Project paths"""
  projectRoot: String
  runtimeDir: String

  """Router configuration"""
  router: RouterConfig

  """Runtime scalar configuration"""
  runtimeScalars: RuntimeScalarDefinition
}

type RuntimeScalarDefinition {
  type: String!
}

"""
Custom scalar for handling JSON data
"""
scalar JSON
`

export function startServer(getConfig: () => Config): Promise<[http.Server, number]> {
	return new Promise((resolve, reject) => {
		// use yoga for the graphql server
		const yoga = createYoga({
			landingPage: false,
			graphqlEndpoint: '/',
			schema: createSchema({
				typeDefs,
				resolvers: {
					Query: {
						config: async () => {
							const config = getConfig()

							return {
								include: config.include,
								exclude: config.exclude,

								schema: config.schema,

								scalars: Object.fromEntries(
									Object.entries(config.scalars ?? {}).map(([key, value]) => [
										key,
										value.type,
									])
								),

								definitionsPath: config.definitionsDirectory,

								// Module configuration
								module: config.module,

								// Cache configuration
								cacheBufferSize: config.cacheBufferSize,
								defaultCachePolicy: config.defaultCachePolicy,
								defaultPartial: config.defaultPartial,
								defaultLifetime: config.configFile.defaultLifetime,

								// List configuration
								defaultListPosition: config.internalListPosition,
								defaultListTarget: config.defaultListTarget,

								// Pagination configuration
								defaultPaginateMode: config.defaultPaginateMode,
								suppressPaginationDeduplication:
									config.configFile.supressPaginationDeduplication,

								// Record ID configuration
								defaultKeys: config.defaultKeys,
								types: Object.fromEntries(
									Object.entries(config.configFile.types ?? {}).map(
										([key, value]) => [key, { keys: value.keys }]
									)
								),

								// Logging configuration
								logLevel: config.logLevel,

								// Fragment masking configuration
								defaultFragmentMasking: config.defaultFragmentMasking.toUpperCase(),

								// Schema watching configuration
								watchSchema: !config.configFile.watchSchema
									? {}
									: {
											url: config.configFile.watchSchema.url,
											headers: config.configFile.watchSchema.headers
												? typeof config.configFile.watchSchema.headers ===
												  'object'
													? config.configFile.watchSchema.headers
													: config.configFile.watchSchema.headers(
															await config.getEnv()
													  )
												: {},
											interval: config.configFile.watchSchema.interval,
											timeout: config.configFile.watchSchema.timeout,
									  },

								// Persisted queries configuration
								persistedQueriesPath: config.persistedQueriesPath,

								// Project paths
								projectRoot: config.projectRoot,
								runtimeDir: config.configFile.runtimeDir,

								// Router configuration
								router: config.configFile.router,

								// Runtime scalar configuration
								runtimeScalars: Object.fromEntries(
									Object.entries(config.configFile.runtimeScalars ?? {}).map(
										([key, value]) => [key, { type: value.type }]
									)
								),
							}
						},
						pluginConfig: (_: any, { name }: { name: string }) => {
							// @ts-expect-error
							return config.configFile.plugins?.[name]
						},
					},
				},
			}),
		})

		// wrap the yoga instance in an http server
		const server = http.createServer(yoga)

		server.listen(0, () => {
			const address = server.address()
			if (!address || typeof address === 'string') {
				reject(new Error('Failed to start server'))
			} else {
				resolve([server, address.port])
			}
		})
	})
}
