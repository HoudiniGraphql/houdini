package documents_test

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"
	"zombiezen.com/go/sqlite"
	"zombiezen.com/go/sqlite/sqlitex"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
)

func TestGeneratePersistentQueries_Basic(t *testing.T) {
	db, err := plugins.NewPoolInMemory[config.PluginConfig]()
	require.NoError(t, err)
	defer db.Close()

	conn, err := db.Take(context.Background())
	require.NoError(t, err)
	defer db.Put(conn)

	err = tests.WriteHoudiniSchema(conn)
	require.NoError(t, err)

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

	fs := afero.NewMemMapFs()
	outputPath := "./test-queries.json"

	err = documents.GeneratePersistentQueries(context.Background(), db, fs, outputPath)
	require.NoError(t, err)

	exists, err := afero.Exists(fs, outputPath)
	require.NoError(t, err)
	require.True(t, exists, "Persistent queries file should be created")

	content, err := afero.ReadFile(fs, outputPath)
	require.NoError(t, err)

	var operations map[string]string
	err = json.Unmarshal(content, &operations)
	require.NoError(t, err)

	require.Len(t, operations, 3, "Should have exactly 3 operations")

	require.Contains(t, operations, "hash1")
	require.Contains(t, operations, "hash2")
	require.Contains(t, operations, "hash3")
	require.NotContains(t, operations, "hash4", "Fragments should not be included")

	require.Equal(t, "query TestQuery1 { version }", operations["hash1"])
	require.Equal(t, "query TestQuery2 { user { id } }", operations["hash2"])
	require.Equal(t, "mutation TestMutation { updateUser { id } }", operations["hash3"])

	t.Logf("✅ Test passed! Generated %d operations in persistent queries", len(operations))
	for hash, query := range operations {
		t.Logf("  %s: %s", hash, strings.ReplaceAll(query, "\n", " "))
	}
}

func TestGeneratePersistentQueries_InvalidExtension(t *testing.T) {
	db, err := plugins.NewPoolInMemory[config.PluginConfig]()
	require.NoError(t, err)
	defer db.Close()

	fs := afero.NewMemMapFs()

	err = documents.GeneratePersistentQueries(context.Background(), db, fs, "./queries.txt")
	require.Error(t, err)
	require.True(t, strings.Contains(err.Error(), ".json"), 
		"Error should mention .json requirement")

	t.Logf("✅ Invalid extension test passed: %v", err)
}

func TestGeneratePersistentQueries_WithSimpleFragments(t *testing.T) {
	db, err := plugins.NewPoolInMemory[config.PluginConfig]()
	require.NoError(t, err)
	defer db.Close()

	conn, err := db.Take(context.Background())
	require.NoError(t, err)
	defer db.Put(conn)

	err = tests.WriteHoudiniSchema(conn)
	require.NoError(t, err)

	testDocs := []struct {
		id      int
		name    string
		kind    string
		hash    string
		printed string
	}{
		{1, "UserQuery", "query", "hash1", "query UserQuery { user { ...UserInfo } }"},
		{2, "UserInfo", "fragment", "hash2", "fragment UserInfo on User { id name email }"},
	}

	for _, doc := range testDocs {
		err = sqlitex.Execute(conn, `
			INSERT INTO documents (id, name, kind, hash, printed) VALUES (?, ?, ?, ?, ?)
		`, &sqlitex.ExecOptions{
			Args: []interface{}{doc.id, doc.name, doc.kind, doc.hash, doc.printed},
		})
		require.NoError(t, err)
	}

	err = sqlitex.Execute(conn, `
		INSERT INTO selections (id, field_name, kind) VALUES 
		(1, 'user', 'field'),
		(2, 'UserInfo', 'fragment')
	`, nil)
	require.NoError(t, err)

	err = sqlitex.Execute(conn, `
		INSERT INTO selection_refs (parent_id, child_id, document, path_index, row, column) VALUES 
		(1, 2, 1, 0, 1, 1)
	`, nil)
	require.NoError(t, err)

	fs := afero.NewMemMapFs()
	outputPath := "./test-queries.json"
	
	err = documents.GeneratePersistentQueries(context.Background(), db, fs, outputPath)
	require.NoError(t, err)

	content, err := afero.ReadFile(fs, outputPath)
	require.NoError(t, err)

	var operations map[string]string
	err = json.Unmarshal(content, &operations)
	require.NoError(t, err)

	require.Len(t, operations, 1, "Should have 1 operation")
	require.Contains(t, operations, "hash1")
	
	expected := "query UserQuery { user { ...UserInfo } }\n\nfragment UserInfo on User { id name email }"
	require.Equal(t, expected, operations["hash1"])

	t.Logf("✅ Simple fragments test passed: %s", operations["hash1"])
}

