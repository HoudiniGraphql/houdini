package plugins

import "context"

// all a plugin _must_ provide is a name and its order
type HoudiniPlugin[PluginConfig any] interface {
	Name() string
	Order() PluginOrder
	SetDatabase(Database[PluginConfig])
}

type Plugin[PluginConfig any] struct {
	DB Database[PluginConfig]
}

// SetDatabase is a helper that lets Run() inject the database into the plugin.
func (p *Plugin[PluginConfig]) SetDatabase(db Database[PluginConfig]) {
	p.DB = db
}

// ConnectDB returns a new database connection.
func (p *Plugin[PluginConfig]) ConnectDB() (Database[PluginConfig], error) {
	return ConnectDB[PluginConfig]()
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
	IncludeRuntime(ctx context.Context) (string, error)
}

/* A relative path from the file exporting your plugin to a runtime that can be
 * added to the project before generating artifacts. This is useful for plugins
 * that want to add third-party documents to the user's application. */
type StaticRuntime interface {
	StaticRuntime(ctx context.Context) (string, error)
}

/* Transform the plugin's runtime while houdini is copying it .
 * You must have passed a value to includeRuntime for this hook to matter. */
type TransformRuntime interface {
	TransformRuntime(ctx context.Context, source string) (string, error)
}

/* The path to a javascript module with an default export that sets configuration values. */
type Config interface {
	Config(ctx context.Context) (string, error)
}

/* Add environment variables to the project */
type Environment interface {
	Environment(ctx context.Context, mode string) (map[string]string, error)
}

/* Invoked after all plugins have loaded and modified config values. */
type AfterLoad interface {
	AfterLoad(ctx context.Context) error
}

/* Extract documents from the project */
type ExtractDocuments interface {
	ExtractDocuments(ctx context.Context) error
}

/* AfterExtract is called after all documents have been extracted from the project. */
type AfterExtract interface {
	AfterExtract(ctx context.Context) error
}

/* Can be used to add custom definitions to your project's schema. Definitions (like directives) added
 * here are automatically removed from the document before they are sent to the server. Useful
 * in connection with artifactData or artifact_selection to embed data in the artifact. */
type Schema interface {
	Schema(ctx context.Context) error
}

/* A hook to transform the documents before they are validated. */
type BeforeValidate interface {
	BeforeValidate(ctx context.Context) error
}

/* A hook to validate all of the documents in a project. */
type Validate interface {
	Validate(ctx context.Context) error
}

/* A hook to transform the documents after they are validated. */
type AfterValidate interface {
	AfterValidate(ctx context.Context) error
}

/* A hook to transform the documents before documents are generated. */
type BeforeGenerate interface {
	BeforeGenerate(ctx context.Context) error
}

/* A hook to embed metadata at the root of the artifact. */
type ArtifactData interface {
	ArtifactData(ctx context.Context, documentName string) (map[string]string, error)
}

/* A hook to customize the hash generated for your document. */
type Hash interface {
	Hash(ctx context.Context, documentName string) (string, error)
}

/* A hook to customize the return type of the graphql function. If you need to add an import to the file
 * in order to resolve the import, you can use the `ensureImport` utility. */
type GraphQLTagReturn interface {
	GraphQLTagReturn(ctx context.Context, documentName string) (string, error)
}

/* A hook to modify the root `index.js` of the generated runtime. */
type IndexFile interface {
	IndexFile(ctx context.Context, source string) (string, error)
}

/* A hook to generate custom files for every document in a project. */
type Generate interface {
	Generate(ctx context.Context) (string, error)
}

/* A hook to modify the generated artifact before it is persisted */
type ArtifactEnd interface {
	ArtifactEnd(ctx context.Context) error
}

/* Specify the plugins that should be added to the user's client because
 * of this plugin. */
type ClientPlugins interface {
	ClientPlugins(ctx context.Context) (map[string]string, error)
}

/* A hook to transform the source file to support desired APIs. */
type TransformFile interface {
	TransformFile(ctx context.Context, filepath string, source string) (string, error)
}
