import type * as graphql from 'graphql'
import type * as recast from 'recast'
import type {
	CustomPluginOptions,
	InputOptions,
	LoadResult,
	MinimalPluginContext,
	NormalizedInputOptions,
	NullValue,
	ObjectHook,
	PluginContext,
	ResolveIdResult,
	SourceMapInput,
} from 'rollup'
import type { ConfigEnv, ResolvedConfig, UserConfig, ViteDevServer } from 'vite'

import type { ConfigFile } from '../runtime/lib/config'
import type {
	ArtifactKinds,
	BaseCompiledDocument,
	DocumentArtifact,
	ValueOf,
} from '../runtime/lib/types'
import type { TransformPage } from '../vite/houdini'
import type { Config } from './config'
import type { Adapter } from './router'

type Program = recast.types.namedTypes.Program

export type Maybe<T> = T | null | undefined

export type Script = Program

export type TransformDocument = {
	instance: Maybe<Script>
	config: Config
	dependencies: string[]
	filename: string
}

/**
 * The result of collecting documents from source code
 */
export type Document = {
	/**
	 * The name of the document.
	 */
	name: string

	/**
	 * A field you can use to distinguish documents by type (query, mutation, subscription, fragment)
	 */
	kind: ArtifactKinds

	/**
	 * The artifact generated for the document. This will only have a value in the last phase
	 * of the Generation Pipeline.
	 */
	artifact: DocumentArtifact | null

	/**
	 * The path of the file containing this document
	 */
	filename: string

	/**
	 * The parsed document. This value should be modified throughout the pipeline.
	 * */
	document: graphql.DocumentNode

	/**
	 * Whether an artifact should be generated for the document. This should be set to false for internal
	 * or virtual documents .
	 */
	generateArtifact: boolean

	/**
	 * Whether a runtime equivalent should be generated for the document. This should be set to false for internal
	 * or virtual documents .
	 */
	generateStore: boolean

	/**
	 * The original document string that the user passed
	 */
	originalString: string

	/**
	 * The parsed document that the user provided
	 * */
	originalParsed: graphql.DocumentNode

	/**
	 * Refetch logic that has been built up throughout the pipeline
	 */
	refetch?: BaseCompiledDocument<'HoudiniQuery'>['refetch']
}

export const LogLevel = {
	Full: 'full',
	Summary: 'summary',
	ShortSummary: 'short-summary',
	Quiet: 'quiet',
} as const

