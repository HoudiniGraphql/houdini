package documents_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"
	"zombiezen.com/go/sqlite/sqlitex"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
)

// Manual test that you can run directly
func TestGeneratePersistentQueries_Basic(t *testing.T) {
	// Create in-memory database using proper pool
	db, err := plugins.NewPoolInMemory[config.PluginConfig]()
	require.NoError(t, err)
	defer db.Close()

	// Get connection and create schema
	conn, err := db.Take(context.Background())
	require.NoError(t, err)
	defer db.Put(conn)

	// Create Houdini schema
	err = tests.WriteHoudiniSchema(conn)
	require.NoError(t, err)

	// Insert test data
	testDocs := []struct {
		name    string
		kind    string
		hash    string
		printed string
	}{
		{"TestQuery1", "query", "hash1", "query TestQuery1 { version }"},
		{"TestQuery2", "query", "hash2", "query TestQuery2 { user { id } }"},
		{"TestMutation", "mutation", "hash3", "mutation TestMutation { updateUser { id } }"},
		{"TestFragment", "fragment", "hash4", "fragment TestFragment on User { name }"},
	}

	for _, doc := range testDocs {
		err = sqlitex.Execute(conn, `
			INSERT INTO documents (name, kind, hash, printed) VALUES (?, ?, ?, ?)
		`, &sqlitex.ExecOptions{
			Args: []interface{}{doc.name, doc.kind, doc.hash, doc.printed},
		})
		require.NoError(t, err)
	}

	// Create filesystem
	fs := afero.NewMemMapFs()
	outputPath := "./test-queries.json"

	// Test the function
	err = documents.GeneratePersistentQueries(context.Background(), db, fs, outputPath)
	require.NoError(t, err)

	// Verify file was created
	exists, err := afero.Exists(fs, outputPath)
	require.NoError(t, err)
	require.True(t, exists, "Persistent queries file should be created")

	// Read and verify content
	content, err := afero.ReadFile(fs, outputPath)
	require.NoError(t, err)

	var operations map[string]string
	err = json.Unmarshal(content, &operations)
	require.NoError(t, err)

	// Should have 3 operations (2 queries + 1 mutation), fragments excluded
	require.Len(t, operations, 3, "Should have exactly 3 operations")

	// Verify correct operations are included
	require.Contains(t, operations, "hash1")
	require.Contains(t, operations, "hash2")
	require.Contains(t, operations, "hash3")
	require.NotContains(t, operations, "hash4", "Fragments should not be included")

	// Verify content matches
	require.Equal(t, "query TestQuery1 { version }", operations["hash1"])
	require.Equal(t, "query TestQuery2 { user { id } }", operations["hash2"])
	require.Equal(t, "mutation TestMutation { updateUser { id } }", operations["hash3"])

	t.Logf("✅ Test passed! Generated %d operations in persistent queries", len(operations))
	for hash, query := range operations {
		t.Logf("  %s: %s", hash, strings.ReplaceAll(query, "\n", " "))
	}
}

func TestGeneratePersistentQueries_InvalidExtension(t *testing.T) {
	// Create minimal database
	db, err := plugins.NewPoolInMemory[config.PluginConfig]()
	require.NoError(t, err)
	defer db.Close()

	fs := afero.NewMemMapFs()

	// Test invalid file extension
	err = documents.GeneratePersistentQueries(context.Background(), db, fs, "./queries.txt")
	require.Error(t, err)
	require.True(t, strings.Contains(err.Error(), ".json"), 
		"Error should mention .json requirement")

	t.Logf("✅ Invalid extension test passed: %v", err)
}