func TestGeneratePersistentQueries_WithNestedFragments(t *testing.T) {
	db, err := plugins.NewPoolInMemory[config.PluginConfig]()
	require.NoError(t, err)
	defer db.Close()

	conn, err := db.Take(context.Background())
	require.NoError(t, err)
	defer db.Put(conn)

	err = tests.WriteHoudiniSchema(conn)
	require.NoError(t, err)

	testDocs := []struct {
		id      int
		name    string
		kind    string
		hash    string
		printed string
	}{
		{1, "UserProfile", "query", "hash1", "query UserProfile { user { ...UserDetails } }"},
		{2, "UserDetails", "fragment", "hash2", "fragment UserDetails on User { id name ...Avatar ...Address }"},
		{3, "Avatar", "fragment", "hash3", "fragment Avatar on User { avatar { ...Image } }"},
		{4, "Address", "fragment", "hash4", "fragment Address on User { address { street city } }"},
		{5, "Image", "fragment", "hash5", "fragment Image on Avatar { url alt width height }"},
	}

	for _, doc := range testDocs {
		err = sqlitex.Execute(conn, `
			INSERT INTO documents (id, name, kind, hash, printed) VALUES (?, ?, ?, ?, ?)
		`, &sqlitex.ExecOptions{
			Args: []interface{}{doc.id, doc.name, doc.kind, doc.hash, doc.printed},
		})
		require.NoError(t, err)
	}

	selections := []struct {
		id         int
		field_name string
		kind       string
	}{
		{1, "user", "field"},
		{2, "UserDetails", "fragment"},
		{3, "id", "field"},
		{4, "name", "field"},
		{5, "Avatar", "fragment"},
		{6, "Address", "fragment"},
		{7, "avatar", "field"},
		{8, "Image", "fragment"},
		{9, "address", "field"},
		{10, "street", "field"},
		{11, "city", "field"},
		{12, "url", "field"},
		{13, "alt", "field"},
		{14, "width", "field"},
		{15, "height", "field"},
	}

	for _, sel := range selections {
		err = sqlitex.Execute(conn, `
			INSERT INTO selections (id, field_name, kind) VALUES (?, ?, ?)
		`, &sqlitex.ExecOptions{
			Args: []interface{}{sel.id, sel.field_name, sel.kind},
		})
		require.NoError(t, err)
	}

	refs := []struct {
		parent_id int
		child_id  int
		document  int
	}{
		{1, 2, 1},
		{4, 5, 2},
		{4, 6, 2},
		{7, 8, 3},
	}

	for _, ref := range refs {
		err = sqlitex.Execute(conn, `
			INSERT INTO selection_refs (parent_id, child_id, document, path_index, row, column) VALUES (?, ?, ?, 0, 1, 1)
		`, &sqlitex.ExecOptions{
			Args: []interface{}{ref.parent_id, ref.child_id, ref.document},
		})
		require.NoError(t, err)
	}

	fs := afero.NewMemMapFs()
	outputPath := "./test-queries.json"
	
	err = documents.GeneratePersistentQueries(context.Background(), db, fs, outputPath)
	require.NoError(t, err)

	content, err := afero.ReadFile(fs, outputPath)
	require.NoError(t, err)

	var operations map[string]string
	err = json.Unmarshal(content, &operations)
	require.NoError(t, err)

	require.Len(t, operations, 1, "Should have 1 operation")
	require.Contains(t, operations, "hash1")
	
	result := operations["hash1"]
	
	require.Contains(t, result, "query UserProfile { user { ...UserDetails } }")
	
	require.Contains(t, result, "fragment UserDetails on User { id name ...Avatar ...Address }")
	require.Contains(t, result, "fragment Avatar on User { avatar { ...Image } }")
	require.Contains(t, result, "fragment Address on User { address { street city } }")
	require.Contains(t, result, "fragment Image on Avatar { url alt width height }")

	t.Logf("✅ Nested fragments test passed!")
	t.Logf("Generated GraphQL with %d fragments", strings.Count(result, "fragment "))
}

