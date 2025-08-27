package documents

import (
	"context"
	"encoding/json"
	"strings"

	"code.houdinigraphql.com/plugins"
	"github.com/spf13/afero"
	"zombiezen.com/go/sqlite"
	"zombiezen.com/go/sqlite/sqlitex"
)

type OperationDoc struct {
	ID      string
	Name    string
	Kind    string
	Hash    string
	Printed string
}

func GeneratePersistentQueries(ctx context.Context, db plugins.DatabasePool[any], fs afero.Fs, outputPath string) error {

	if !strings.HasSuffix(outputPath, ".json") {
		return &plugins.Error{
			Message: "Can write Persisted Queries only in a \".json\" file.",
		}
	}

	conn, err := db.Take(ctx)
	if err != nil {
		return plugins.WrapError(err)
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
		return plugins.WrapError(err)
	}

	for _, op := range operations {
		// Get all fragment dependencies
		fragmentNames := []string{}
		err = sqlitex.Execute(conn, `
			WITH RECURSIVE fragment_deps AS (
				-- Direct fragments used by this operation
				SELECT DISTINCT s.field_name as fragment_name
				FROM selections s 
				JOIN selection_refs sr ON s.id = sr.child_id 
				WHERE sr.document = ? AND s.kind = 'fragment'
				
				UNION
				
				-- Fragments used by other fragments (recursive)
				SELECT DISTINCT s.field_name
				FROM selections s
				JOIN selection_refs sr ON s.id = sr.child_id
				JOIN documents d ON sr.document = d.id
				JOIN fragment_deps fd ON d.name = fd.fragment_name
				WHERE s.kind = 'fragment' AND d.kind = 'fragment'
			)
			SELECT DISTINCT fragment_name FROM fragment_deps
			ORDER BY fragment_name
		`, &sqlitex.ExecOptions{
			Args: []interface{}{op.ID},
			ResultFunc: func(stmt *sqlite.Stmt) error {
				fragmentName := stmt.ColumnText(0)
				fragmentNames = append(fragmentNames, fragmentName)
				return nil
			},
		})
		if err != nil {
			return plugins.WrapError(err)
		}

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
		return plugins.WrapError(err)
	}

	if len(queryMap) == 0 {
		return nil
	}


	jsonData, err := json.MarshalIndent(queryMap, "", "    ")
	if err != nil {
		return plugins.WrapError(err)
	}

	err = afero.WriteFile(fs, outputPath, jsonData, 0644)
	if err != nil {
		return plugins.WrapError(err)
	}

	return nil
}
