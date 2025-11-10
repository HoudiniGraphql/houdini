package documents

import (
	"context"
	"encoding/json"
	"path/filepath"
	"strings"

	"github.com/spf13/afero"
	"zombiezen.com/go/sqlite"
	"zombiezen.com/go/sqlite/sqlitex"

	"code.houdinigraphql.com/plugins"
)

type OperationDoc struct {
	ID      string
	Name    string
	Kind    string
	Hash    string
	Printed string
}

func GeneratePersistentQueries(
	ctx context.Context,
	db plugins.DatabasePool[any],
	fs afero.Fs,
) ([]string, error) {
	projectConfig, err := db.ProjectConfig(ctx)
	if err != nil {
		return nil, err
	}

	persistedQueriesPath := projectConfig.PersistedQueriesPath
	outputPath := filepath.Join(projectConfig.ProjectRoot, persistedQueriesPath)

	if !strings.HasSuffix(outputPath, ".json") {
		return nil, &plugins.Error{
			Message: "Can write Persisted Queries only in a \".json\" file.",
		}
	}

	conn, err := db.Take(ctx)
	if err != nil {
		return nil, plugins.WrapError(err)
	}
	defer db.Put(conn)

	queryMap := make(map[string]string)

	// Get all operations (queries, mutations, subscriptions)
	operations := make(map[string]*OperationDoc)
	fragments := make(map[string]*OperationDoc)
	err = sqlitex.Execute(conn, `
		SELECT d.id, d.name, d.kind, d.hash, d.printed
		FROM documents d
		WHERE  d.hash IS NOT NULL 
			AND d.hash != ''
			AND d.printed IS NOT NULL
			AND d.printed != ''
	`, &sqlitex.ExecOptions{
		ResultFunc: func(stmt *sqlite.Stmt) error {
			id := stmt.ColumnText(0)
			name := stmt.ColumnText(1)
			kind := stmt.ColumnText(2)
			hash := stmt.ColumnText(3)
			printed := stmt.ColumnText(4)

			if kind == "fragment" {
				// named map for faster lookup
				fragments[name] = &OperationDoc{
					ID:      id,
					Name:    name,
					Kind:    kind,
					Hash:    hash,
					Printed: printed,
				}
				return nil
			}

			operations[id] = &OperationDoc{
				ID:      id,
				Name:    name,
				Kind:    kind,
				Hash:    hash,
				Printed: printed,
			}
			return nil
		},
	})
	if err != nil {
		return nil, plugins.WrapError(err)
	}

	// Batch query to get all fragment dependencies for all operations at once
	operationFragmentDeps := make(map[string][]string)

	// Create a list of operation IDs for the batch query
	operationIDs := make([]string, 0, len(operations))
	for _, op := range operations {
		operationIDs = append(operationIDs, op.ID)
	}

	// Build the batch query with placeholders
	placeholders := make([]string, len(operationIDs))
	for i := range operationIDs {
		placeholders[i] = "?"
	}
	whereIn := "(" + strings.Join(placeholders, ", ") + ")"

	// Execute the batch query to get all fragment dependencies
	batchQuery := `
		WITH RECURSIVE fragment_deps AS (
			-- Direct fragments used by operations
			SELECT DISTINCT sr.document as operation_id, s.field_name as fragment_name
			FROM selections s
			JOIN selection_refs sr ON s.id = sr.child_id
			WHERE sr.document IN ` + whereIn + ` AND s.kind = 'fragment'

			UNION

			-- Fragments used by other fragments (recursive)
			SELECT DISTINCT fd.operation_id, s.field_name
			FROM selections s
			JOIN selection_refs sr ON s.id = sr.child_id
			JOIN documents d ON sr.document = d.id
			JOIN fragment_deps fd ON d.name = fd.fragment_name
			WHERE s.kind = 'fragment' AND d.kind = 'fragment'
		)
		SELECT operation_id, fragment_name FROM fragment_deps
		ORDER BY operation_id, fragment_name
	`

	// Convert operation IDs to interface{} for the query
	args := make([]any, len(operationIDs))
	for i, id := range operationIDs {
		args[i] = id
	}

	err = sqlitex.Execute(conn, batchQuery, &sqlitex.ExecOptions{
		Args: args,
		ResultFunc: func(stmt *sqlite.Stmt) error {
			operationID := stmt.ColumnText(0)
			fragmentName := stmt.ColumnText(1)
			operationFragmentDeps[operationID] = append(operationFragmentDeps[operationID], fragmentName)
			return nil
		},
	})
	if err != nil {
		return nil, plugins.WrapError(err)
	}

	// Now process each operation using the batched fragment dependencies
	for _, op := range operations {
		fragmentNames := operationFragmentDeps[op.ID]

		// Get the printed content for all required fragments
		fragmentDefinitions := []string{}
		for _, fragmentName := range fragmentNames {
			// now we can use the named map
			frag := fragments[fragmentName]
			if frag == nil {
				continue
			}
			fragmentDefinitions = append(fragmentDefinitions, frag.Printed)
		}

		completeGraphQL := op.Printed
		if len(fragmentDefinitions) > 0 {
			completeGraphQL += "\n\n" + strings.Join(fragmentDefinitions, "\n\n")
		}

		queryMap[op.Hash] = completeGraphQL
	}

	if err != nil {
		return nil, plugins.WrapError(err)
	}

	if len(queryMap) == 0 {
		return nil, nil
	}

	jsonData, err := json.MarshalIndent(queryMap, "", "    ")
	if err != nil {
		return nil, plugins.WrapError(err)
	}

	err = afero.WriteFile(fs, outputPath, jsonData, 0644)
	if err != nil {
		return nil, plugins.WrapError(err)
	}

	return []string{
		strings.Replace(
			outputPath,
			filepath.Join(projectConfig.ProjectRoot, projectConfig.RuntimeDir),
			"$houdini",
			1,
		),
	}, nil
}