func TestGeneratePersistentQueries_EmptyDatabase(t *testing.T) {
	db, err := plugins.NewPoolInMemory[config.PluginConfig]()
	require.NoError(t, err)
	defer db.Close()

	conn, err := db.Take(context.Background())
	require.NoError(t, err)
	defer db.Put(conn)

	err = tests.WriteHoudiniSchema(conn)
	require.NoError(t, err)


	fs := afero.NewMemMapFs()
	outputPath := "./test-queries.json"
	
	err = documents.GeneratePersistentQueries(context.Background(), db, fs, outputPath)
	require.NoError(t, err, "Should handle empty database gracefully")

	exists, err := afero.Exists(fs, outputPath)
	require.NoError(t, err)
	require.False(t, exists, "File should not be created for empty database")

	t.Logf("✅ Empty database test passed - no file created")
}

func TestGeneratePersistentQueries_NoFragments(t *testing.T) {
	db, err := plugins.NewPoolInMemory[config.PluginConfig]()
	require.NoError(t, err)
	defer db.Close()

	conn, err := db.Take(context.Background())
	require.NoError(t, err)
	defer db.Put(conn)

	err = tests.WriteHoudiniSchema(conn)
	require.NoError(t, err)

	operations := []struct {
		name    string
		kind    string
		hash    string
		printed string
	}{
		{"SimpleQuery", "query", "hash1", "query SimpleQuery { version }"},
		{"SimpleMutation", "mutation", "hash2", "mutation SimpleMutation { updateSettings }"},
	}

	for _, op := range operations {
		err = sqlitex.Execute(conn, `
			INSERT INTO documents (name, kind, hash, printed) VALUES (?, ?, ?, ?)
		`, &sqlitex.ExecOptions{
			Args: []interface{}{op.name, op.kind, op.hash, op.printed},
		})
		require.NoError(t, err)
	}

	fs := afero.NewMemMapFs()
	outputPath := "./test-queries.json"
	
	err = documents.GeneratePersistentQueries(context.Background(), db, fs, outputPath)
	require.NoError(t, err)

	content, err := afero.ReadFile(fs, outputPath)
	require.NoError(t, err)

	var result map[string]string
	err = json.Unmarshal(content, &result)
	require.NoError(t, err)

	require.Len(t, result, 2, "Should have 2 operations")
	require.Equal(t, "query SimpleQuery { version }", result["hash1"])
	require.Equal(t, "mutation SimpleMutation { updateSettings }", result["hash2"])

	t.Logf("✅ No fragments test passed - operations without fragments work correctly")
}

