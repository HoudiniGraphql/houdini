package plugin_test

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"

	coreConfig "code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-react/plugin"
	plugins "code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/tests"
)

func TestTransformRuntime(t *testing.T) {
	tests.RunTable(t, tests.Table[coreConfig.PluginConfig, *plugin.HoudiniReact]{
		Schema: `type Query { id: ID }`,
		PerformTest: func(t *testing.T, p *plugin.HoudiniReact, test tests.Test[coreConfig.PluginConfig]) {
			ctx := context.Background()

			original, _ := test.Extra["input"].(string)
			got, err := p.TransformRuntime(ctx, test.Name, original)
			require.NoError(t, err)

			require.Equal(t, test.Extra["expected"].(string), got)
		},
		Tests: []tests.Test[coreConfig.PluginConfig]{
			{
				Name: "client.ts",
				Pass: true,
				Extra: map[string]any{
					"input": "export default (() => {}) as () => HoudiniClient\n",
					// runtimeDir  = /project/.houdini/plugins/houdini-react/runtime
					// clientPath  = /project/src/+client
					// relPath     = ../../../../src/+client
					"expected": "import client from '../../../../src/+client'\nexport default () => client\n",
				},
			},
			{
				Name: "index.ts",
				Pass: true,
				Extra: map[string]any{
					"input":    "export * from './hooks'\n",
					"expected": "export * from './hooks'\n",
				},
			},
		},
	})
}

// indexStub mirrors the real core runtime index.ts: it has leading imports and
// exports before the generic graphql() declaration, so tests verify that
// overloads land immediately before the marker rather than at the file top.
const indexStub = "import type { Cache } from 'houdini/runtime/cache'\n\n" +
	"export { CachePolicy } from 'houdini/runtime'\nexport * from './client'\n\n" +
	"export function graphql<_Payload, _Result = _Payload>(str: string): _Result\n" +
	"export function graphql(str: string): never { throw new Error() }\n"

func TestUpdateIndexFiles(t *testing.T) {
	tests.RunTable(t, tests.Table[coreConfig.PluginConfig, *plugin.HoudiniReact]{
		Schema: `type Query { id: ID }`,

		SetupTest: func(t *testing.T, p *plugin.HoudiniReact, test tests.Test[coreConfig.PluginConfig]) {
			if test.Extra["no_stub"] == true {
				return
			}
			cfg, err := p.DB.ProjectConfig(context.Background())
			require.NoError(t, err)
			path := filepath.Join(cfg.ProjectRoot, cfg.RuntimeDir, "runtime", "index.ts")
			require.NoError(t, p.Filesystem().MkdirAll(filepath.Dir(path), 0755))
			require.NoError(t, afero.WriteFile(p.Filesystem(), path, []byte(indexStub), 0644))
		},

		PerformTest: func(t *testing.T, p *plugin.HoudiniReact, test tests.Test[coreConfig.PluginConfig]) {
			ctx := context.Background()
			cfg, err := p.DB.ProjectConfig(ctx)
			require.NoError(t, err)
			targetPath := filepath.Join(cfg.ProjectRoot, cfg.RuntimeDir, "runtime", "index.ts")

			_, err = p.UpdateIndexFiles(ctx)
			require.NoError(t, err)

			if test.Extra["call_twice"] == true {
				_, err = p.UpdateIndexFiles(ctx)
				require.NoError(t, err)
			}

			expected, ok := test.Extra["expected"].(string)
			if !ok {
				return
			}

			got, err := afero.ReadFile(p.Filesystem(), targetPath)
			require.NoError(t, err)
			require.Equal(t, expected, string(got))
		},

		Tests: []tests.Test[coreConfig.PluginConfig]{
			{
				Name: "injects artifact overloads into runtime index",
				Pass: true,
				Input: []string{
					`query MyQuery { id }`,
					`query YourQuery { id }`,
				},
				Extra: map[string]any{
					// Overloads must land immediately before the generic function —
					// the leading imports/exports in the stub must remain in place.
					"expected": "\n" +
						"import type { MyQuery$artifact } from '../artifacts/MyQuery'\n" +
						"import type { YourQuery$artifact } from '../artifacts/YourQuery'\n" +
						"\n" +
						"import type { Cache } from 'houdini/runtime/cache'\n\n" +
						"export { CachePolicy } from 'houdini/runtime'\nexport * from './client'\n\n" +
						"export function graphql(str: `query MyQuery { id }`): { artifact: MyQuery$artifact };\n" +
						"export function graphql(str: `query YourQuery { id }`): { artifact: YourQuery$artifact };\n" +
						"export function graphql<_Payload, _Result = _Payload>(str: string): _Result\n" +
						"export function graphql(str: string): never { throw new Error() }\n",
				},
			},
			{
				Name: "no documents leaves index unchanged",
				Pass: true,
				Extra: map[string]any{
					"expected": indexStub,
				},
			},
			{
				Name:  "missing index.ts skips gracefully",
				Pass:  true,
				Input: []string{`query MyQuery { id }`},
				Extra: map[string]any{
					"no_stub": true,
					// no "expected" key — we just verify no error and no panic
				},
			},
			{
				Name:  "calling twice does not double-inject overloads",
				Pass:  true,
				Input: []string{`query MyQuery { id }`},
				Extra: map[string]any{
					"call_twice": true,
					"expected": "\n" +
						"import type { MyQuery$artifact } from '../artifacts/MyQuery'\n" +
						"\n" +
						"import type { Cache } from 'houdini/runtime/cache'\n\n" +
						"export { CachePolicy } from 'houdini/runtime'\nexport * from './client'\n\n" +
						"export function graphql(str: `query MyQuery { id }`): { artifact: MyQuery$artifact };\n" +
						"export function graphql<_Payload, _Result = _Payload>(str: string): _Result\n" +
						"export function graphql(str: string): never { throw new Error() }\n",
				},
			},
		},
	})
}

