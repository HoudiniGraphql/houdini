package schema_test

import (
	"context"
	"strings"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
)

func TestDefinitionGeneration(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig]{
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "generates runtime definitions for each enum",
				Input: []string{
					`query TestQuery { version }`,
				},
				Extra: map[string]any{
					"enumsTypesExact": `type ValuesOf<T> = T[keyof T]

export declare const TestEnum1: {
    /**
     * Documentation of Value1
    */
    readonly Value1: "Value1";
    /**
     * Documentation of Value2
    */
    readonly Value2: "Value2";
}

export type TestEnum1$options = ValuesOf<typeof TestEnum1>

/**
 * Documentation of testenum2
 */
export declare const TestEnum2: {
    readonly Value2: "Value2";
    readonly Value3: "Value3";
}

export type TestEnum2$options = ValuesOf<typeof TestEnum2>

`,
					"enumsExact": `export const TestEnum1 = {
    /**
     * Documentation of Value1
    */
    "Value1": "Value1",
    /**
     * Documentation of Value2
    */
    "Value2": "Value2"
};

/** Documentation of testenum2 */
export const TestEnum2 = {
    "Value2": "Value2",
    "Value3": "Value3"
};

`,
				},
			},
			{
				Name: "adds internal documents to schema",
				Input: []string{
					`query TestQuery { version }`,
					`fragment TestFragment on User { firstName }`,
				},
				Extra: map[string]any{
					"schemaExact": `"""@list is used to mark a field for the runtime as a place to add or remove entities in mutations"""
directive @list(connection: Boolean, name: String!) on FIELD_DEFINITION

"""@paginate is used to to mark a field for pagination."""
directive @paginate(mode: PaginateMode, name: String!) on FIELD

"""@prepend is used to tell the runtime to add the result to the end of the list"""
directive @prepend on FRAGMENT_SPREAD

"""@append is used to tell the runtime to add the result to the start of the list"""
directive @append on FRAGMENT_SPREAD

"""@dedupe is used to prevent an operation from running more than once at the same time. true
If the cancelFirst arg is set to true, the response already in flight will be canceled instead of the second one.
If match is set to Operation, then a request will be deduplicated any time there is a request with the same operation.
If it's set to Variables then the request will only be deduplicated if the variables match. If match is set to None,
then the request will never be deduplicated."""
directive @dedupe(cancelFirst: Boolean, match: DedupeMatchMode) on MUTATION | QUERY

"""@optimisticKey is used to tell the runtime to use the value of the field as the key for optimistic updates."""
directive @optimisticKey on FIELD

"""@allLists is used to tell the runtime to add the result to all lists in the cache."""
directive @allLists on FRAGMENT_SPREAD

"""@parentID is used to provide a parentID without specifying position or in situations where it doesn't make sense (eg when deleting a node.)"""
directive @parentID(value: ID!) on FRAGMENT_SPREAD

"""@when is used to provide a conditional or in situations where it doesn't make sense (eg when removing or deleting a node.)"""
directive @when on FRAGMENT_SPREAD

"""@when_not is used to provide a conditional or in situations where it doesn't make sense (eg when removing or deleting a node.)"""
directive @when_not on FRAGMENT_SPREAD

"""@arguments is used to define the arguments of a fragment."""
directive @arguments on FRAGMENT_DEFINITION

"""@with  is used to provide arguments to fragments that have been marked with @arguments"""
directive @with on FRAGMENT_SPREAD

"""@cache is is used to specify cache rules for a query"""
directive @cache(partial: Boolean, policy: CachePolicy) on QUERY

"""@mask_enable is used to to enable masking on fragment (overwriting the global conf)"""
directive @mask_enable on FRAGMENT_SPREAD

"""@mask_disable is used to to disable masking on fragment (overwriting the global conf)"""
directive @mask_disable on FRAGMENT_SPREAD

"""@loading is used to shape the value of your documents while they are loading"""
directive @loading(cascade: Boolean, count: Int) on FIELD | FRAGMENT_DEFINITION | FRAGMENT_SPREAD | QUERY

"""@required makes a nullable field always non-null by making the parent null when the field is"""
directive @required on FIELD

"""@componentField is used to mark a field as a component field"""
directive @componentField(field: String, prop: String) on FIELD_DEFINITION | FRAGMENT_DEFINITION | INLINE_FRAGMENT

"""@runtimeScalar is used to register a scalar with the runtime"""
directive @__houdini__runtimeScalar(type: String!) on QUERY

enum CachePolicy {
  CacheAndNetwork
  CacheOnly
  CacheOrNetwork
  NetworkOnly
  NoCache
}

enum DedupeMatchMode {
  None
  Operation
  Variables
}

enum PaginateMode {
  Infinite
  SinglePage
}

`,
				},
			},
			{
				Name: "list operations are included",
				Input: []string{
					`query TestQuery { usersByCursor @list(name: "Friends") { edges { node { id } } } }`,
					`fragment TestFragment on User { firstName }`,
				},
				Extra: map[string]any{
					"schemaContains": []string{
						"directive @User_delete",
					},
					"documentsExact": `fragment Friends_insert on User {
    id
}

fragment Friends_toggle on User {
    id
}

fragment Friends_remove on User {
    id
}

`,
				},
			},
			{
				Name: "list operations are included but delete directive should not be in when we have Custom Ids",
				Input: []string{
					`query TestQuery { usersByCursor @list(name: "Friends") { edges { node { id } } } }`,
					`fragment TestFragment on User { firstName }`,
					`query CustomIdList { customIdList @list(name: "theList") { foo }}`,
				},
				ProjectConfig: func(cfg *plugins.ProjectConfig) {
					cfg.TypeConfig = map[string]plugins.TypeConfig{
						"CustomIdType": {
							Keys: []string{"foo", "bar"},
						},
					}
				},
				Extra: map[string]any{
					"schemaContains": []string{
						"directive @User_delete",
						"directive @CustomIdType_delete",
					},
					"documentsExact": `fragment Friends_insert on User {
    id
}

fragment Friends_toggle on User {
    id
}

fragment Friends_remove on User {
    id
}

fragment theList_insert on CustomIdType {
    foo
    bar
}

fragment theList_toggle on CustomIdType {
    foo
    bar
}

fragment theList_remove on CustomIdType {
    foo
    bar
}

`,
				},
			},
			{
				Name: "writing twice doesn't duplicate definitions",
				Input: []string{
					`query TestQuery { version }`,
					`fragment TestFragment on User { firstName }`,
				},
				Extra: map[string]any{
					"runGenerationTwice": true,
					"directiveCount":     1,
				},
			},
		},
		Schema: `
			type Query {
				version: Int!
				usersByCursor: UserConnection!
				customIdList: [CustomIdType!]!
			}

			type UserConnection {
				edges: [UserEdge!]!
			}

			type UserEdge {
				node: User!
			}

			type User {
				id: ID!
				firstName: String!
			}

			type CustomIdType {
				foo: String!
				bar: String!
			}

			enum TestEnum1 {
				"Documentation of Value1"
				Value1
				"Documentation of Value2"
				Value2
			}

			"""
			Documentation of testenum2
			"""
			enum TestEnum2 {
				Value3
				Value2
			}
    `,
		PerformTest: performDefinitionsTest,
	})
}