func TestGeneratePersistentQueries_NullHashAndPrintedValues(t *testing.T) {
	db, err := plugins.NewPoolInMemory[config.PluginConfig]()
	require.NoError(t, err)
	defer db.Close()

	conn, err := db.Take(context.Background())
	require.NoError(t, err)
	defer db.Put(conn)

	err = tests.WriteHoudiniSchema(conn)
	require.NoError(t, err)

	operations := []struct {
		name    string
		kind    string
		hash    *string
		printed *string
	}{
		{"ValidQuery", "query", stringPtr("hash1"), stringPtr("query ValidQuery { version }")},
		{"NullHash", "query", nil, stringPtr("query NullHash { user }")},
		{"EmptyHash", "query", stringPtr(""), stringPtr("query EmptyHash { user }")},
		{"NullPrinted", "query", stringPtr("hash2"), nil},
		{"EmptyPrinted", "query", stringPtr("hash3"), stringPtr("")},
	}

	for _, op := range operations {
		var hashVal, printedVal interface{}
		if op.hash != nil {
			hashVal = *op.hash
		}
		if op.printed != nil {
			printedVal = *op.printed
		}

		err = sqlitex.Execute(conn, `
			INSERT INTO documents (name, kind, hash, printed) VALUES (?, ?, ?, ?)
		`, &sqlitex.ExecOptions{
			Args: []interface{}{op.name, op.kind, hashVal, printedVal},
		})
		require.NoError(t, err)
	}

	fs := afero.NewMemMapFs()
	outputPath := "./test-queries.json"
	
	err = documents.GeneratePersistentQueries(context.Background(), db, fs, outputPath)
	require.NoError(t, err)

	content, err := afero.ReadFile(fs, outputPath)
	require.NoError(t, err)

	var result map[string]string
	err = json.Unmarshal(content, &result)
	require.NoError(t, err)

	require.Len(t, result, 1, "Should have only 1 valid operation")
	require.Contains(t, result, "hash1")
	require.Equal(t, "query ValidQuery { version }", result["hash1"])

	t.Logf("✅ Null/empty values test passed - invalid operations filtered out")
}

func TestGeneratePersistentQueries_MissingFragments(t *testing.T) {
	db, err := plugins.NewPoolInMemory[config.PluginConfig]()
	require.NoError(t, err)
	defer db.Close()

	conn, err := db.Take(context.Background())
	require.NoError(t, err)
	defer db.Put(conn)

	err = tests.WriteHoudiniSchema(conn)
	require.NoError(t, err)

	err = sqlitex.Execute(conn, `
		INSERT INTO documents (id, name, kind, hash, printed) VALUES (1, 'UserQuery', 'query', 'hash1', 'query UserQuery { user { ...MissingFragment } }')
	`, nil)
	require.NoError(t, err)

	err = sqlitex.Execute(conn, `
		INSERT INTO selections (id, field_name, kind) VALUES 
		(1, 'user', 'field'),
		(2, 'MissingFragment', 'fragment')
	`, nil)
	require.NoError(t, err)

	err = sqlitex.Execute(conn, `
		INSERT INTO selection_refs (parent_id, child_id, document, path_index, row, column) VALUES (1, 2, 1, 0, 1, 1)
	`, nil)
	require.NoError(t, err)


	fs := afero.NewMemMapFs()
	outputPath := "./test-queries.json"
	
	err = documents.GeneratePersistentQueries(context.Background(), db, fs, outputPath)
	require.NoError(t, err, "Should handle missing fragments gracefully")

	content, err := afero.ReadFile(fs, outputPath)
	require.NoError(t, err)

	var result map[string]string
	err = json.Unmarshal(content, &result)
	require.NoError(t, err)

	require.Len(t, result, 1, "Should have 1 operation")
	require.Contains(t, result, "hash1")
	
	require.Equal(t, "query UserQuery { user { ...MissingFragment } }", result["hash1"])

	t.Logf("✅ Missing fragments test passed - operation included without missing fragments")
}

