package documents_test

import (
	"context"
	"encoding/json"
	"path"
	"regexp"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins/tests"
)

func TestPersistentQueriesBasicOperations(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig]{
		Schema: `
			type Query {
				user(id: ID!): User!
				version: Int!
			}
			
			type Mutation {
				updateUser: User!
			}
			
			type User {
				id: ID!
				name: String!
				email: String!
			}
		`,
		PerformTest: func(t *testing.T, p *plugin.HoudiniCore, test tests.Test[config.PluginConfig]) {
			// Run the complete REAL generation pipeline
			result, err := runFullGeneration(t, p, test)
			if err != nil {
				return
			}

			// Test that we have the expected number of operations
			require.Equal(
				t,
				2,
				len(result),
				"Should have 2 operations (query and mutation, not fragment)",
			)
		},
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "Basic operations only",
				Pass: true,
				Input: []string{
					`query TestQuery { version }`,
					`mutation TestMutation { updateUser { id } }`,
					`fragment TestFragment on User { name }`,
				},
			},
		},
	})
}

func TestPersistentQueriesFragmentEmbedding(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig]{
		Schema: `
			type Query {
				user(id: ID!): User!
				version: Int!
			}
			
			type Mutation {
				updateUser: User!
			}
			
			type User {
				id: ID!
				name: String!
				email: String!
			}
		`,
		PerformTest: func(t *testing.T, p *plugin.HoudiniCore, test tests.Test[config.PluginConfig]) {
			// Run the complete REAL generation pipeline
			result, err := runFullGeneration(t, p, test)
			if err != nil {
				return
			}

			// Test fragment embedding
			require.Equal(t, 1, len(result), "Should have 1 operation")
			for _, query := range result {
				require.Contains(
					t,
					query,
					"fragment ",
					"Operation should contain embedded fragment",
				)
				require.Contains(t, query, "query GetUser")
				require.Contains(t, query, "fragment UserProfile on User")
				require.Contains(t, query, "id")
				require.Contains(t, query, "name")
				require.Contains(t, query, "email")
			}
		},
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "Operation with fragments",
				Pass: true,
				Input: []string{
					`
					query GetUser($id: ID!) { 
						user(id: $id) { 
							...UserProfile 
						} 
					}
					
					fragment UserProfile on User { 
						id 
						name 
						email 
					}
					`,
				},
			},
		},
	})
}

func TestPersistentQueriesArtifactHashConsistency(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig]{
		Schema: `
			type Query {
				user(id: ID!): User!
				version: Int!
			}
			
			type Mutation {
				updateUser: User!
			}
			
			type User {
				id: ID!
				name: String!
				email: String!
			}
		`,
		PerformTest: func(t *testing.T, p *plugin.HoudiniCore, test tests.Test[config.PluginConfig]) {
			// Run the complete REAL generation pipeline
			result, err := runFullGeneration(t, p, test)
			if err != nil {
				return
			}

			// Test hash consistency between persistent queries JSON and artifact files
			projectConfig, err := p.DB.ProjectConfig(context.Background())
			require.NoError(t, err)

			artifactDir := path.Join(
				projectConfig.ProjectRoot,
				projectConfig.RuntimeDir,
				"artifacts",
			)

			// For each hash in persistent queries, find corresponding artifact and compare hash
			for hash, query := range result {
				// Extract operation name from the query to match artifact filename
				opNameRegex := regexp.MustCompile(`(?:query|mutation|subscription)\s+(\w+)`)
				matches := opNameRegex.FindStringSubmatch(query)
				require.True(
					t,
					len(matches) >= 2,
					"Should be able to extract operation name from: %s",
					query,
				)

				operationName := matches[1]
				artifactPath := path.Join(artifactDir, operationName+".js")

				// Read the artifact file
				exists, err := afero.Exists(p.Fs, artifactPath)
				require.NoError(t, err)
				require.True(t, exists, "Artifact file should exist: %s", artifactPath)

				artifactContent, err := afero.ReadFile(p.Fs, artifactPath)
				require.NoError(t, err)

				// Extract hash from artifact - it's in "hash": "value" format (64 hex chars for SHA256)
				hashRegex := regexp.MustCompile(`"hash":\s*"([a-f0-9]{64})"`)
				hashMatches := hashRegex.FindStringSubmatch(string(artifactContent))
				require.True(
					t,
					len(hashMatches) >= 2,
					"Should be able to extract hash from artifact: %s",
					artifactPath,
				)

				artifactHash := hashMatches[1]

				// Verify the hashes match
				require.Equal(
					t,
					hash,
					artifactHash,
					"Hash mismatch between persistent queries (%s) and artifact (%s) for operation %s",
					hash,
					artifactHash,
					operationName,
				)
			}
		},
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "Artifact hash consistency",
				Pass: true,
				Input: []string{
					`query ArtifactHashTest { user(id: "test") { name email } }`,
					`mutation ArtifactMutationTest { updateUser { id name } }`,
				},
			},
		},
	})
}

