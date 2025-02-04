package plugins

// all a plugin _must_ provide is a name
type Plugin interface {
	Name() string
}

// each hook can be implemented by a plugin by implementing the corresponding method

type PluginOrder string

const (
	PluginOrderCore   = "core"
	PluginOrderBefore = "before"
	PluginOrderAfter  = "after"
)

// Order defines the priority for the hook. The order is before -> core -> after.
type Order interface {
	Order() PluginOrder
}

// Extensions extensions to the list that houdini uses to find valid source files
type Extensions interface {
	Extensions() []string
}

type PackagMode string

const (
	PackageModeCommonJS = "commonjs"
	PackageModeESM      = "esm"
)

/**
 * A relative path from the file exporting your plugin to a runtime that will be
 * automatically included with your
 */
type IncludeRuntime interface {
	IncludeRuntime(mode string) string
}

/**
 * A relative path from the file exporting your plugin to a runtime that can be
 * added to the project before generating artifacts. This is useful for plugins
 * that want to add third-party documents to the user's application.
 */
type StaticRuntime interface {
	StaticRuntime(mode string) string
}

/**
 * Transform the plugin's runtime while houdini is copying it .
 * You must have passed a value to includeRuntime for this hook to matter.
 */
type TransformRuntime interface {
	TransformRuntime(source string) string
}

/**
 * The path to a javascript module with an default export that sets configuration values.
 */
type Config interface {
	Config() string
}

/**
 * Add environment variables to the project
 */
type Environment interface {
	Environment() map[string]string
}

/**
 * Invoked after all plugins have loaded and modified config values.
 */
type AfterLoad interface {
	AfterLoad()
}

/**
 * Specify a pattern to match files that should be transformed by the plugin.
 */
type Include interface {
	Include() string
}

/**
 * Specify a pattern to match files that should not be transformed by the plugin.
 */
type Exclude interface {
	Exclude() string
}

/**
 * Extract documents from the project
 */
type Extract interface {
	Extract() []string
}

/**
 * Can be used to add custom definitions to your project's schema. Definitions (like directives) added
 * here are automatically removed from the document before they are sent to the server. Useful
 * in connection with artifactData or artifact_selection to embed data in the artifact.
 */
type Schema interface {
	Schema() string
}

/**
 * A hook to transform the documents before they are validated.
 */
type BeforeValidate interface {
	BeforeValidate()
}

/**
 * A hook to validate all of the documents in a project.
 */
type Validate interface {
	Validate() error
}

/**
 * A hook to transform the documents after they are validated.
 */
type AfterValidate interface {
	AfterValidate()
}

/**
 * A hook to transform the documents before documents are generated.
 */
type BeforeGenerate interface {
	BeforeGenerate()
}

/**
 * A hook to embed metadata at the root of the artifact.
 */
type ArtifactData interface {
	ArtifactData(documentName string) map[string]string
}

/**
 * A hook to customize the hash generated for your document.
 */
type Hash interface {
	Hash(documentName string) string
}

/**
 * A hook to customize the return type of the graphql function. If you need to add an import to the file
 * in order to resolve the import, you can use the `ensureImport` utility.
 */
type GraphQLTagReturn interface {
	GraphQLTagReturn(documentName string) string
}

/**
 * A hook to modify the root `index.js` of the generated runtime.
 */
type IndexFile interface {
	IndexFile(source string) string
}

/**
 * A hook to generate custom files for every document in a project.
 */
type Generate interface {
	Generate() string
}

/**
 * A hook to modify the generated artifact before it is persisted
 */
type ArtifactEnd interface {
	ArtifactEnd()
}

/**
 * Specify the plugins that should be added to the user's client because
 * of this plugin.
 */
type ClientPlugins interface {
	ClientPlugins() map[string]string
}

/**
 * A hook to transform the source file to support desired APIs.
 */
type TransformFile interface {
	TransformFile(source string) string
}
