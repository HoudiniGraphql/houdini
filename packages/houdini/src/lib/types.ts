import type graphql from 'graphql'
import type * as recast from 'recast'
import type {
	CustomPluginOptions,
	LoadResult,
	ObjectHook,
	PluginContext,
	ResolveIdResult,
} from 'rollup'

import type { ConfigFile } from '../runtime/lib/config'
import type { ArtifactKind, BaseCompiledDocument } from '../runtime/lib/types'
import type { TransformPage } from '../vite/houdini'
import type { Config } from './config'

type Program = recast.types.namedTypes.Program

export type Maybe<T> = T | null | undefined

export type Script = Program

export type TransformDocument = {
	instance: Maybe<Script>
	config: Config
	dependencies: string[]
	filename: string
}

// the result of collecting documents from source code
export type CollectedGraphQLDocument = {
	kind: ArtifactKind
	filename: string
	name: string
	document: graphql.DocumentNode
	originalDocument: graphql.DocumentNode
	generateArtifact: boolean
	generateStore: boolean
	originalString: string
	refetch?: BaseCompiledDocument['refetch']
}

export enum LogLevel {
	Full = 'full',
	Summary = 'summary',
	ShortSummary = 'short-summary',
	Quiet = 'quiet',
}

export type Plugin = (args?: PluginConfig) => Promise<PluginHooks | PluginHooks[] | null | false>

export type PluginHooks = {
	/**
	 * The name of the plugin. Must match the package name for external plugins.
	 * For local plugins, this value should equal the relative path from your config file
	 * to this file.
	 */
	name: string

	/**
	 * Specify the priority for the hook. The order is before -> core -> after.
	 * @default 'before'
	 */
	order?: 'before' | 'after' | 'core'

	/**
	 * Add extensions to the list that houdini uses to find valid source files
	 */
	extensions?: string[]

	/**
	 * A relative path from the file exporting your plugin to a runtime that will be
	 * automatically included with your
	 */

	include_runtime?: string | { esm: string; commonjs: string }
	/**
	 * Transform the plugin's runtime while houdini is copying it .
	 * You must have passed a value to include_runtime for this hook to matter.
	 */
	transform_runtime?: Record<string, (args: { config: Config; content: string }) => string>

	/**
	 * Used to modify any values that the user passed to their config files. Configuration values
	 * that you return will be deeply merged with the previous value.
	 */
	config?: (old: ConfigFile) => ConfigFile | Promise<ConfigFile>

	/**
	 *
	 * Add environment variables to houdini's pipeline (ie, for schema polling headers, url, etc.)
	 */
	env?: (args: { env: any; config: Config }) => Promise<Record<string, string>>

	/**
	 * Invoked after all plugins have loaded and modified config values.
	 */
	after_load?: (config: Config) => Promise<void> | void
	artifact_data?: (config: Config, doc: CollectedGraphQLDocument) => Record<string, any>
	extract_documents?: (
		config: Config,
		filepath: string,
		content: string
	) => Promise<string[]> | string[]
	generate?: GenerateHook
	client_plugins?:
		| Record<string, null | Record<string, any>>
		| ((config: ConfigFile, pluginConfig: any) => Record<string, null | Record<string, any>>)
	transform_file?: (page: TransformPage) => Promise<{ code: string }> | { code: string }
	index_file?: ModuleIndexTransform
	graphql_tag_return?: (args: {
		config: Config
		doc: CollectedGraphQLDocument
		ensure_import: (import_args: { identifier: string; module: string }) => void
	}) => string | undefined
	validate?: (args: {
		config: Config
		documents: CollectedGraphQLDocument[]
	}) => Promise<void> | void
	vite?: {
		// these type definitions are copy and pasted from the vite ones
		// with config added to the appropriate options object
		resolveId?: ObjectHook<
			(
				this: PluginContext,
				source: string,
				importer: string | undefined,
				options: {
					config: Config
					custom?: CustomPluginOptions
					ssr?: boolean
					/* Excluded from this release type: scan */
					isEntry: boolean
				}
			) => Promise<ResolveIdResult> | ResolveIdResult
		>
		load?: ObjectHook<
			(
				this: PluginContext,
				id: string,
				options: {
					config: Config
					ssr?: boolean
				}
			) => Promise<LoadResult> | LoadResult
		>
	}
	include?: (config: Config, filepath: string) => boolean | null | undefined
}

type ModuleIndexTransform = (arg: {
	config: Config
	content: string
	export_default_as(args: { module: string; as: string }): string
	export_star_from(args: { module: string }): string
	plugin_root: string
	typedef: boolean
	documents: CollectedGraphQLDocument[]
}) => string

export type GenerateHook = (args: GenerateHookInput) => Promise<void> | void

export type GenerateHookInput = {
	config: Config
	documents: CollectedGraphQLDocument[]
	plugin_root: string
}

export type PluginConfig = { configPath?: string } & Partial<ConfigFile>

export * from '../runtime/lib/types'
export * from '../runtime/lib/config'