func runFullGeneration(
	t *testing.T,
	p *plugin.HoudiniCore,
	test tests.Test[config.PluginConfig],
) (map[string]string, error) {
	// Run the complete REAL pipeline that users actually use
	err := p.AfterExtract(context.Background())
	if err != nil {
		require.False(t, test.Pass, err.Error())
		return nil, err
	}

	err = p.Validate(context.Background())
	if err != nil {
		require.False(t, test.Pass, err.Error())
		return nil, err
	}

	err = p.AfterValidate(context.Background())
	if err != nil {
		require.False(t, test.Pass, err.Error())
		return nil, err
	}

	// Set up the persistent queries path for testing
	projectConfig, err := p.DB.ProjectConfig(context.Background())
	require.NoError(t, err)

	testPersistentQueriesPath := "./test-queries.json"
	projectConfig.PersistedQueriesPath = testPersistentQueriesPath
	p.DB.SetProjectConfig(projectConfig)

	// Use the REAL generation function instead of manual steps
	// First generate documents/artifacts to ensure hashing is done
	_, err = p.GenerateDocuments(context.Background())
	if err != nil {
		require.False(t, test.Pass, err.Error())
		return nil, err
	}

	// Then generate runtime which includes persistent queries
	_, err = p.GenerateRuntime(context.Background())
	if err != nil {
		require.False(t, test.Pass, err.Error())
		return nil, err
	}

	// Read the REAL persistent queries that got generated
	fullPath := path.Join(projectConfig.ProjectRoot, testPersistentQueriesPath)
	content, err := afero.ReadFile(p.Fs, fullPath)
	require.NoError(t, err)

	var result map[string]string
	err = json.Unmarshal(content, &result)
	require.NoError(t, err)

	// Verify no hash collisions in the database
	verifyNoHashCollisions(t, p)

	return result, nil
}

func verifyNoHashCollisions(t *testing.T, p *plugin.HoudiniCore) {
	conn, err := p.DB.Take(context.Background())
	require.NoError(t, err)
	defer p.DB.Put(conn)

	collisionQuery, err := conn.Prepare(`
		SELECT hash, COUNT(*) as collision_count, GROUP_CONCAT(name) as names
		FROM documents 
		WHERE hash IS NOT NULL AND hash != ''
		GROUP BY hash
		HAVING COUNT(*) > 1
	`)
	require.NoError(t, err)
	defer collisionQuery.Finalize()

	collisionFound := false
	err = p.DB.StepStatement(context.Background(), collisionQuery, func() {
		collisionFound = true
		hash := collisionQuery.GetText("hash")
		count := collisionQuery.GetInt64("collision_count")
		names := collisionQuery.GetText("names")
		t.Errorf("Hash collision detected: hash=%s, count=%d, documents=%s", hash, count, names)
	})
	require.NoError(t, err)
	require.False(t, collisionFound, "No hash collisions should exist in production pipeline")
}