func TestUpdateHookFiles(t *testing.T) {
	tests.RunTable(t, tests.Table[coreConfig.PluginConfig, *plugin.HoudiniReact]{
		Schema: `
			type Query {
				id: ID
				node(id: ID!): Node
			}
			type Mutation { id: ID }
			type Subscription { id: ID }

			interface Node { id: ID! }
			type User implements Node {
				id: ID!
				firstName: String!
				friends(first: Int, after: String, last: Int, before: String): UserConnection!
			}
			type UserConnection {
				pageInfo: PageInfo!
				edges: [UserEdge!]!
			}
			type UserEdge {
				cursor: String!
				node: User!
			}
			type PageInfo {
				hasNextPage: Boolean!
				hasPreviousPage: Boolean!
				startCursor: String
				endCursor: String
			}
		`,

		SetupTest: func(t *testing.T, p *plugin.HoudiniReact, test tests.Test[coreConfig.PluginConfig]) {
			cfg, err := p.DB.ProjectConfig(context.Background())
			require.NoError(t, err)
			hooksDir := filepath.Join(cfg.PluginRuntimeDirectory(p.Name()), "hooks")
			require.NoError(t, p.Filesystem().MkdirAll(hooksDir, 0755))

			stubs, ok := test.Extra["stubs"].(map[string]string)
			if !ok {
				return
			}
			for name, content := range stubs {
				require.NoError(t, afero.WriteFile(p.Filesystem(),
					filepath.Join(hooksDir, name), []byte(content), 0644))
			}
		},

		PerformTest: func(t *testing.T, p *plugin.HoudiniReact, test tests.Test[coreConfig.PluginConfig]) {
			ctx := context.Background()
			cfg, err := p.DB.ProjectConfig(ctx)
			require.NoError(t, err)
			hooksDir := filepath.Join(cfg.PluginRuntimeDirectory(p.Name()), "hooks")

			_, err = p.UpdateHookFiles(ctx)
			require.NoError(t, err)

			if test.Extra["call_twice_hooks"] == true {
				_, err = p.UpdateHookFiles(ctx)
				require.NoError(t, err)
			}

			for file, expected := range test.Extra["expected"].(map[string]string) {
				got, err := afero.ReadFile(p.Filesystem(), filepath.Join(hooksDir, file))
				require.NoError(t, err)
				require.Equal(t, expected, string(got), "file: %s", file)
			}
		},

		Tests: []tests.Test[coreConfig.PluginConfig]{
			{
				Name: "injects query overloads",
				Pass: true,
				Input: []string{
					`query MyQuery { id }`,
				},
				Extra: map[string]any{
					// Stub includes a leading import to verify overloads land immediately
					// before the generic function, not at the top of the file.
					"stubs": map[string]string{
						"useQuery.ts": "import type { QueryArtifact } from 'houdini/runtime'\n\nexport function useQuery<_A>(doc: any): any {}\n",
					},
					"expected": map[string]string{
						"useQuery.ts": "import type { MyQuery$result, MyQuery$artifact, MyQuery$input } from '$houdini/artifacts/MyQuery'\n" +
							"\n" +
							"import type { QueryArtifact } from 'houdini/runtime'\n\n" +
							"export function useQuery(document: { artifact: MyQuery$artifact }, variables?: MyQuery$input, config?: UseQueryConfig): MyQuery$result\n" +
							"export function useQuery<_Artifact extends QueryArtifact, _Data extends GraphQLObject>(document: { artifact: _Artifact }, variables?: GraphQLVariables, config?: UseQueryConfig): _Data\n" +
							"export function useQuery<_A>(doc: any): any {}\n",
					},
				},
			},
			{
				Name: "injects mutation overloads",
				Pass: true,
				Input: []string{
					`mutation MyMutation { id }`,
				},
				Extra: map[string]any{
					"stubs": map[string]string{
						"useMutation.ts": "import type { MutationArtifact } from 'houdini/runtime'\n\nexport function useMutation<_A>(doc: any): any {}\n",
					},
					"expected": map[string]string{
						"useMutation.ts": "import type { MyMutation$result, MyMutation$artifact, MyMutation$input, MyMutation$optimistic } from '$houdini/artifacts/MyMutation'\n" +
							"\n" +
							"import type { MutationArtifact } from 'houdini/runtime'\n\n" +
							"export function useMutation(document: { artifact: MyMutation$artifact }): [MutationHandler<MyMutation$result, MyMutation$input, MyMutation$optimistic>, boolean]\n" +
							"export function useMutation<_Result extends GraphQLObject, _Input extends GraphQLVariables, _Optimistic extends GraphQLObject>(document: { artifact: MutationArtifact }): [MutationHandler<_Result, _Input, _Optimistic>, boolean]\n" +
							"export function useMutation<_A>(doc: any): any {}\n",
					},
				},
			},
			{
				Name: "injects fragment overloads",
				Pass: true,
				Input: []string{
					`fragment MyFragment on Query { id }`,
				},
				Extra: map[string]any{
					"stubs": map[string]string{
						"useFragment.ts": "import { fragmentKey } from 'houdini/runtime'\nimport type { FragmentArtifact } from 'houdini/runtime'\n\nexport function useFragment<_A>(ref: any, doc: any): any {}\n",
					},
					"expected": map[string]string{
						"useFragment.ts": "import type { MyFragment$data, MyFragment$artifact } from '$houdini/artifacts/MyFragment'\n" +
							"\n" +
							"import { fragmentKey } from 'houdini/runtime'\nimport type { FragmentArtifact } from 'houdini/runtime'\n\n" +
							"export function useFragment(reference: { readonly \" $fragments\": { MyFragment: any } }, document: { artifact: MyFragment$artifact }): MyFragment$data\n" +
							"export function useFragment(reference: { readonly \" $fragments\": { MyFragment: any } } | null, document: { artifact: MyFragment$artifact }): MyFragment$data | null\n" +
							"export function useFragment<_Data extends GraphQLObject, _ReferenceType extends {}, _Input extends GraphQLVariables>(reference: _Data | { \" $fragments\": _ReferenceType } | null, document: { artifact: FragmentArtifact }): _Data | null\n" +
							"export function useFragment<_A>(ref: any, doc: any): any {}\n",
					},
				},
			},
			{
				Name: "injects array overloads for a @plural fragment",
				Pass: true,
				Input: []string{
					`fragment MyPluralFragment on Query @plural { id }`,
				},
				Extra: map[string]any{
					"stubs": map[string]string{
						"useFragment.ts": "import { fragmentKey } from 'houdini/runtime'\nimport type { FragmentArtifact } from 'houdini/runtime'\n\nexport function useFragment<_A>(ref: any, doc: any): any {}\n",
					},
					"expected": map[string]string{
						"useFragment.ts": "import type { MyPluralFragment$data, MyPluralFragment$artifact } from '$houdini/artifacts/MyPluralFragment'\n" +
							"\n" +
							"import { fragmentKey } from 'houdini/runtime'\nimport type { FragmentArtifact } from 'houdini/runtime'\n\n" +
							"export function useFragment(reference: ReadonlyArray<{ readonly \" $fragments\": { MyPluralFragment: any } }>, document: { artifact: MyPluralFragment$artifact }): MyPluralFragment$data[]\n" +
							"export function useFragment(reference: ReadonlyArray<{ readonly \" $fragments\": { MyPluralFragment: any } }> | null, document: { artifact: MyPluralFragment$artifact }): MyPluralFragment$data[] | null\n" +
							"export function useFragment<_Data extends GraphQLObject, _ReferenceType extends {}, _Input extends GraphQLVariables>(reference: _Data | { \" $fragments\": _ReferenceType } | null, document: { artifact: FragmentArtifact }): _Data | null\n" +
							"export function useFragment<_A>(ref: any, doc: any): any {}\n",
					},
				},
			},
			{
				Name: "injects useFragmentHandle overloads for non-paginated fragment",
				Pass: true,
				Input: []string{
					`fragment MyFragment on Query { id }`,
				},
				Extra: map[string]any{
					"stubs": map[string]string{
						"useFragmentHandle.ts": "import type { QueryArtifact } from 'houdini/runtime'\n\nexport function useFragmentHandle<_A>(ref: any, doc: any): any {}\n",
					},
					"expected": map[string]string{
						"useFragmentHandle.ts": "import type { MyFragment$data, MyFragment$artifact, MyFragment$input } from '$houdini/artifacts/MyFragment'\n" +
							"\n" +
							"import type { QueryArtifact } from 'houdini/runtime'\n\n" +
							"export function useFragmentHandle(reference: { readonly \" $fragments\": { MyFragment: any } }, document: { artifact: MyFragment$artifact }): DocumentHandle<QueryArtifact, MyFragment$data, GraphQLVariables>\n" +
							"export function useFragmentHandle(reference: { readonly \" $fragments\": { MyFragment: any } } | null, document: { artifact: MyFragment$artifact }): DocumentHandle<QueryArtifact, MyFragment$data, GraphQLVariables>\n" +
							"export function useFragmentHandle<_Artifact extends FragmentArtifact, _Data extends GraphQLObject, _ReferenceType extends {}, _PaginationArtifact extends QueryArtifact, _Input extends GraphQLVariables>(reference: _Data | { \" $fragments\": _ReferenceType } | null, document: { artifact: _Artifact; refetchArtifact?: _PaginationArtifact }): DocumentHandle<_PaginationArtifact, _Data, _Input>\n" +
							"export function useFragmentHandle<_A>(ref: any, doc: any): any {}\n",
					},
				},
			},
			{
				Name: "injects useFragmentHandle overloads with pagination query artifact for paginated fragment",
				Pass: true,
				Input: []string{
					`fragment MyPaginatedFragment on User { friends(first: 2) @paginate { edges { node { firstName } } } }`,
				},
				Extra: map[string]any{
					"stubs": map[string]string{
						"useFragmentHandle.ts": "import type { QueryArtifact } from 'houdini/runtime'\n\nexport function useFragmentHandle<_A>(ref: any, doc: any): any {}\n",
					},
					"expected": map[string]string{
						"useFragmentHandle.ts": "import type { MyPaginatedFragment$data, MyPaginatedFragment$artifact, MyPaginatedFragment$input } from '$houdini/artifacts/MyPaginatedFragment'\n" +
							"import type { MyPaginatedFragment_Pagination_Query$artifact } from '$houdini/artifacts/MyPaginatedFragment_Pagination_Query'\n" +
							"\n" +
							"import type { QueryArtifact } from 'houdini/runtime'\n\n" +
							"export function useFragmentHandle(reference: { readonly \" $fragments\": { MyPaginatedFragment: any } }, document: { artifact: MyPaginatedFragment$artifact; refetchArtifact?: MyPaginatedFragment_Pagination_Query$artifact }): DocumentHandle<MyPaginatedFragment_Pagination_Query$artifact, MyPaginatedFragment$data, MyPaginatedFragment$input>\n" +
							"export function useFragmentHandle(reference: { readonly \" $fragments\": { MyPaginatedFragment: any } } | null, document: { artifact: MyPaginatedFragment$artifact; refetchArtifact?: MyPaginatedFragment_Pagination_Query$artifact }): DocumentHandle<MyPaginatedFragment_Pagination_Query$artifact, MyPaginatedFragment$data, MyPaginatedFragment$input>\n" +
							"export function useFragmentHandle<_Artifact extends FragmentArtifact, _Data extends GraphQLObject, _ReferenceType extends {}, _PaginationArtifact extends QueryArtifact, _Input extends GraphQLVariables>(reference: _Data | { \" $fragments\": _ReferenceType } | null, document: { artifact: _Artifact; refetchArtifact?: _PaginationArtifact }): DocumentHandle<_PaginationArtifact, _Data, _Input>\n" +
							"export function useFragmentHandle<_A>(ref: any, doc: any): any {}\n",
					},
				},
			},
			{
				Name:  "skips files not present in plugin runtime dir",
				Pass:  true,
				Input: []string{`query MyQuery { id }`},
				Extra: map[string]any{
					// no stubs written — files don't exist, should silently skip
					"stubs":    map[string]string{},
					"expected": map[string]string{},
				},
			},
			{
				Name:  "calling twice does not double-inject",
				Pass:  true,
				Input: []string{`query MyQuery { id }`},
				Extra: map[string]any{
					"call_twice_hooks": true,
					"stubs": map[string]string{
						"useQuery.ts": "import type { QueryArtifact } from 'houdini/runtime'\n\nexport function useQuery<_A>(doc: any): any {}\n",
					},
					"expected": map[string]string{
						"useQuery.ts": "import type { MyQuery$result, MyQuery$artifact, MyQuery$input } from '$houdini/artifacts/MyQuery'\n" +
							"\n" +
							"import type { QueryArtifact } from 'houdini/runtime'\n\n" +
							"export function useQuery(document: { artifact: MyQuery$artifact }, variables?: MyQuery$input, config?: UseQueryConfig): MyQuery$result\n" +
							"export function useQuery<_Artifact extends QueryArtifact, _Data extends GraphQLObject>(document: { artifact: _Artifact }, variables?: GraphQLVariables, config?: UseQueryConfig): _Data\n" +
							"export function useQuery<_A>(doc: any): any {}\n",
					},
				},
			},
		},
	})
}

