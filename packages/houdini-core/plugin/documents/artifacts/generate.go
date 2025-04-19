package artifacts

import (
	"context"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins"
)

func Generate(ctx context.Context, db plugins.DatabasePool[config.PluginConfig]) error {
	conn, err := db.Take(ctx)
	if err != nil {
		return err
	}

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

	// we now have everything we need to generate the document artifacts
	err = GenerateDocumentArtifacts(ctx, db, conn, collected)
	if err != nil {
		return err
	}

	// we're done
	return nil
}