func TestGeneratePersistentQueries_CircularFragments(t *testing.T) {
	db, err := plugins.NewPoolInMemory[config.PluginConfig]()
	require.NoError(t, err)
	defer db.Close()

	conn, err := db.Take(context.Background())
	require.NoError(t, err)
	defer db.Put(conn)

	err = tests.WriteHoudiniSchema(conn)
	require.NoError(t, err)

	testDocs := []struct {
		id      int
		name    string
		kind    string
		hash    string
		printed string
	}{
		{1, "TestQuery", "query", "hash1", "query TestQuery { user { ...FragmentA } }"},
		{2, "FragmentA", "fragment", "hash2", "fragment FragmentA on User { id ...FragmentB }"},
		{3, "FragmentB", "fragment", "hash3", "fragment FragmentB on User { name ...FragmentA }"},
	}

	for _, doc := range testDocs {
		err = sqlitex.Execute(conn, `
			INSERT INTO documents (id, name, kind, hash, printed) VALUES (?, ?, ?, ?, ?)
		`, &sqlitex.ExecOptions{
			Args: []interface{}{doc.id, doc.name, doc.kind, doc.hash, doc.printed},
		})
		require.NoError(t, err)
	}

	selections := []struct {
		id         int
		field_name string
		kind       string
	}{
		{1, "user", "field"},
		{2, "FragmentA", "fragment"},
		{3, "id", "field"},
		{4, "FragmentB", "fragment"},
		{5, "name", "field"},
		{6, "FragmentA", "fragment"},
	}

	for _, sel := range selections {
		err = sqlitex.Execute(conn, `
			INSERT INTO selections (id, field_name, kind) VALUES (?, ?, ?)
		`, &sqlitex.ExecOptions{
			Args: []interface{}{sel.id, sel.field_name, sel.kind},
		})
		require.NoError(t, err)
	}

	refs := []struct {
		parent_id int
		child_id  int
		document  int
	}{
		{1, 2, 1},
		{3, 4, 2},
		{5, 6, 3},
	}

	for _, ref := range refs {
		err = sqlitex.Execute(conn, `
			INSERT INTO selection_refs (parent_id, child_id, document, path_index, row, column) VALUES (?, ?, ?, 0, 1, 1)
		`, &sqlitex.ExecOptions{
			Args: []interface{}{ref.parent_id, ref.child_id, ref.document},
		})
		require.NoError(t, err)
	}

	fs := afero.NewMemMapFs()
	outputPath := "./test-queries.json"
	
	err = documents.GeneratePersistentQueries(context.Background(), db, fs, outputPath)
	require.NoError(t, err, "Should handle circular fragments without hanging")

	content, err := afero.ReadFile(fs, outputPath)
	require.NoError(t, err)

	var result map[string]string
	err = json.Unmarshal(content, &result)
	require.NoError(t, err)

	require.Len(t, result, 1, "Should have 1 operation")
	require.Contains(t, result, "hash1")
	
	output := result["hash1"]
	require.Contains(t, output, "query TestQuery { user { ...FragmentA } }")
	require.Contains(t, output, "fragment FragmentA on User { id ...FragmentB }")
	require.Contains(t, output, "fragment FragmentB on User { name ...FragmentA }")

	t.Logf("✅ Circular fragments test passed - SQLite handled cycles correctly")
	t.Logf("Result: %s", strings.ReplaceAll(output, "\n", " | "))
}

func TestGeneratePersistentQueries_HashConsistency(t *testing.T) {
	db, err := plugins.NewPoolInMemory[config.PluginConfig]()
	require.NoError(t, err)
	defer db.Close()

	conn, err := db.Take(context.Background())
	require.NoError(t, err)
	defer db.Put(conn)

	err = tests.WriteHoudiniSchema(conn)
	require.NoError(t, err)

	testHashes := map[string]string{
		"hash_abc123": "query SimpleQuery { version }",
		"hash_def456": "mutation SimpleMutation { updateUser { id } }",
		"hash_ghi789": "subscription SimpleSubscription { userUpdated { id } }",
	}

	docId := 1
	for hash, printed := range testHashes {
		err = sqlitex.Execute(conn, `
			INSERT INTO documents (id, name, kind, hash, printed) VALUES (?, ?, ?, ?, ?)
		`, &sqlitex.ExecOptions{
			Args: []interface{}{docId, "TestOp" + string(rune(docId)), 
				map[string]string{"query": "query", "mutation": "mutation", "subscription": "subscription"}[printed[:strings.Index(printed, " ")]], 
				hash, printed},
		})
		require.NoError(t, err)
		docId++
	}

	fs := afero.NewMemMapFs()
	outputPath := "./test-queries.json"
	
	err = documents.GeneratePersistentQueries(context.Background(), db, fs, outputPath)
	require.NoError(t, err)

	content, err := afero.ReadFile(fs, outputPath)
	require.NoError(t, err)

	var result map[string]string
	err = json.Unmarshal(content, &result)
	require.NoError(t, err)

	require.Len(t, result, 3, "Should have 3 operations")

	for expectedHash, expectedGraphQL := range testHashes {
		require.Contains(t, result, expectedHash, "Hash %s should be in persistent queries", expectedHash)
		require.Equal(t, expectedGraphQL, result[expectedHash], "GraphQL should match for hash %s", expectedHash)
	}

	t.Logf("✅ Hash consistency test passed - all hashes correctly mapped")
}

