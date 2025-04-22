package artifacts

import (
	"context"
	"path"

	"github.com/spf13/afero"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins"
)

func Generate(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	fs afero.Fs,
	sortKeys bool,
) error {
	conn, err := db.Take(ctx)
	if err != nil {
		return err
	}
	defer db.Put(conn)

	// before we generate artifacts we need to trigger a few hooks
	_, err = plugins.TriggerHook(ctx, db, "Hash", map[string]any{})
	if err != nil {
		return err
	}

	// the first thing we need to do is collect the definitions of all of the necessary documents
	collected, err := CollectDocuments(ctx, db, conn)
	if err != nil {
		return err
	}

	//  make sure that the documents are printed
	err = EnsureDocumentsPrinted(ctx, db, conn, collected, false)
	if err != nil {
		return err
	}

	// make sure the artifact directory exists
	projectConfig, err := db.ProjectConfig(ctx)
	if err != nil {
		return err
	}
	artifactDirectory := path.Join(projectConfig.ProjectRoot, projectConfig.RuntimeDir, "artifacts")
	err = fs.MkdirAll(artifactDirectory, 0755)
	if err != nil {
		return err
	}

	// we now have everything we need to generate the document artifacts
	err = GenerateDocumentArtifacts(ctx, db, conn, collected, fs, sortKeys)
	if err != nil {
		return err
	}

	// we're done
	return nil
}