func TestAddGraphQLType(t *testing.T) {
	tests.RunTable(t, tests.Table[coreConfig.PluginConfig, *plugin.HoudiniReact]{
		Schema: `type Query { id: ID }`,

		SetupTest: func(t *testing.T, p *plugin.HoudiniReact, test tests.Test[coreConfig.PluginConfig]) {
			if rows, ok := test.Extra["component_fields"].([]map[string]any); ok {
				insertComponentFields(t, p, rows)
			}

			// Write the core runtime index.ts stub.
			cfg, err := p.DB.ProjectConfig(context.Background())
			require.NoError(t, err)
			path := filepath.Join(cfg.ProjectRoot, cfg.RuntimeDir, "runtime", "index.ts")
			require.NoError(t, p.Filesystem().MkdirAll(filepath.Dir(path), 0755))
			require.NoError(t, afero.WriteFile(p.Filesystem(), path, []byte(indexStub), 0644))
		},

		PerformTest: func(t *testing.T, p *plugin.HoudiniReact, test tests.Test[coreConfig.PluginConfig]) {
			ctx := context.Background()
			cfg, err := p.DB.ProjectConfig(ctx)
			require.NoError(t, err)
			targetPath := filepath.Join(cfg.ProjectRoot, cfg.RuntimeDir, "runtime", "index.ts")

			_, err = p.AddGraphQLType(ctx)
			require.NoError(t, err)
			if test.Extra["call_twice"] == true {
				_, err = p.AddGraphQLType(ctx)
				require.NoError(t, err)
			}

			expected, ok := test.Extra["expected"].(string)
			if !ok {
				return
			}
			got, err := afero.ReadFile(p.Filesystem(), targetPath)
			require.NoError(t, err)
			require.Equal(t, expected, string(got))
		},

		Tests: []tests.Test[coreConfig.PluginConfig]{
			{
				Name: "appends GraphQL type for each component field fragment",
				Pass: true,
				Extra: map[string]any{
					"component_fields": []map[string]any{
						{
							"filepath": "src/components/Avatar.tsx",
							"type":     "User",
							"field":    "Avatar",
							"prop":     "user",
							"fragment": "UserAvatar",
							"content":  "fragment UserAvatar on User { avatar }",
						},
					},
					// preamble (fragment imports) go BEFORE existing content, type appended at end
					"expected": "import type { UserAvatar } from '../artifacts/UserAvatar'\n" +
						indexStub +
						"\nexport type GraphQL<_Document extends string> = " +
						"_Document extends `fragment UserAvatar on User { avatar }` ? Required<UserAvatar>['shape'] : " +
						"never\n",
				},
			},
			{
				Name: "no component fields leaves index unchanged",
				Pass: true,
				Extra: map[string]any{
					"expected": indexStub,
				},
			},
			{
				Name: "calling twice does not double-append GraphQL type",
				Pass: true,
				Extra: map[string]any{
					"component_fields": []map[string]any{
						{"filepath": "src/components/Avatar.tsx", "type": "User", "field": "Avatar", "prop": "user", "fragment": "UserAvatar", "content": "fragment UserAvatar on User { avatar }"},
					},
					"call_twice": true,
					"expected": "import type { UserAvatar } from '../artifacts/UserAvatar'\n" +
						indexStub +
						"\nexport type GraphQL<_Document extends string> = " +
						"_Document extends `fragment UserAvatar on User { avatar }` ? Required<UserAvatar>['shape'] : " +
						"never\n",
				},
			},
		},
	})
}