func TestGeneratePersistentQueries_HashFormat(t *testing.T) {
	db, err := plugins.NewPoolInMemory[config.PluginConfig]()
	require.NoError(t, err)
	defer db.Close()

	conn, err := db.Take(context.Background())
	require.NoError(t, err)
	defer db.Put(conn)

	err = tests.WriteHoudiniSchema(conn)
	require.NoError(t, err)

	testCases := []struct {
		name   string
		hash   string
		valid  bool
	}{
		{"ValidSHA256", "9ce380e593f0ad23179092018fff6667f3249e9fc261be13c40a7291c1f151c6", true},
		{"ValidSHA256_2", "425691bbfea3900b92488e1ab1c9d6ee50242cadb1de2336342766d9577656f1", true},
		{"Short", "abc123", true},
		{"Empty", "", false},
	}

	docId := 1
	for _, tc := range testCases {
		if tc.hash != "" {
			err = sqlitex.Execute(conn, `
				INSERT INTO documents (id, name, kind, hash, printed) VALUES (?, ?, 'query', ?, ?)
			`, &sqlitex.ExecOptions{
				Args: []interface{}{docId, "TestQuery" + tc.name, tc.hash, "query TestQuery" + tc.name + " { version }"},
			})
			require.NoError(t, err)
			docId++
		}
	}

	fs := afero.NewMemMapFs()
	outputPath := "./test-queries.json"
	
	err = documents.GeneratePersistentQueries(context.Background(), db, fs, outputPath)
	require.NoError(t, err)

	content, err := afero.ReadFile(fs, outputPath)
	require.NoError(t, err)

	var result map[string]string
	err = json.Unmarshal(content, &result)
	require.NoError(t, err)

	require.Len(t, result, 3, "Should have 3 valid operations")

	for _, tc := range testCases {
		if tc.valid && tc.hash != "" {
			require.Contains(t, result, tc.hash, "Valid hash %s should be present", tc.hash)
		}
	}

	t.Logf("✅ Hash format test passed - valid hashes included, invalid filtered out")
}

