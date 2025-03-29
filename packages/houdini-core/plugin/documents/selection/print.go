package selection

import (
	"context"
	"fmt"
	"strings"

	"zombiezen.com/go/sqlite"
)

func PrintDocument(
	ctx context.Context,
	conn *sqlite.Conn,
	documentID int64,
	statements *PrintStatements,
) (string, error) {
	return "", nil
}

type PrintStatements struct {
	PrintSearch *sqlite.Stmt
}

func PreparePrintStatements(conn *sqlite.Conn, nDocuments int) (*PrintStatements, error) {
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

	return &PrintStatements{
		PrintSearch: printSearch,
	}, nil
}

func (s *PrintStatements) Finalize() {
	s.PrintSearch.Finalize()
}
