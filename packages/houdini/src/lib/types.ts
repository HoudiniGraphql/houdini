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
import type { ArtifactKind, BaseCompiledDocument, DocumentArtifact } from '../runtime/lib/types'
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

export type Plugin = (
	args?: PluginConfig
) => Promise<(PluginHooks | PluginInit) | (PluginHooks | PluginInit)[] | null | false>

export type PluginInit = {
	__plugin_init__: boolean
	plugin: Plugin
	name: string
	config?: {}
	local?: string
	with(config: {}): PluginInit
}

export type PluginHooks = {
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

	/**
	 * A filter for whether a file should be included in the the processing. Return true to include.
	 */
	include?: (args: { config: Config; filepath: string }) => boolean | null | undefined

	/**
	 * A filter for whether a file should be included in the the processing. Return false to include.
	 */
	exclude?: (args: { config: Config; filepath: string }) => boolean | null | undefined

	/**
	 * Configure the codegen pipeline to extract graphql documents out of a file.
	 */
	extract_documents?: (args: {
		config: Config
		filepath: string
		content: string
	}) => Promise<string[] | null> | string[] | null

	/**
	 * Can be used to add custom definitions to your project's schema. Definitions (like directives) added
	 * here are automatically removed from the document before they are sent to the server. Useful
	 * in connection with artifact_data or artifact_selection to embed data in the artifact.
	 */
	schema?: (args: { config: Config }) => string

	/**
	 * A hook to transform the documents before they are validated.
	 */
	transform_before_validate?: (args: {
		config: Config
		documents: CollectedGraphQLDocument[]
	}) => Promise<void> | void

	/**
	 * A hook to validate all of the documents in a project.
	 */
	validate?: (args: {
		config: Config
		documents: CollectedGraphQLDocument[]
	}) => Promise<void> | void

	/**
	 * A hook to transform the documents after they are validated.
	 */
	transform_after_validate?: (args: {
		config: Config
		documents: CollectedGraphQLDocument[]
	}) => Promise<void> | void

	/**
	 * A hook to transform the documents before documents are generated.
	 */
	transform_before_generate?: (args: {
		config: Config
		documents: CollectedGraphQLDocument[]
	}) => Promise<void> | void

	/**
	 * A hook to embed metadata at the root of the artifact.
	 */
	artifact_data?: (args: {
		config: Config
		document: CollectedGraphQLDocument
	}) => Record<string, any>

	/**
	 * A hook to customize the hash generated for your document.
	 */
	hash?: (args: { config: Config; document: CollectedGraphQLDocument }) => string

	/**
	 * A hook to customize the return type of the graphql function. If you need to add an import to the file
	 * in order to resolve the import, you can use the `ensure_import` utility.
	 */
	graphql_tag_return?: (args: {
		config: Config
		document: CollectedGraphQLDocument
		ensure_import: (import_args: { identifier: string; module: string }) => void
	}) => string | undefined

	/**
	 * A hook to modify the root `index.js` of the generated runtime.
	 */
	index_file?: ModuleIndexTransform

	/**
	 * A hook to generate custom files for every document in a project.
	 */
	generate?: GenerateHook

	/**
	 * A hook to modify the generated artifact before it is persisted
	 */
	artifact_end?: (args: { config: Config; artifact: DocumentArtifact }) => DocumentArtifact

	/**
	 * Specify the plugins that should be added to the user's client because
	 * of this plugin.
	 */
	client_plugins?:
		| Record<string, null | Record<string, any>>
		| ((config: ConfigFile, pluginConfig: any) => Record<string, null | Record<string, any>>)

	/**
	 * A hook to transform the source file to support desired APIs.
	 */
	transform_file?: (page: TransformPage) => Promise<{ code: string }> | { code: string }

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