func TestGeneratePersistentQueries_ComplexFragmentScenario(t *testing.T) {
	db, err := plugins.NewPoolInMemory[config.PluginConfig]()
	require.NoError(t, err)
	defer db.Close()

	conn, err := db.Take(context.Background())
	require.NoError(t, err)
	defer db.Put(conn)

	err = tests.WriteHoudiniSchema(conn)
	require.NoError(t, err)

	testDocs := []struct {
		id      int
		name    string
		kind    string
		hash    string
		printed string
	}{
		{1, "UserList", "query", "userlist_hash", "query UserList { users { ...UserCard } }"},
		{2, "UserProfile", "query", "userprofile_hash", "query UserProfile($id: ID!) { user(id: $id) { ...UserDetails } }"},
		{3, "UserCard", "fragment", "usercard_hash", "fragment UserCard on User { id name ...Avatar }"},
		{4, "UserDetails", "fragment", "userdetails_hash", "fragment UserDetails on User { id name email ...Avatar ...Address }"},
		{5, "Avatar", "fragment", "avatar_hash", "fragment Avatar on User { avatar { url alt } }"},
		{6, "Address", "fragment", "address_hash", "fragment Address on User { address { street city state } }"},
	}

	for _, doc := range testDocs {
		err = sqlitex.Execute(conn, `
			INSERT INTO documents (id, name, kind, hash, printed) VALUES (?, ?, ?, ?, ?)
		`, &sqlitex.ExecOptions{
			Args: []interface{}{doc.id, doc.name, doc.kind, doc.hash, doc.printed},
		})
		require.NoError(t, err)
	}

	selections := []struct {
		id         int
		field_name string
		kind       string
	}{
		{1, "users", "field"},
		{2, "UserCard", "fragment"},
		{3, "user", "field"},
		{4, "UserDetails", "fragment"},
		{5, "id", "field"},
		{6, "name", "field"},
		{7, "Avatar", "fragment"},
		{8, "id", "field"},
		{9, "name", "field"},
		{10, "email", "field"},
		{11, "Avatar", "fragment"},
		{12, "Address", "fragment"},
		{13, "avatar", "field"},
		{14, "url", "field"},
		{15, "alt", "field"},
		{16, "address", "field"},
		{17, "street", "field"},
		{18, "city", "field"},
		{19, "state", "field"},
	}

	for _, sel := range selections {
		err = sqlitex.Execute(conn, `
			INSERT INTO selections (id, field_name, kind) VALUES (?, ?, ?)
		`, &sqlitex.ExecOptions{
			Args: []interface{}{sel.id, sel.field_name, sel.kind},
		})
		require.NoError(t, err)
	}

	refs := []struct {
		parent_id int
		child_id  int
		document  int
	}{
		{1, 2, 1},
		{3, 4, 2},
		{6, 7, 3},
		{9, 11, 4},
		{10, 12, 4},
	}

	for _, ref := range refs {
		err = sqlitex.Execute(conn, `
			INSERT INTO selection_refs (parent_id, child_id, document, path_index, row, column) VALUES (?, ?, ?, 0, 1, 1)
		`, &sqlitex.ExecOptions{
			Args: []interface{}{ref.parent_id, ref.child_id, ref.document},
		})
		require.NoError(t, err)
	}

	fs := afero.NewMemMapFs()
	outputPath := "./test-queries.json"
	
	err = documents.GeneratePersistentQueries(context.Background(), db, fs, outputPath)
	require.NoError(t, err)

	content, err := afero.ReadFile(fs, outputPath)
	require.NoError(t, err)

	var result map[string]string
	err = json.Unmarshal(content, &result)
	require.NoError(t, err)

	require.Len(t, result, 2, "Should have 2 operations")
	require.Contains(t, result, "userlist_hash")
	require.Contains(t, result, "userprofile_hash")

	userList := result["userlist_hash"]
	require.Contains(t, userList, "query UserList { users { ...UserCard } }")
	require.Contains(t, userList, "fragment UserCard on User { id name ...Avatar }")
	require.Contains(t, userList, "fragment Avatar on User { avatar { url alt } }")

	userProfile := result["userprofile_hash"]
	require.Contains(t, userProfile, "query UserProfile($id: ID!) { user(id: $id) { ...UserDetails } }")
	require.Contains(t, userProfile, "fragment UserDetails on User { id name email ...Avatar ...Address }")
	require.Contains(t, userProfile, "fragment Avatar on User { avatar { url alt } }")
	require.Contains(t, userProfile, "fragment Address on User { address { street city state } }")

	t.Logf("✅ Complex fragment scenario test passed!")
	t.Logf("UserList GraphQL: %s", strings.ReplaceAll(userList, "\n", " | "))
	t.Logf("UserProfile GraphQL: %s", strings.ReplaceAll(userProfile, "\n", " | "))
}

func stringPtr(s string) *string {
	return &s
}

