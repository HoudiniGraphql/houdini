package plugin

import (
	"context"

	"code.houdinigraphql.com/packages/houdini-core/plugin/componentFields"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/packages/houdini-core/plugin/runtimeScalars"
	"code.houdinigraphql.com/plugins"
)

// AfterExtract is called after all of the plugins have added their documents to the project.
// We'll use this plugin to parse each document and load it into the database.
func (p *HoudiniCore) AfterExtract(ctx context.Context) error {
	// the first thing we have to do is load the extracted queries into the database
	err := documents.LoadDocuments(ctx, p.DB)
	if err != nil {
		return err
	}

	// combine the next
	errs := &plugins.ErrorList{}

	// write component field information to the database
	componentFields.WriteMetadata(ctx, p.DB, errs)

	// and replace runtime scalars with their schema-valid equivalents
	runtimeScalars.TransformVariables(ctx, p.DB, errs)

	// if we have any errors collected, return them
	if errs.Len() > 0 {
		return errs
	}

	// we're done
	return nil
}
