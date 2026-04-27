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

	// Load all fragment spreads for every document in one flat query, then
	// walk the spread graph in memory to find every fragment each document
	// depends on (directly or through other fragments). This avoids a recursive
	// UNION CTE with a large IN clause (400+ items), which SQLite executes slowly.
	docToDirectFrags := make(map[string][]string) // doc_id/name → direct fragment spreads
	err = sqlitex.Execute(conn, `
		SELECT d.id, d.name, d.kind, s.field_name
		FROM selections s
		JOIN selection_refs sr ON s.id = sr.child_id
		JOIN documents d ON sr.document = d.id
		WHERE s.kind = 'fragment'
	`, &sqlitex.ExecOptions{
		ResultFunc: func(stmt *sqlite.Stmt) error {
			docID := stmt.ColumnText(0)
			docName := stmt.ColumnText(1)
			kind := stmt.ColumnText(2)
			fragName := stmt.ColumnText(3)
			if kind == "fragment" {
				docToDirectFrags[docName] = append(docToDirectFrags[docName], fragName)
			} else {
				docToDirectFrags[docID] = append(docToDirectFrags[docID], fragName)
			}
			return nil
		},
	})
	if err != nil {
		return nil, plugins.WrapError(err)
	}

	// For each operation, BFS the fragment dependency graph to find the transitive set.
	for _, op := range operations {
		seen := make(map[string]bool)
		queue := docToDirectFrags[op.ID]
		for len(queue) > 0 {
			name := queue[0]
			queue = queue[1:]
			if seen[name] {
				continue
			}
			seen[name] = true
			queue = append(queue, docToDirectFrags[name]...)
		}

		var fragmentDefinitions []string
		for name := range seen {
			if frag := fragments[name]; frag != nil {
				fragmentDefinitions = append(fragmentDefinitions, frag.Printed)
			}
		}

		completeGraphQL := op.Printed
		if len(fragmentDefinitions) > 0 {
			completeGraphQL += "\n\n" + strings.Join(fragmentDefinitions, "\n\n")
		}

		queryMap[op.Hash] = completeGraphQL
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
