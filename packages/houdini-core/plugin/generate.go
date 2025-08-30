package plugin

import (
	"context"
	"path"

	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents/artifacts"
)

func (p *HoudiniCore) Generate(ctx context.Context) error {
	// the first thing to do is generate the artifacts

	err := artifacts.Generate(ctx, p.DB, p.Fs, false)
	if err != nil {
		return err
	}

	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return err
	}

	// Use default path if PersistedQueriesPath is not configured
	persistedQueriesPath := projectConfig.PersistedQueriesPath

	defaultPersistentQueriesPath := path.Join(projectConfig.ProjectRoot, persistedQueriesPath)
	err = documents.GeneratePersistentQueries(ctx, p.DB, p.Fs, defaultPersistentQueriesPath)
	if err != nil {
		return err
	}

	// we're done
	return nil
}
