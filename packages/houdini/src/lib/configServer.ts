// our config server is a graphql api that makes the current config file available to
// plugins
import { createSchema, createYoga } from 'graphql-yoga'
import http from 'node:http'

import { Config } from './project'

const typeDefs = `
type Query {
  """Get the static configuration"""
  config: StaticConfig!

  """Get configuration for a specific plugin"""
  pluginConfig(name: String!): JSON
}

type Mutation {
	registerPort(input: RegisterPortInput!): Boolean
}

input RegisterPortInput {
	plugin: String!
	port: Int!
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

export function start_server(
	config: Config,
	env: Record<string, string>
): Promise<{
	close: () => void
	port: number
	wait_for_plugin: (name: string) => Promise<number>
}> {
	return new Promise((resolve, reject) => {
		// when plugins announce themselves, they provide a port
		const plugin_ports: Record<string, number> = {}
		const plugin_waiters: Record<string, Array<(port: number) => void>> = {}

		const wait_for_plugin = (name: string) =>
			new Promise<number>((resolve, reject) => {
				// if the plugin is already announced we're done
				if (name in plugin_ports) {
					return resolve(plugin_ports[name])
				}

				// Create a timeout that will reject after 2 seconds
				const timeout = setTimeout(() => {
					// Get the waiters array for this plugin
					const waiters = plugin_waiters[name] || []
					// Find and remove this specific waiter
					const index = waiters.findIndex((w) => w === resolver)
					if (index !== -1) {
						waiters.splice(index, 1)
					}
					// Clean up the waiters array if it's empty
					if (waiters.length === 0) {
						delete plugin_waiters[name]
					}
					reject(new Error(`Timeout waiting for plugin ${name} to register`))
				}, 2000)

				// Create a resolver function that clears the timeout
				const resolver = (port: number) => {
					clearTimeout(timeout)
					resolve(port)
				}

				// Add the waiter to the array of waiters for this plugin
				if (!plugin_waiters[name]) {
					plugin_waiters[name] = []
				}
				plugin_waiters[name].push(resolver)
			})

		// use yoga for the graphql server
		const yoga = createYoga({
			landingPage: false,
			graphqlEndpoint: '/',
			schema: createSchema({
				typeDefs,
				resolvers: {
					Mutation: {
						registerPort(
							_: any,
							{ input }: { input: { plugin: string; port: number } }
						) {
							// save the port in our mapping
							plugin_ports[input.plugin] = input.port

							// if we have any waiters, resolve all of them
							const waiters = plugin_waiters[input.plugin]
							if (waiters?.length > 0) {
								waiters.forEach((resolver) => resolver(input.port))
								// Clean up the waiters after resolving
								delete plugin_waiters[input.plugin]
							}
						},
					},
					Query: {
						config: async () => {
							return {
								include: config.config_file.include,
								exclude: config.config_file.exclude,

								schema: config.schema,

								scalars: !config.config_file.scalars
									? null
									: Object.fromEntries(
											Object.entries(config.config_file.scalars).map(
												([key, value]) => [key, value.type]
											)
									  ),

								definitionsPath: config.config_file.definitionsPath,

								// Module configuration
								module: config.config_file.module,

								// Cache configuration
								cacheBufferSize: config.config_file.cacheBufferSize,
								defaultCachePolicy: config.config_file.defaultCachePolicy,
								defaultPartial: config.config_file.defaultPartial,
								defaultLifetime: config.config_file.defaultLifetime,

								// List configuration
								defaultListPosition: config.config_file.defaultListPosition,
								defaultListTarget: config.config_file.defaultListTarget,

								// Pagination configuration
								defaultPaginateMode: config.config_file.defaultPaginateMode,
								suppressPaginationDeduplication:
									config.config_file.supressPaginationDeduplication,

								// Record ID configuration
								defaultKeys: config.config_file.defaultKeys,
								types: !config.config_file.types
									? null
									: Object.fromEntries(
											Object.entries(config.config_file.types).map(
												([key, value]) => [key, { keys: value.keys }]
											)
									  ),

								// Logging configuration
								logLevel: config.config_file.logLevel,

								// Fragment masking configuration
								defaultFragmentMasking:
									config.config_file.defaultFragmentMasking?.toUpperCase() ??
									'ENABLE',

								// Schema watching configuration
								watchSchema: !config.config_file.watchSchema
									? null
									: {
											url: config.config_file.watchSchema.url,
											headers: config.config_file.watchSchema.headers
												? typeof config.config_file.watchSchema.headers ===
												  'object'
													? config.config_file.watchSchema.headers
													: config.config_file.watchSchema.headers(env)
												: {},
											interval: config.config_file.watchSchema.interval,
											timeout: config.config_file.watchSchema.timeout,
									  },

								// Persisted queries configuration
								persistedQueriesPath: config.config_file.persistedQueriesPath,

								// Project paths
								projectRoot: config.root_dir,
								runtimeDir: config.config_file.runtimeDir,

								// Router configuration
								router: config.config_file.router,

								// Runtime scalar configuration
								runtimeScalars: !config.config_file.runtimeScalars
									? null
									: Object.fromEntries(
											Object.entries(config.config_file.runtimeScalars).map(
												([key, value]) => [key, { type: value.type }]
											)
									  ),
							}
						},
						pluginConfig: (_: any, { name }: { name: string }) => {
							// @ts-expect-error
							return config.plugins?.[name]
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
				resolve({
					close: () => server.close(),
					port: address.port,
					wait_for_plugin,
				})
			}
		})
	})
}
