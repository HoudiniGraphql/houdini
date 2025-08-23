package documents

import (
	"context"
	"encoding/json"
	"log"
	"strings"

	"github.com/spf13/afero"
	"zombiezen.com/go/sqlite"
	"zombiezen.com/go/sqlite/sqlitex"
	"code.houdinigraphql.com/plugins"
)

// Data structures for persistent queries
type OperationDoc struct {
	ID      string
	Name    string
	Kind    string
	Hash    string
	Printed string
}


func GeneratePersistentQueries(ctx context.Context, db plugins.DatabasePool[any], fs afero.Fs, outputPath string) error {
	log.Println("Generating persistent queries to:", outputPath)
	
	// Validate output path
	if !strings.HasSuffix(outputPath, ".json") {
		return &plugins.Error{
			Message: "Can write Persisted Queries only in a \".json\" file.",
		}
	}
	
	// Get database connection
	conn, err := db.Take(ctx)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer db.Put(conn)
	
	// Use SQL-based approach to resolve fragment dependencies from database relations
	queryMap := make(map[string]string)
	
	// Get all operations (queries, mutations, subscriptions) with their hashes and content
	operations := make(map[string]*OperationDoc)
	err = sqlitex.Execute(conn, `
		SELECT d.id, d.name, d.kind, d.hash, d.printed
		FROM documents d
		WHERE d.kind IN ('query', 'mutation', 'subscription') 
			AND d.hash IS NOT NULL 
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

	// For each operation, resolve all fragment dependencies and build complete GraphQL
	for _, op := range operations {
		// Get all fragment dependencies for this operation using recursive CTE
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
			err = sqlitex.Execute(conn, `
				SELECT printed
				FROM documents
				WHERE name = ? AND kind = 'fragment'
					AND printed IS NOT NULL AND printed != ''
			`, &sqlitex.ExecOptions{
				Args: []interface{}{fragmentName},
				ResultFunc: func(stmt *sqlite.Stmt) error {
					printed := stmt.ColumnText(0)
					fragmentDefinitions = append(fragmentDefinitions, printed)
					return nil
				},
			})
			if err != nil {
				return plugins.WrapError(err)
			}
		}

		// Build complete GraphQL: operation + all fragment definitions
		completeGraphQL := op.Printed
		if len(fragmentDefinitions) > 0 {
			completeGraphQL += "\n\n" + strings.Join(fragmentDefinitions, "\n\n")
		}

		// Add to queryMap using the operation's hash
		queryMap[op.Hash] = completeGraphQL
	}

	log.Printf("Found %d operations for persistent queries", len(queryMap))
	if err != nil {
		return plugins.WrapError(err)
	}
	
	// If no operations found, don't write anything
	if len(queryMap) == 0 {
		log.Println("No operations found, skipping persistent queries generation")
		return nil
	}
	
	log.Printf("Found %d operations for persistent queries", len(queryMap))
	
	// Convert to JSON with pretty formatting (matching TypeScript implementation)
	jsonData, err := json.MarshalIndent(queryMap, "", "    ")
	if err != nil {
		return plugins.WrapError(err)
	}
	
	// Write to file
	err = afero.WriteFile(fs, outputPath, jsonData, 0644)
	if err != nil {
		return plugins.WrapError(err)
	}
	
	log.Printf("Successfully wrote persistent queries to: %s", outputPath)
	return nil
}