export type LogLevels = ValueOf<typeof LogLevel>

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

	includeRuntime?: string | { esm: string; commonjs: string }

	/**
	 * Transform the plugin's runtime while houdini is copying it .
	 * You must have passed a value to includeRuntime for this hook to matter.
	 */
	transformRuntime?:
		| Record<
				string,
				(args: {
					config: Config
					content: string
					importStatement: (where: string, as: string) => string
					exportDefaultStatement: (val: string) => string
					exportStarStatement: (val: string) => string
				}) => string
		  >
		| ((
				docs: Document[],
				opts: { config: Config }
		  ) => Record<
				string,
				(args: {
					config: Config
					content: string
					importStatement: (where: string, as: string) => string
					exportDefaultStatement: (val: string) => string
					exportStarStatement: (val: string) => string
				}) => string
		  >)

	/**
	 * An module with an default export that sets configuration values.
	 */
	config?: string

	/**
	 *
	 * Add environment variables to houdini's pipeline (ie, for schema polling headers, url, etc.)
	 */
	env?: (args: { env: any; config: Config }) => Promise<Record<string, string>>

	/**
	 * Invoked after all plugins have loaded and modified config values.
	 */
	afterLoad?: (args: { config: Config }) => Promise<void> | void

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
	extractDocuments?: (args: {
		config: Config
		filepath: string
		content: string
	}) => Promise<string[] | null> | string[] | null

	/**
	 * Can be used to add custom definitions to your project's schema. Definitions (like directives) added
	 * here are automatically removed from the document before they are sent to the server. Useful
	 * in connection with artifactData or artifact_selection to embed data in the artifact.
	 */
	schema?: (args: { config: Config }) => string

	/**
	 * A hook to transform the documents before they are validated.
	 */
	beforeValidate?: (args: { config: Config; documents: Document[] }) => Promise<void> | void

	/**
	 * A hook to validate all of the documents in a project.
	 */
	validate?: (args: { config: Config; documents: Document[] }) => Promise<void> | void

	/**
	 * A hook to transform the documents after they are validated.
	 */
	afterValidate?: (args: { config: Config; documents: Document[] }) => Promise<void> | void

	/**
	 * A hook to transform the documents before documents are generated.
	 */
	beforeGenerate?: (args: { config: Config; documents: Document[] }) => Promise<void> | void

	/**
	 * A hook to embed metadata at the root of the artifact.
	 */
	artifactData?: (args: { config: Config; document: Document }) => Record<string, any> | void

	/**
	 * A hook to customize the hash generated for your document.
	 */
	hash?: (args: { config: Config; document: Document }) => string

	/**
	 * A hook to customize the return type of the graphql function. If you need to add an import to the file
	 * in order to resolve the import, you can use the `ensureImport` utility.
	 */
	graphqlTagReturn?: (args: {
		config: Config
		document: Document
		ensureImport: (import_args: { identifier: string; module: string }) => void
	}) => string | undefined

	/**
	 * A hook to modify the root `index.js` of the generated runtime.
	 */
	indexFile?: ModuleIndexTransform

	/**
	 * A hook to generate custom files for every document in a project.
	 */
	generate?: GenerateHook

	/**
	 * A hook to modify the generated artifact before it is persisted
	 */
	artifactEnd?: (args: { config: Config; document: Document }) => void

	/**
	 * Specify the plugins that should be added to the user's client because
	 * of this plugin.
	 */
	clientPlugins?:
		| Record<string, null | Record<string, any>>
		| ((config: ConfigFile, pluginConfig: any) => Record<string, null | Record<string, any>>)

	/**
	 * A hook to transform the source file to support desired APIs.
	 */
	transformFile?: (
		page: TransformPage
	) =>
		| Promise<{ code: string; map?: SourceMapInput | string }>
		| { code: string; map?: SourceMapInput | string }

	vite?: {
		config?: (config: Config, env: ConfigEnv) => UserConfig | Promise<UserConfig>

		buildStart?: (
			this: PluginContext,
			options: NormalizedInputOptions & { houdiniConfig: Config }
		) => void | Promise<void>

		buildEnd?: (
			this: PluginContext,
			error?: Error,
			houdiniConfig?: Config
		) => void | Promise<void>

		closeBundle?: (this: PluginContext, config: Config) => void | Promise<void>

		configResolved?: ObjectHook<(this: void, config: ResolvedConfig) => void | Promise<void>>

		options?: (
			this: MinimalPluginContext,
			options: InputOptions & { houdiniConfig: Config }
		) => InputOptions | NullValue

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
		configureServer?:
			| ObjectHook<
					(
						this: void,
						server: ViteDevServer & { houdiniConfig: Config }
					) => (() => void) | void | Promise<(() => void) | void>,
					{}
			  >
			| undefined
	}
}

type ModuleIndexTransform = (arg: {
	config: Config
	content: string
	exportDefaultAs(args: { module: string; as: string }): string
	exportStarFrom(args: { module: string }): string
	pluginRoot: string
	typedef: boolean
	documents: Document[]
}) => string

export type GenerateHook = (args: GenerateHookInput) => Promise<void> | void

export type GenerateHookInput = {
	config: Config
	documents: Document[]
	pluginRoot: string
}

export type PluginConfig = { configPath?: string; adapter?: Adapter } & Partial<ConfigFile>

export * from '../runtime/lib/types'
export * from '../runtime/lib/config'
export * from '../runtime/client'

export type ValueMap = Record<string, graphql.ValueNode>
