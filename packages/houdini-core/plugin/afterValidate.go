package plugin

import (
	"context"

	"code.houdinigraphql.com/packages/houdini-core/plugin/componentFields"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/packages/houdini-core/plugin/lists"
)

func (p *HoudiniCore) AfterValidate(ctx context.Context) error {
	// now that we've validated the documents we can start to process them

	// the first thing we need to do is add the necessary fields to the documents
	err := documents.AddDocumentFields(ctx, p.DB)
	if err != nil {
		return err
	}

	// next, we need to add the list operation documents
	err = lists.InsertOperationDocuments(ctx, p.DB)
	if err != nil {
		return err
	}

	// we can now prepare the pagination documents
	err = lists.PreparePaginationDocuments(ctx, p.DB)
	if err != nil {
		return err
	}

	// transform any references to componentFields to their appropriate fragment
	err = componentFields.TransformFields(ctx, p.DB)
	if err != nil {
		return err
	}

	// if we got this far, we're done
	return nil
}
