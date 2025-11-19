package plugin

import (
	"context"

	"code.houdinigraphql.com/packages/houdini-core/plugin/componentFields"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	fragmentarguments "code.houdinigraphql.com/packages/houdini-core/plugin/fragmentArguments"
	"code.houdinigraphql.com/packages/houdini-core/plugin/lists"
)

func (p *HoudiniCore) AfterValidate(ctx context.Context) error {
	// now that we've validated the documents we can start to process them

	// first, we need to add the list operation documents
	err := lists.InsertOperationDocuments(ctx, p.DB)
	if err != nil {
		return err
	}

	// next, we can prepare the pagination documents
	err = lists.PreparePaginationDocuments(ctx, p.DB)
	if err != nil {
		return err
	}

	// finally, add the necessary fields to ALL documents (including newly created ones)
	err = documents.AddDocumentFields(ctx, p.DB)
	if err != nil {
		return err
	}

	// transform any references to componentFields to their appropriate fragment
	err = componentFields.TransformFields(ctx, p.DB)
	if err != nil {
		return err
	}

	// and finally, realize any fragment any arguments
	err = fragmentarguments.Transform(ctx, p.DB)
	if err != nil {
		return err
	}

	// mark all documents as processed after successful transformation
	// This ensures that newly created documents (like pagination docs) are also marked
	// and prevents reprocessing on subsequent runs
	err = p.DB.ExecQuery(ctx, `
		UPDATE documents
		SET processed = true
		WHERE (processed = false OR processed IS NULL)
		  AND documents.id IN (
		    SELECT documents.id
		    FROM documents
		    JOIN raw_documents ON documents.raw_document = raw_documents.id
				WHERE (raw_documents.current_task = $task_id OR $task_id IS NULL)
		  )
	`, nil)
	if err != nil {
		return err
	}

	// if we got this far, we're done
	return nil
}