func TestInjectComponentFieldArtifactTypes(t *testing.T) {
	tests.RunTable(t, tests.Table[coreConfig.PluginConfig, *plugin.HoudiniReact]{
		Schema:            `type Query { id: ID }`,
		SetupAlwaysPasses: true,

		SetupTest: func(t *testing.T, p *plugin.HoudiniReact, test tests.Test[coreConfig.PluginConfig]) {
			if rows, ok := test.Extra["component_fields"].([]map[string]any); ok {
				insertComponentFields(t, p, rows)
			}
			cfg, err := p.DB.ProjectConfig(context.Background())
			require.NoError(t, err)
			artifactDir := filepath.Join(cfg.ProjectRoot, cfg.RuntimeDir, "artifacts")
			require.NoError(t, p.Filesystem().MkdirAll(artifactDir, 0755))

			if artifacts, ok := test.Extra["artifacts"].(map[string]string); ok {
				for name, content := range artifacts {
					path := filepath.Join(artifactDir, name)
					require.NoError(t, afero.WriteFile(p.Filesystem(), path, []byte(content), 0644))
				}
			}
		},

		PerformTest: func(t *testing.T, p *plugin.HoudiniReact, test tests.Test[coreConfig.PluginConfig]) {
			ctx := context.Background()
			cfg, err := p.DB.ProjectConfig(ctx)
			require.NoError(t, err)
			artifactDir := filepath.Join(cfg.ProjectRoot, cfg.RuntimeDir, "artifacts")

			err = p.AfterGenerate(ctx)
			require.NoError(t, err)
			// For idempotency tests, call a second time.
			err = p.AfterGenerate(ctx)
			require.NoError(t, err)

			if expected, ok := test.Extra["expected"].(map[string]string); ok {
				for name, want := range expected {
					got, err := afero.ReadFile(p.Filesystem(), filepath.Join(artifactDir, name))
					require.NoError(t, err)
					require.Contains(t, string(got), want, "file: %s", name)
				}
			}
		},

		Tests: []tests.Test[coreConfig.PluginConfig]{
			{
				Name: "injects Omit<ComponentPropsWithoutRef, injected-prop> accessor into fragment artifact",
				Pass: true,
				Extra: map[string]any{
					"component_fields": []map[string]any{
						{
							"filepath": "src/routes/Avatar.tsx",
							"type":     "User",
							"field":    "Avatar",
							"prop":     "user",
							"fragment": "__componentField__User_Avatar",
							"content":  "fragment __componentField__User_Avatar on User { avatarURL }",
						},
					},
					"artifacts": map[string]string{
						"UserInfo.ts": tests.Dedent(`
							export type UserInfo$data = {
								readonly name: string;
								readonly " $fragments": {
									__componentField__User_Avatar: {};
								};
							};
						`),
					},
					"expected": map[string]string{
						"UserInfo.ts": `React.ComponentType<Omit<React.ComponentPropsWithoutRef<typeof __UserAvatarComponent__>, "user">>`,
					},
				},
			},
			{
				Name: "is idempotent — calling twice does not double-inject",
				Pass: true,
				Extra: map[string]any{
					"component_fields": []map[string]any{
						{
							"filepath": "src/routes/Avatar.tsx",
							"type":     "User",
							"field":    "Avatar",
							"prop":     "user",
							"fragment": "__componentField__User_Avatar",
							"content":  "fragment __componentField__User_Avatar on User { avatarURL }",
						},
					},
					"artifacts": map[string]string{
						"UserInfo.ts": tests.Dedent(`
							export type UserInfo$data = {
								readonly name: string;
								readonly " $fragments": {
									__componentField__User_Avatar: {};
								};
							};
						`),
					},
					"expected": map[string]string{
						// After two calls the accessor appears exactly once
						"UserInfo.ts": `readonly Avatar: React.ComponentType<Omit`,
					},
				},
			},
			{
				Name: "skips artifacts with no component field references",
				Pass: true,
				Extra: map[string]any{
					"component_fields": []map[string]any{
						{
							"filepath": "src/routes/Avatar.tsx",
							"type":     "User",
							"field":    "Avatar",
							"prop":     "user",
							"fragment": "__componentField__User_Avatar",
							"content":  "fragment __componentField__User_Avatar on User { avatarURL }",
						},
					},
					"artifacts": map[string]string{
						"HelloWorld.ts": tests.Dedent(`
							export type HelloWorld$result = {
								readonly hello: string;
							};
						`),
					},
					"expected": map[string]string{
						// HelloWorld has no component field — must not be modified
						"HelloWorld.ts": "export type HelloWorld$result",
					},
				},
			},
		},
	})
}

