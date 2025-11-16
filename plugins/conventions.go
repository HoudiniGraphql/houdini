package plugins

import "path/filepath"

func (c ProjectConfig) DefinitionsDirectory() string {
	if c.DefinitionsPath != "" {
		return filepath.Join(c.ProjectRoot, c.DefinitionsPath)
	}
	return filepath.Join(c.RuntimeDir, "graphql")
}

func (c ProjectConfig) DefinitionsEnumRuntime() string {
	return filepath.Join(c.DefinitionsDirectory(), "enums.ts")
}

func (c ProjectConfig) DefinitionsSchemaPath() string {
	return filepath.Join(c.DefinitionsDirectory(), "schema.graphql")
}

func (c ProjectConfig) DefinitionsDocumentsPath() string {
	return filepath.Join(c.DefinitionsDirectory(), "documents.gql")
}

func (c ProjectConfig) DefinitionsIndexJs() string {
	return filepath.Join(c.DefinitionsDirectory(), "index.ts")
}

func (c ProjectConfig) ArtifactDirectory() string {
	return filepath.Join(
		c.ProjectRoot,
		c.RuntimeDir,
		"artifacts",
	)
}

func (c ProjectConfig) ArtifactPath(name string) string {
	return filepath.Join(
		c.ArtifactDirectory(),
		name+".ts",
	)
}

func (c ProjectConfig) ArtifactTypePath(name string) string {
	return filepath.Join(
		c.ArtifactDirectory(),
		name+".ts",
	)
}
