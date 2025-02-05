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
	registerPlugin(input: RegisterPluginInput!): Boolean
}

enum PluginHook {
	Init
	ExtractDocuments
	Config
	AfterLoad
	Environment
	Schema
	BeforeValidate
	Validate
	AfterValidate
	BeforeGenerate
	Generate
	AfterGenerate
	ClientPlugins
	TransformFile
}

input RegisterPluginInput {
	plugin: String!
	port: Int!
	order: String!
	hooks: [PluginHook!]!
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

export type PluginSpec = {
	port: number
	hooks: Set<string>
	order: 'before' | 'after' | 'core'
}

export type ConfigServer = {
	close: () => void
	port: number
	wait_for_plugin: (name: string) => Promise<PluginSpec>
	load_env: (mode: string) => Promise<Record<string, string>>
	trigger_hook: (plugin_name: string, payload?: Record<string, any>) => Promise<any>
	invoke_plugin_endpoint: (
		plugin_name: string,
		hook: string,
		payload: Record<string, any>
	) => Promise<any>
}

export function start_server(config: Config, env: Record<string, string>): Promise<ConfigServer> {
	return new Promise((resolve, reject) => {
		// when plugins announce themselves, they provide a port
		const plugin_specs: Record<string, PluginSpec> = {}
		const plugin_waiters: Record<string, Array<(spec: PluginSpec) => void>> = {}

		const wait_for_plugin = (name: string) =>
			new Promise<PluginSpec>((resolve, reject) => {
				// if the plugin is already announced we're done
				if (name in plugin_specs) {
					return resolve(plugin_specs[name])
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
				}, 10000)

				// Create a resolver function that clears the timeout
				const resolver = (spec: PluginSpec) => {
					clearTimeout(timeout)
					resolve(spec)
				}

				// Add the waiter to the array of waiters for this plugin
				if (!plugin_waiters[name]) {
					plugin_waiters[name] = []
				}
				plugin_waiters[name].push(resolver)
			})

		// a function to invoke the corresponding endpoint in a plugin
		const invoke_hook = async (name: string, hook: string, payload: Record<string, any>) => {
			// make sure the plugin is loaded
			const { port } = await wait_for_plugin(name)

			// make the request
			const response = await fetch(`http://localhost:${port}/${hook.toLowerCase()}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			})

			// if the request failed, throw an error
			if (!response.ok) {
				if (response.status === 404) {
					throw new Error(`Plugin ${name} does not support hook ${hook}`)
				}
				throw new Error(
					`Failed to call ${name}/${hook.toLowerCase()}: ${await response.text()}`
				)
			}

			// parse the response
			const text = await response.text()
			if (text) {
				return JSON.parse(text)
			}
			return text
		}

		const trigger_hook = async (hook: string, payload: Record<string, any> = {}) => {
			for (const [name, { hooks }] of Object.entries(plugin_specs)) {
				if (hooks.has(hook)) {
					await invoke_hook(name, hook, payload)
				}
			}
		}

		// a function to call that loads the environment variables from each plugin
		const load_env = async (mode: string) => {
			// to do this we need to look at each plugin that supports the environment hook
			// and invoke it
			const env = {}

			// look at each plugin
			await Promise.all(
				config.plugins.map(async (plugin) => {
					// wait for the plugin to load
					const { hooks } = await wait_for_plugin(plugin.name)
					if (hooks.has('Environment')) {
						// we need to hit the corresponding endpoint in the plugin server
						Object.assign(env, await invoke_hook(plugin.name, 'environment', { mode }))
					}
				})
			)

			return env
		}

		// use yoga for the graphql server
		const yoga = createYoga({
			landingPage: false,
			graphqlEndpoint: '/',
			schema: createSchema({
				typeDefs,
				resolvers: {
					Mutation: {
						registerPlugin(
							_: any,
							{
								input,
							}: {
								input: {
									plugin: string
									port: number
									hooks: Array<string>
									order: PluginSpec['order']
								}
							}
						) {
							// save the port in our mapping
							plugin_specs[input.plugin] = {
								port: input.port,
								hooks: new Set(input.hooks),
								order: input.order,
							}

							// if we have any waiters, resolve all of them
							const waiters = plugin_waiters[input.plugin]
							if (waiters?.length > 0) {
								waiters.forEach((resolver) => resolver(plugin_specs[input.plugin]))
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
					load_env,
					invoke_plugin_endpoint: invoke_hook,
					trigger_hook,
				})
			}
		})
	})
}