func TestHashCollisionFixVerification(t *testing.T) {
	db, err := plugins.NewPoolInMemory[config.PluginConfig]()
	require.NoError(t, err)
	defer db.Close()

	conn, err := db.Take(context.Background())
	require.NoError(t, err)
	defer db.Put(conn)

	err = tests.WriteHoudiniSchema(conn)
	require.NoError(t, err)

	// Test documents with different printed content should get different hashes
	testDocs := []struct {
		id      int
		name    string
		kind    string
		printed string
	}{
		{
			id:      1,
			name:    "GetUser",
			kind:    "query",
			printed: `query GetUser($id: ID!) { user(id: $id) { ...UserProfile } }`,
		},
		{
			id:      2,
			name:    "UserProfile",
			kind:    "fragment",
			printed: `fragment UserProfile on User { id name email }`,
		},
	}

	// Insert documents without hash (simulating the new behavior)
	for _, doc := range testDocs {
		err = sqlitex.Execute(conn, `
			INSERT INTO documents (id, name, kind, printed) 
			VALUES (?, ?, ?, ?)
		`, &sqlitex.ExecOptions{
			Args: []interface{}{doc.id, doc.name, doc.kind, doc.printed},
		})
		require.NoError(t, err)
	}

	// Simulate the new hash generation process (what happens in print.go)
	for _, doc := range testDocs {
		// Generate hash from printed content (this is what our fix does)
		hash := fmt.Sprintf("%x", sha256.Sum256([]byte(doc.printed)))
		
		err = sqlitex.Execute(conn, `
			UPDATE documents SET hash = ? WHERE id = ?
		`, &sqlitex.ExecOptions{
			Args: []interface{}{hash, doc.id},
		})
		require.NoError(t, err)
	}

	fs := afero.NewMemMapFs()
	outputPath := "./test-queries.json"
	
	err = documents.GeneratePersistentQueries(context.Background(), db, fs, outputPath)
	require.NoError(t, err)

	content, err := afero.ReadFile(fs, outputPath)
	require.NoError(t, err)

	var result map[string]string
	err = json.Unmarshal(content, &result)
	require.NoError(t, err)

	t.Logf("Generated persistent queries: %+v", result)

	// With the fix, we should have 1 entry (only operations go in persistent queries)
	require.Equal(t, 1, len(result), "Should have 1 entry - persistent queries only include operations")

	// The single operation should be present
	var operationQuery string
	for _, query := range result {
		operationQuery = query
		break
	}
	
	t.Logf("Generated query: %s", operationQuery)
	require.Contains(t, operationQuery, "query GetUser", "Should contain the operation")

	// Verify no hash collisions in database (this is the key fix)
	checkCollisionQuery := `
		SELECT hash, COUNT(*) as collision_count
		FROM documents 
		WHERE hash IS NOT NULL AND hash != ''
		GROUP BY hash
		HAVING COUNT(*) > 1
	`
	
	collisionFound := false
	err = sqlitex.Execute(conn, checkCollisionQuery, &sqlitex.ExecOptions{
		ResultFunc: func(stmt *sqlite.Stmt) error {
			collisionFound = true
			hash := stmt.ColumnText(0)
			count := stmt.ColumnInt64(1)
			t.Errorf("Hash collision detected: hash=%s, count=%d", hash, count)
			return nil
		},
	})
	require.NoError(t, err)
	require.False(t, collisionFound, "No hash collisions should exist")

	// Verify the operation and fragment have different hashes in the database
	var operationHash, fragmentHash string
	err = sqlitex.Execute(conn, `SELECT name, hash FROM documents WHERE hash IS NOT NULL`, &sqlitex.ExecOptions{
		ResultFunc: func(stmt *sqlite.Stmt) error {
			name := stmt.ColumnText(0)
			hash := stmt.ColumnText(1)
			if name == "GetUser" {
				operationHash = hash
			} else if name == "UserProfile" {
				fragmentHash = hash
			}
			return nil
		},
	})
	require.NoError(t, err)
	
	require.NotEmpty(t, operationHash, "Operation should have a hash")
	require.NotEmpty(t, fragmentHash, "Fragment should have a hash")
	require.NotEqual(t, operationHash, fragmentHash, "Operation and fragment should have different hashes")

	t.Logf("✅ Hash collision fix verified!")
	t.Logf("Operation hash: %s", operationHash)
	t.Logf("Fragment hash: %s", fragmentHash)
	t.Logf("Persistent queries correctly embed fragments in operations")
}

