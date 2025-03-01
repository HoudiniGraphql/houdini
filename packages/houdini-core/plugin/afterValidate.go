package plugin

import (
	"context"

	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/plugins"
)

func (p *HoudiniCore) AfterValidate(ctx context.Context) error {
	// now that we've validated the documents we can start to process them

	// the first thing we need to do is add the necessary fields to the documents
	errs := &plugins.ErrorList{}
	documents.AddDocumentFields(ctx, p.DB, errs)
	if errs.Len() > 0 {
		return errs
	}

	// if we got this far, we're done
	return nil
}
