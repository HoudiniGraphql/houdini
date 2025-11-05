package plugin

import (
	"context"
	"fmt"

	"code.houdinigraphql.com/packages/houdini-core/plugin/componentFields"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	fragmentarguments "code.houdinigraphql.com/packages/houdini-core/plugin/fragmentArguments"
	"code.houdinigraphql.com/packages/houdini-core/plugin/lists"
)

func (p *HoudiniCore) AfterValidate(ctx context.Context) error {
	// now that we've validated the documents we can start to process them

	fmt.Println("adding document fields...")
	// the first thing we need to do is add the necessary fields to the documents
	err := documents.AddDocumentFields(ctx, p.DB)
	if err != nil {
		return err
	}

	fmt.Println("Inserting list operations...")
	// next, we need to add the list operation documents
	err = lists.InsertOperationDocuments(ctx, p.DB)
	if err != nil {
		return err
	}

	fmt.Println("Preparing pagination documents...")
	// we can now prepare the pagination documents
	err = lists.PreparePaginationDocuments(ctx, p.DB)
	if err != nil {
		return err
	}

	fmt.Println("Transforming component fields...")
	// transform any references to componentFields to their appropriate fragment
	err = componentFields.TransformFields(ctx, p.DB)
	if err != nil {
		return err
	}

	fmt.Println("Realizing fragment arguments...")
	// and finally, realize any fragment any arguments
	err = fragmentarguments.Transform(ctx, p.DB)
	if err != nil {
		return err
	}

	// if we got this far, we're done
	return nil
}