// tsTypeManifest is the shared _TSType resolver emitted into manifest.ts after the
// RouteScalars map (see tsTypeResolver in runtime.go). Begins with a blank line.
const tsTypeManifest = "\nexport type _TSType<T extends string> = T extends keyof RouteScalars\n" +
	"\t? RouteScalars[T]\n" +
	"\t: T extends 'Int' | 'Float'\n" +
	"\t\t? number\n" +
	"\t\t: T extends 'ID'\n" +
	"\t\t\t? string | number\n" +
	"\t\t\t: T extends 'Boolean'\n" +
	"\t\t\t\t? boolean\n" +
	"\t\t\t\t: string\n"

func TestGenerateRuntime(t *testing.T) {
	tests.RunTable(t, tests.Table[coreConfig.PluginConfig, *plugin.HoudiniReact]{
		Schema: `
			type Query {
				id: ID
				node(id: ID!): Node
				search(q: String, tags: [String!], first: Int!): [Node!]
			}
			type Subscription {
				id: ID
			}
			type Mutation {
				createUser(name: String!): User!
			}
			type User implements Node { id: ID! name: String! }
			interface Node { id: ID! }
		`,
		SetupAlwaysPasses: true,

		SetupTest: func(t *testing.T, p *plugin.HoudiniReact, test tests.Test[coreConfig.PluginConfig]) {
			cfg, err := p.DB.ProjectConfig(context.Background())
			require.NoError(t, err)
			runtimeDir := cfg.PluginRuntimeDirectory(p.Name())
			require.NoError(t, p.Filesystem().MkdirAll(runtimeDir, 0755))

			// GenerateTsConfig reads tsconfig.json from the plugin runtime dir (written
			// there by IncludeRuntime in the real pipeline). Seed a minimal stub so the
			// test doesn't fail on a missing file.
			tsconfigStub, err := os.ReadFile("../runtime/tsconfig.json")
			require.NoError(t, err)
			require.NoError(t, afero.WriteFile(p.Filesystem(),
				filepath.Join(runtimeDir, "tsconfig.json"), tsconfigStub, 0644))

			views, ok := test.Extra["views"].(map[string]string)
			if !ok {
				return
			}
			fs := p.Filesystem()
			for fp, content := range views {
				abs := filepath.Join("/project", fp)
				require.NoError(t, fs.MkdirAll(filepath.Dir(abs), 0755))
				require.NoError(t, afero.WriteFile(fs, abs, []byte(content), 0644))
			}
		},

		PerformTest: func(t *testing.T, p *plugin.HoudiniReact, test tests.Test[coreConfig.PluginConfig]) {
			ctx := context.Background()

			changed, err := p.GenerateRuntime(ctx)
			require.NoError(t, err)

			config, err := p.DB.ProjectConfig(ctx)
			require.NoError(t, err)

			manifestPath := filepath.Join(config.PluginRuntimeDirectory(p.Name()), "manifest.ts")

			if expected, ok := test.Extra["expected"].(string); ok {
				require.Contains(t, changed, manifestPath)
				got, err := afero.ReadFile(p.Filesystem(), manifestPath)
				require.NoError(t, err)
				require.Equal(t, expected, string(got))
			}

			// substring assertions for cases where a full-manifest golden would be brittle
			if substrs, ok := test.Extra["containsManifest"].([]string); ok {
				got, err := afero.ReadFile(p.Filesystem(), manifestPath)
				require.NoError(t, err)
				for _, substr := range substrs {
					require.Contains(t, string(got), substr)
				}
			}

			mockPath := filepath.Join(config.PluginRuntimeDirectory(p.Name()), "mock.ts")

			if expectedMock, ok := test.Extra["expectedMock"].(string); ok {
				require.Contains(t, changed, mockPath)
				got, err := afero.ReadFile(p.Filesystem(), mockPath)
				require.NoError(t, err)
				require.Equal(t, expectedMock, string(got))
			}
		},

		Tests: []tests.Test[coreConfig.PluginConfig]{
			{
				Name: "@endpoint mutation generates a form_actions entry",
				Pass: true,
				Input: []string{
					`mutation CreateUser($name: String!) @endpoint(redirect: "/users/{ createUser.id }") {
						createUser(name: $name) { id }
					}`,
				},
				Extra: map[string]any{
					"containsManifest": []string{
						"export const form_actions = {",
						"CreateUser: () => import(",
					},
				},
			},
			{
				Name: "empty routes generates empty manifest",
				Pass: true,
				Extra: map[string]any{
					"expected": tests.Dedent(`
						import type { RouterManifest } from 'houdini/runtime'

						export default {
							pages: {
							},
							pagesByUrl: {
							},
						} as const satisfies RouterManifest<any>

						export type RouteScalars = {
						}
					`) + "\n" + tsTypeManifest,
					"expectedMock": "import React from 'react'\n" +
						"import { _createMock, buildMockPath } from './testing'\n" +
						"\ntype _MockValue<R, V> = R | ((vars: V) => R)\n\n" +
						"export function createMock({ url, params = {}, search, data }: { url: string; params?: Record<string, string>; search?: Record<string, unknown>; data: Record<string, any> }): React.ComponentType<{}> {\n" +
						"\treturn _createMock({ path: buildMockPath(url, params, search), data })\n" +
						"}\n",
				},
			},
			{
				Name: "route groups",
				Pass: true,
				Input: []string{
					mockQuery("RootQuery", false),
					mockQuery("FinalQuery", true),
				},
				Filepaths: []string{
					"src/routes/(subRoute)/+layout.gql",
					"src/routes/(subRoute)/nested/+page.gql",
				},
				Extra: map[string]any{
					"views": map[string]string{
						"src/routes/+layout.tsx":                 mockView([]string{}),
						"src/routes/(subRoute)/+layout.tsx":      mockView([]string{"RootQuery"}),
						"src/routes/(subRoute)/nested/+page.tsx": mockView([]string{"FinalQuery"}),
					},
					// (subRoute) is a route group — it doesn't appear in the URL pattern.
					// runtimeDir  = /project/.houdini/plugins/houdini-react/runtime
					// artifacts   = ../../../artifacts/<Name>
					// component   = ../units/entries/<id>  (entry file, not source)
					"expectedMock": "import React from 'react'\n" +
						"import { _createMock, buildMockPath } from './testing'\n" +
						"import type { RouteHrefs, ParamsForRoute, SearchForRoute } from './routes'\n" +
						"\nimport type { FinalQuery$unmasked, FinalQuery$input } from '$houdini/artifacts/FinalQuery'\n" +
						"import type { RootQuery$unmasked, RootQuery$input } from '$houdini/artifacts/RootQuery'\n" +
						"\ntype _MockValue<R, V> = R | ((vars: V) => R)\n\n" +
						"type _TestData___subRoute__nested = {\n" +
						"\tRootQuery: _MockValue<RootQuery$unmasked, RootQuery$input>\n" +
						"\tFinalQuery: _MockValue<FinalQuery$unmasked, FinalQuery$input>\n" +
						"}\n\n" +
						"type _RouteData = {\n" +
						"\t\"/nested\": _TestData___subRoute__nested\n" +
						"}\n" +
						"type _DataForRoute<H extends string> = H extends keyof _RouteData ? _RouteData[H] : never\n\n" +
						"export function createMock<H extends RouteHrefs>(args: { url: H; data: _DataForRoute<H> } & ParamsForRoute<H> & SearchForRoute<H>): React.ComponentType<{}> {\n" +
						"\treturn _createMock({ path: buildMockPath(args.url as string, (args as any).params ?? {}, (args as any).search), data: args.data as Record<string, any> })\n" +
						"}\n",
					"expected": tests.Dedent(`
						import type { RouterManifest } from 'houdini/runtime'

						export default {
							pages: {
								"__subRoute__nested": {
									id: "__subRoute__nested",
									url: "/nested",
									pattern: /^\/nested\/?$/,
									params: [],
									searchParams: [],
									documents: {
										RootQuery: {
											artifact: () => import("../../../artifacts/RootQuery"),
											loading: false,
											variables: {},
										},
										FinalQuery: {
											artifact: () => import("../../../artifacts/FinalQuery"),
											loading: true,
											variables: {},
										},
									},
									component: () => import("../units/entries/__subRoute__nested"),
								},
							},
							pagesByUrl: {
								"/nested": "__subRoute__nested",
							},
						} as const satisfies RouterManifest<any>

						export type RouteScalars = {
						}
					`) + "\n" + tsTypeManifest,
				},
			},
			{
				Name: "nested routes with params",
				Pass: true,
				Input: []string{
					"query MyQuery($id: ID!) {\n\tnode(id: $id) {\n\t\tid\n\t}\n}\n",
				},
				Filepaths: []string{
					"src/routes/[id]/+layout.gql",
				},
				Extra: map[string]any{
					"views": map[string]string{
						"src/routes/[id]/+page.tsx": mockView([]string{"MyQuery"}),
					},
					"expectedMock": "import React from 'react'\n" +
						"import { _createMock, buildMockPath } from './testing'\n" +
						"import type { RouteHrefs, ParamsForRoute, SearchForRoute } from './routes'\n" +
						"\nimport type { MyQuery$unmasked, MyQuery$input } from '$houdini/artifacts/MyQuery'\n" +
						"\ntype _MockValue<R, V> = R | ((vars: V) => R)\n\n" +
						"type _TestData___id_ = {\n" +
						"\tMyQuery: _MockValue<MyQuery$unmasked, MyQuery$input>\n" +
						"}\n\n" +
						"type _RouteData = {\n" +
						"\t\"/[id]\": _TestData___id_\n" +
						"}\n" +
						"type _DataForRoute<H extends string> = H extends keyof _RouteData ? _RouteData[H] : never\n\n" +
						"export function createMock<H extends RouteHrefs>(args: { url: H; data: _DataForRoute<H> } & ParamsForRoute<H> & SearchForRoute<H>): React.ComponentType<{}> {\n" +
						"\treturn _createMock({ path: buildMockPath(args.url as string, (args as any).params ?? {}, (args as any).search), data: args.data as Record<string, any> })\n" +
						"}\n",
					"expected": tests.Dedent(`
						import type { RouterManifest } from 'houdini/runtime'

						export default {
							pages: {
								"__id_": {
									id: "__id_",
									url: "/[id]",
									pattern: /^\/([^/]+?)\/?$/,
									params: [
										{ name: "id", optional: false, rest: false, chained: false, type: "ID" }
									],
									searchParams: [],
									documents: {
										MyQuery: {
											artifact: () => import("../../../artifacts/MyQuery"),
											loading: false,
											variables: { id: { type: "ID" } },
										},
									},
									component: () => import("../units/entries/__id_"),
								},
							},
							pagesByUrl: {
								"/[id]": "__id_",
							},
						} as const satisfies RouterManifest<any>

						export type RouteScalars = {
						}
					`) + "\n" + tsTypeManifest,
				},
			},
			{
				Name: "nullable non-route variables become search params",
				Pass: true,
				Input: []string{
					"query SearchQuery($q: String, $tags: [String!], $first: Int!) {\n\tsearch(q: $q, tags: $tags, first: $first) {\n\t\tid\n\t}\n}\n",
				},
				Filepaths: []string{
					"src/routes/search/+page.gql",
				},
				Extra: map[string]any{
					"views": map[string]string{
						"src/routes/search/+page.tsx": mockView([]string{"SearchQuery"}),
					},
					// $q and $tags are nullable, so they surface as search params (the list
					// keeps its wrapper chain). $first is required, so it is omitted — a
					// missing search param can never make the query fail.
					"expectedMock": "import React from 'react'\n" +
						"import { _createMock, buildMockPath } from './testing'\n" +
						"import type { RouteHrefs, ParamsForRoute, SearchForRoute } from './routes'\n" +
						"\nimport type { SearchQuery$unmasked, SearchQuery$input } from '$houdini/artifacts/SearchQuery'\n" +
						"\ntype _MockValue<R, V> = R | ((vars: V) => R)\n\n" +
						"type _TestData__search = {\n" +
						"\tSearchQuery: _MockValue<SearchQuery$unmasked, SearchQuery$input>\n" +
						"}\n\n" +
						"type _RouteData = {\n" +
						"\t\"/search\": _TestData__search\n" +
						"}\n" +
						"type _DataForRoute<H extends string> = H extends keyof _RouteData ? _RouteData[H] : never\n\n" +
						"export function createMock<H extends RouteHrefs>(args: { url: H; data: _DataForRoute<H> } & ParamsForRoute<H> & SearchForRoute<H>): React.ComponentType<{}> {\n" +
						"\treturn _createMock({ path: buildMockPath(args.url as string, (args as any).params ?? {}, (args as any).search), data: args.data as Record<string, any> })\n" +
						"}\n",
					"expected": tests.Dedent(`
						import type { RouterManifest } from 'houdini/runtime'

						export default {
							pages: {
								"_search": {
									id: "_search",
									url: "/search",
									pattern: /^\/search\/?$/,
									params: [],
									searchParams: [
										{ name: "q", type: "String", wrappers: [] },
										{ name: "tags", type: "String", wrappers: ["List", "NonNull"] }
									],
									documents: {
										SearchQuery: {
											artifact: () => import("../../../artifacts/SearchQuery"),
											loading: false,
											variables: { first: { type: "Int" }, q: { type: "String" }, tags: { type: "String" } },
										},
									},
									component: () => import("../units/entries/_search"),
								},
							},
							pagesByUrl: {
								"/search": "_search",
							},
						} as const satisfies RouterManifest<any>

						export type RouteScalars = {
						}
					`) + "\n" + tsTypeManifest,
				},
			},
			{
				Name: "+error.tsx emits error field in manifest",
				Pass: true,
				Input: []string{
					mockQuery("PageQuery", false),
				},
				Filepaths: []string{
					"src/routes/+page.gql",
				},
				Extra: map[string]any{
					"views": map[string]string{
						"src/routes/+page.tsx":  mockView([]string{"PageQuery"}),
						"src/routes/+error.tsx": "export default ({ errors }) => <div>{errors[0].message}</div>",
					},
					"expected": tests.Dedent(`
						import type { RouterManifest } from 'houdini/runtime'

						export default {
							pages: {
								"_": {
									id: "_",
									url: "/",
									pattern: /^\/$/,
									params: [],
									searchParams: [],
									documents: {
										PageQuery: {
											artifact: () => import("../../../artifacts/PageQuery"),
											loading: false,
											variables: {},
										},
									},
									component: () => import("../units/entries/_"),
								},
							},
							pagesByUrl: {
								"/": "_",
							},
						} as const satisfies RouterManifest<any>

						export type RouteScalars = {
						}
					`) + "\n" + tsTypeManifest,
				},
			},
			{
				Name: "headers() exports emit a headers loader array",
				Pass: true,
				Extra: map[string]any{
					"views": map[string]string{
						"src/routes/+layout.tsx": "export function headers() { return { 'X-From': 'layout' } }\nexport default ({children}) => <div>{children}</div>",
						"src/routes/+page.tsx":   "export const headers = () => ({ 'X-From': 'page' })\nexport default () => <div>hello</div>",
					},
					"expected": tests.Dedent(`
						import type { RouterManifest } from 'houdini/runtime'

						export default {
							pages: {
								"_": {
									id: "_",
									url: "/",
									pattern: /^\/$/,
									params: [],
									searchParams: [],
									documents: {
									},
									component: () => import("../units/entries/_"),
								},
							},
							pagesByUrl: {
								"/": "_",
							},
						} as const satisfies RouterManifest<any>

						export const route_headers = {
							"_": [
								() => import("../../../../src/routes/+layout").then(m => m.headers),
								() => import("../../../../src/routes/+page").then(m => m.headers),
							],
						}

						export type RouteScalars = {
						}
					`) + "\n" + tsTypeManifest,
				},
			},
			{
				Name: "subscription appears as optional MockValue field in mock",
				Pass: true,
				Input: []string{
					mockQuery("PageQuery", false),
					"subscription UserEvents { id }",
				},
				Filepaths: []string{
					"src/routes/+page.gql",
				},
				Extra: map[string]any{
					"views": map[string]string{
						"src/routes/+page.tsx": mockView([]string{"PageQuery"}),
					},
					"expectedMock": "import React from 'react'\n" +
						"import { _createMock, buildMockPath } from './testing'\n" +
						"import type { RouteHrefs, ParamsForRoute, SearchForRoute } from './routes'\n" +
						"\nimport type { PageQuery$unmasked, PageQuery$input } from '$houdini/artifacts/PageQuery'\n" +
						"import type { UserEvents$unmasked, UserEvents$input } from '$houdini/artifacts/UserEvents'\n" +
						"\ntype _MockValue<R, V> = R | ((vars: V) => R)\n\n" +
						"type _TestData__ = {\n" +
						"\tPageQuery: _MockValue<PageQuery$unmasked, PageQuery$input>\n" +
						"\tUserEvents?: _MockValue<AsyncIterable<UserEvents$unmasked>, UserEvents$input>\n" +
						"}\n\n" +
						"type _RouteData = {\n" +
						"\t\"/\": _TestData__\n" +
						"}\n" +
						"type _DataForRoute<H extends string> = H extends keyof _RouteData ? _RouteData[H] : never\n\n" +
						"export function createMock<H extends RouteHrefs>(args: { url: H; data: _DataForRoute<H> } & ParamsForRoute<H> & SearchForRoute<H>): React.ComponentType<{}> {\n" +
						"\treturn _createMock({ path: buildMockPath(args.url as string, (args as any).params ?? {}, (args as any).search), data: args.data as Record<string, any> })\n" +
						"}\n",
				},
			},
			{
				Name: "custom scalar emitted in RouteScalars",
				Pass: true,
				ProjectConfig: func(cfg *plugins.ProjectConfig) {
					if cfg.Scalars == nil {
						cfg.Scalars = make(map[string]plugins.ScalarConfig)
					}
					cfg.Scalars["DateTime"] = plugins.ScalarConfig{Type: "Date"}
				},
				Extra: map[string]any{
					"expected": tests.Dedent(`
						import type { RouterManifest } from 'houdini/runtime'

						export default {
							pages: {
							},
							pagesByUrl: {
							},
						} as const satisfies RouterManifest<any>

						export type RouteScalars = {
							DateTime: Date
						}
					`) + "\n" + tsTypeManifest,
				},
			},
		},
	})
}
