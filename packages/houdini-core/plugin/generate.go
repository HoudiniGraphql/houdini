package plugin

import (
	"code.houdinigraphql.com/plugins"
	"context"
	"errors"
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

	if projectConfig.PersistedQueriesPath == "" {
		return plugins.WrapError(errors.New("PersistedQueriesPath is not set"))
	}

	defaultPersistentQueriesPath := path.Join(projectConfig.ProjectRoot, projectConfig.PersistedQueriesPath)
	err = documents.GeneratePersistentQueries(ctx, p.DB, p.Fs, defaultPersistentQueriesPath)
	if err != nil {
		return err
	}

	// we're done
	return nil
}