func performDefinitionsTest(
	t *testing.T,
	p *plugin.HoudiniCore,
	test tests.Test[config.PluginConfig],
) {
	err := runFullGeneration(context.Background(), p)
	if err != nil {
		t.Logf("runFullGeneration error: %v", err)
	}
	require.Nil(t, err)

	if runTwice, ok := test.Extra["runGenerationTwice"].(bool); ok && runTwice {
		err = runFullGeneration(context.Background(), p)
		if err != nil {
			t.Logf("Second generation error: %v", err)
		}
		require.Nil(t, err)
	}

	projectConfig, err := p.DB.ProjectConfig(context.Background())
	require.Nil(t, err)

	checkFileExact(t, p.Fs, projectConfig.DefinitionsEnumTypes(), test.Extra["enumsTypesExact"])
	checkFileExact(t, p.Fs, projectConfig.DefinitionsEnumRuntime(), test.Extra["enumsExact"])
	checkFileExact(t, p.Fs, projectConfig.DefinitionsSchemaPath(), test.Extra["schemaExact"])
	checkFileExact(t, p.Fs, projectConfig.DefinitionsDocumentsPath(), test.Extra["documentsExact"])
	checkFileContains(t, p.Fs, projectConfig.DefinitionsSchemaPath(), test.Extra["schemaContains"])
	checkFileContains(
		t,
		p.Fs,
		projectConfig.DefinitionsDocumentsPath(),
		test.Extra["documentsContains"],
	)
	checkDirectiveCount(
		t,
		p.Fs,
		projectConfig.DefinitionsSchemaPath(),
		test.Extra["directiveCount"],
	)
}

func runFullGeneration(ctx context.Context, p *plugin.HoudiniCore) error {
	err := p.AfterExtract(ctx)
	if err != nil {
		return err
	}

	err = p.Validate(ctx)
	if err != nil {
		return err
	}

	err = p.AfterValidate(ctx)
	if err != nil {
		return err
	}

	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return err
	}

	originalPath := projectConfig.PersistedQueriesPath
	projectConfig.PersistedQueriesPath = "./dummy-queries.json"
	p.DB.SetProjectConfig(projectConfig)

	// Generate documents first to create fragments, then runtime for schema definitions
	_, err = p.GenerateDocuments(ctx)
	if err != nil {
		return err
	}

	_, err = p.GenerateRuntime(ctx)

	projectConfig.PersistedQueriesPath = originalPath
	p.DB.SetProjectConfig(projectConfig)

	return err
}

func checkFileExact(t *testing.T, fs afero.Fs, path string, data any) {
	if data == nil {
		return
	}

	expected, ok := data.(string)
	if !ok {
		return
	}

	content, err := afero.ReadFile(fs, path)
	require.Nil(t, err)
	actual := string(content)

	assert.Equal(t, expected, actual, "File content should match exactly")
}

func checkFileContains(t *testing.T, fs afero.Fs, path string, data any) {
	if data == nil {
		return
	}

	checks, ok := data.([]string)
	if !ok {
		return
	}

	content, err := afero.ReadFile(fs, path)
	require.Nil(t, err)
	str := string(content)
	for _, expected := range checks {
		assert.Contains(t, str, expected)
	}
}

func checkDirectiveCount(t *testing.T, fs afero.Fs, path string, data any) {
	if data == nil {
		return
	}

	expectedCount, ok := data.(int)
	if !ok {
		return
	}

	content, err := afero.ReadFile(fs, path)
	require.Nil(t, err)
	str := string(content)
	actualCount := strings.Count(str, "directive @list")
	assert.Equal(
		t,
		expectedCount,
		actualCount,
		"directive @list should appear exactly the expected number of times",
	)
}
