package plugins

// all a plugin _must_ provide is a name and its order
type Plugin interface {
	Name() string
	Order() PluginOrder
}

// each hook can be implemented by a plugin by implementing the corresponding method

type PluginOrder string

const (
	PluginOrderCore   = "core"
	PluginOrderBefore = "before"
	PluginOrderAfter  = "after"
)

type PackagMode string

const (
	PackageModeCommonJS = "commonjs"
	PackageModeESM      = "esm"
)

/* A relative path from the file exporting your plugin to a runtime that will be
 * automatically included with your */
type IncludeRuntime interface {
	IncludeRuntime() (string, error)
}

/* A relative path from the file exporting your plugin to a runtime that can be
 * added to the project before generating artifacts. This is useful for plugins
 * that want to add third-party documents to the user's application. */
type StaticRuntime interface {
	StaticRuntime() (string, error)
}

/* Transform the plugin's runtime while houdini is copying it .
 * You must have passed a value to includeRuntime for this hook to matter. */
type TransformRuntime interface {
	TransformRuntime(source string) (string, error)
}

/* The path to a javascript module with an default export that sets configuration values. */
type Config interface {
	Config() (string, error)
}

/* Add environment variables to the project */
type Environment interface {
	Environment(mode string) (map[string]string, error)
}

/* Invoked after all plugins have loaded and modified config values. */
type AfterLoad interface {
	AfterLoad() error
}

/* Extract documents from the project */
type ExtractDocuments interface {
	ExtractDocuments(include []string, exclude []string) error
}

/* AfterExtract is called after all documents have been extracted from the project. */
type AfterExtract interface {
	AfterExtract() error
}

/* Can be used to add custom definitions to your project's schema. Definitions (like directives) added
 * here are automatically removed from the document before they are sent to the server. Useful
 * in connection with artifactData or artifact_selection to embed data in the artifact. */
type Schema interface {
	Schema() error
}

/* A hook to transform the documents before they are validated. */
type BeforeValidate interface {
	BeforeValidate() error
}

/* A hook to validate all of the documents in a project. */
type Validate interface {
	Validate() error
}

/* A hook to transform the documents after they are validated. */
type AfterValidate interface {
	AfterValidate() error
}

/* A hook to transform the documents before documents are generated. */
type BeforeGenerate interface {
	BeforeGenerate() error
}

/* A hook to embed metadata at the root of the artifact. */
type ArtifactData interface {
	ArtifactData(documentName string) (map[string]string, error)
}

/* A hook to customize the hash generated for your document. */
type Hash interface {
	Hash(documentName string) (string, error)
}

/* A hook to customize the return type of the graphql function. If you need to add an import to the file
 * in order to resolve the import, you can use the `ensureImport` utility. */
type GraphQLTagReturn interface {
	GraphQLTagReturn(documentName string) (string, error)
}

/* A hook to modify the root `index.js` of the generated runtime. */
type IndexFile interface {
	IndexFile(source string) (string, error)
}

/* A hook to generate custom files for every document in a project. */
type Generate interface {
	Generate() (string, error)
}

/* A hook to modify the generated artifact before it is persisted */
type ArtifactEnd interface {
	ArtifactEnd() error
}

/* Specify the plugins that should be added to the user's client because
 * of this plugin. */
type ClientPlugins interface {
	ClientPlugins() (map[string]string, error)
}

/* A hook to transform the source file to support desired APIs. */
type TransformFile interface {
	TransformFile(filepath string, source string) (string, error)
}
