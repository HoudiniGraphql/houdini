package selection

import (
	"context"
	"fmt"
	"runtime"
	"strings"
	"sync"

	"zombiezen.com/go/sqlite"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins"
)

// CollectDocuments takes a document ID and grabs its full selection set along with the selection sets of
// all referenced fragments
func CollectDocuments(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
) (map[string]*CollectedDocument, error) {
	result := map[string]*CollectedDocument{}

	conn, err := db.Take(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Put(conn)

	// the first thing we have to do is id of every document that we care about
	docIDs := []int64{}

	// the documents we care about are those that fall in the current task as well as
	// any fragments that are referenced in a document that is in the current task
	documentSearch, err := conn.Prepare(`
    SELECT documents.id 
    FROM documents 
      JOIN raw_documents ON documents.raw_document = raw_documents.id
    WHERE (raw_documents.current_task = $task_id OR $task_id is null)

    UNION

    SELECT documents.id
    FROM selections 
      JOIN documents ON selections.field_name = documents."name" 
      JOIN selection_refs ON selection_refs.child_id = selections.id
      JOIN documents selection_docs ON selection_refs.document = selection_docs.id
      JOIN raw_documents ON selection_docs.raw_document = raw_documents.id
    WHERE selections.kind = 'fragment' AND (raw_documents.current_task = $task_id OR $task_id is null)
  `)
	if err != nil {
		return nil, err
	}
	err = db.StepStatement(ctx, documentSearch, func() {
		docIDs = append(docIDs, documentSearch.GetInt64("id"))
	})
	if err != nil {
		return nil, err
	}

	// now that we have the list of relevant documents we need to process we should collect their definitions
	// in principle there could be a large number of documents that need to be collected so we'll parallelize this
	// part of the proces

	// the batch size depends on how many there are. at the maximum, the batch size is nDocuments / nCpus
	// but if that's above 100, then we should cap it at 100
	batchSize := max(1, min(100, len(docIDs)/runtime.NumCPU()))

	// create a channel to send batches of ids to process
	batchCh := make(chan []int64)
	// and a channel to send errors back
	errCh := make(chan *plugins.Error)
	// and a channel to send collected documents back
	resultCh := make(chan *CollectedDocument)

	// create a pool of worker goroutines to process the documents
	var wg sync.WaitGroup
	for range runtime.NumCPU() {
		wg.Add(1)
		go collectDoc(ctx, db, &wg, batchCh, resultCh, errCh)
	}

	// partition the docIDs into batches and send them to the workers
	for i := 0; i < len(docIDs); i += batchSize {
		batchCh <- docIDs[i:min(i+batchSize, len(docIDs))]
	}

	// close the channel to signal no more batches are coming.
	close(batchCh)

	// wait for all workers to finish processing.
	wg.Wait()

	// close the error channel since no more errors will be sent.
	close(errCh)
	close(resultCh)

	// process any errors that occurred.
	errList := &plugins.ErrorList{}
	for err := range errCh {
		errList.Append(err)
	}
	// collect the results
	for doc := range resultCh {
		result[doc.Name] = doc
	}

	// return any errors that were found
	if errList.Len() > 0 {
		return nil, errList
	}

	// if we got this far, we're done
	return result, nil
}

func collectDoc(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	wg *sync.WaitGroup,
	docIDs <-chan []int64,
	resultCh chan<- *CollectedDocument,
	errCh chan<- *plugins.Error,
) {
	defer wg.Done()

	// hold onto a connection for the collection process
	conn, err := db.Take(ctx)
	if err != nil {
		errCh <- plugins.WrapError(err)
		return
	}
	defer db.Put(conn)

	for batch := range docIDs {
		// wrap each processing in a function so we have a defer context to avoid deadlocking the connection
		func(ids []int64) {
			// prepare the search statemetns
			statements, err := prepareCollectStatements(conn, len(ids))
			if err != nil {
				errCh <- plugins.WrapError(err)
				return
			}
			defer statements.Finalize()
		}(batch)
	}
}

type CollectStatements struct {
	PrintSearch *sqlite.Stmt
}

func prepareCollectStatements(conn *sqlite.Conn, nDocuments int) (*CollectStatements, error) {
	// we are going to produce a version of the document that looks up a batch of documents
	// which means we need to produce enough ?'s to create a WHERE IN
	placeholders := make([]string, nDocuments)
	for i := range nDocuments {
		placeholders[i] = "?"
	}

	// join the placeholders with commas and enclose in parentheses.
	whereIn := "(" + strings.Join(placeholders, ", ") + ")"

	printSearch, err := conn.Prepare(fmt.Sprintf(`
    WITH 
      directive_args AS (
        SELECT
          selection_directive_arguments.parent AS directive_id,
          json_group_array(json_object('name', selection_directive_arguments.name, 'value', selection_directive_arguments.value)) AS directive_arguments
        FROM
          selection_directive_arguments
          JOIN selection_directives ON selection_directive_arguments.parent = selection_directives.id
          JOIN selections ON selection_directives.selection_id = selections.id
          JOIN selection_refs ON selection_refs.child_id = selections.id
        WHERE
          selection_refs."document" IN %s
        GROUP BY
          selection_directive_arguments.parent
      ),
      directives_agg AS (
        SELECT
          sd.selection_id,
          json_group_array(
            json_object(
              'id', sd.id,
              'arguments', IFNULL(da.directive_arguments, '[]')
            )
          ) AS directives
        FROM selection_directives sd
          LEFT JOIN directive_args da ON da.directive_id = sd.id
          JOIN selections ON sd.selection_id = selections.id
          JOIN selection_refs ON selection_refs.child_id = selections.id
        WHERE
          selection_refs."document" IN %s
        GROUP BY sd.selection_id
      ),
      arguments_agg AS (
        SELECT
          selection_arguments.selection_id,
          json_group_array(
            json_object(
              'name', selection_arguments.name,
              'value', selection_arguments.value
            )
          ) AS arguments
        FROM selection_arguments
          JOIN selections ON selection_arguments.selection_id = selections.id
          JOIN selection_refs ON selection_refs.child_id = selections.id
        WHERE
          selection_refs."document" IN %s
        GROUP BY selection_arguments.selection_id
      ),
      selection_tree AS (
        -- Base case: root selections (those with a selection_ref that has no parent)
        SELECT 
          selections.id,
          selections.field_name,
          selections.alias,
          selections.kind,
          d.id AS document_id,
          d.name AS document_name,
          1 AS level,
          selections.alias AS path,
          NULL AS parent_id,
          a.arguments,
          dct.directives
        FROM selections
        JOIN selection_refs 
          ON selection_refs.child_id = selections.id 
         AND selection_refs.parent_id IS NULL
        LEFT JOIN documents d 
          ON d.id = selection_refs.document
        LEFT JOIN directives_agg dct 
          ON dct.selection_id = selections.id
        LEFT JOIN arguments_agg a 
          ON a.selection_id = selections.id
        WHERE d.id IN %s
      
        UNION ALL
      
        -- Recursive case: child selections
        SELECT 
          selections.id,
          selections.field_name,
          selections.alias,
          selections.kind,
          st.document_id AS document_id,
          st.document_name AS document_name,
          st.level + 1 AS level,
          st.path || ',' || selections.alias AS path,
          st.id AS parent_id,
          a.arguments,
          dct.directives
        FROM selections
        JOIN selection_refs ON selection_refs.child_id = selections.id AND selection_refs.document IN %s
        JOIN selection_tree st ON selection_refs.parent_id = st.id
        LEFT JOIN directives_agg dct ON dct.selection_id = selections.id
        LEFT JOIN arguments_agg a ON a.selection_id = selections.id
      )
    SELECT document_name, kind, field_name, alias, path, arguments, directives, parent_id, document_id FROM selection_tree
  `, whereIn, whereIn, whereIn, whereIn, whereIn))
	if err != nil {
		return nil, err
	}

	return &CollectStatements{
		PrintSearch: printSearch,
	}, nil
}

func (s *CollectStatements) Finalize() {
	s.PrintSearch.Finalize()
}

type CollectedDocument struct {
	ID                  int64
	Name                string
	Kind                string // "query", "mutation", "subscription", or "fragment"
	TypeCondition       *string
	Variables           []CollectedOperationVariable
	Selections          []CollectedSelection
	Directives          []CollectedDirective
	ReferencedFragments []int64
}

type CollectedSelection struct {
	FieldName  string
	Alias      *string
	PathIndex  int
	Kind       string // "field", "fragment", "inline_fragment", etc.
	Arguments  []CollectedArgument
	Directives []CollectedDirective
	Children   []CollectedSelection
}

type CollectedOperationVariable struct {
	Document      int
	Name          string
	Type          string
	TypeModifiers string
	DefaultValue  *CollectedArgumentValue
	Directives    []CollectedDirective
}

type CollectedArgument struct {
	ID    int64
	Name  string
	Value *CollectedArgumentValue
}

type CollectedArgumentValue struct {
	Kind     string
	Raw      string
	Children []CollectedArgumentValueChildren
}

type CollectedArgumentValueChildren struct {
	Name  string
	Value *CollectedArgumentValue
}

type CollectedDirectiveArgument struct {
	Name  string
	Value *CollectedArgumentValue
}

type CollectedDirective struct {
	Name      string
	Arguments []CollectedDirectiveArgument
}
