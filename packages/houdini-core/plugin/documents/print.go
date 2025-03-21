package documents

import (
	"context"

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

func PreparePrintStatements(conn *sqlite.Conn) (*PrintStatements, error) {
	printSearch, err := conn.Prepare(`
    WITH directives_with_args AS (
        SELECT 
            selection_directives.selection_id,
            selection_directives.id AS directive_id,
            json_group_array(
                json_object(
                    'name', selection_directive_arguments."name", 
                    'value', selection_directive_arguments.value
                )
            ) AS arguments
        FROM selection_directives
        LEFT JOIN selection_directive_arguments ON selection_directive_arguments.parent = selection_directives.id
        GROUP BY selection_directives.id
    )
    SELECT 
        selections.field_name,
        selections.alias,
        
        CASE 
            WHEN selection_refs.child_id IS NULL THEN NULL
            ELSE json_group_array(DISTINCT selection_refs.child_id)
        END AS children,
        
        CASE 
            WHEN selection_arguments.selection_id IS NULL THEN NULL
            ELSE json_group_array(
                json_object(
                    'name', selection_arguments."name", 
                    'value', selection_arguments."value"
                )
            )
        END AS arguments,
        
        CASE 
            WHEN directives_with_args.directive_id IS NULL THEN NULL
            ELSE json_group_array(
                json_object(
                    'id', directives_with_args.directive_id,
                    'arguments', json(directives_with_args.arguments)
                )
            )
        END AS directives

    FROM selections
    LEFT JOIN selection_refs ON selection_refs.parent_id = selections.id 
    LEFT JOIN selection_arguments ON selection_arguments.selection_id = selections.id 
    LEFT JOIN directives_with_args ON directives_with_args.selection_id = selections.id

    GROUP BY selections.id
  `)
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
