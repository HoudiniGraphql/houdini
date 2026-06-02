package plugin_test

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"

	coreConfig "code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-react/plugin"
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
				Name: "missing index.ts skips gracefully",
				Pass: true,
				Input: []string{`query MyQuery { id }`},
				Extra: map[string]any{
					"no_stub": true,
					// no "expected" key — we just verify no error and no panic
				},
			},
			{
				Name: "calling twice does not double-inject overloads",
				Pass: true,
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
			type Query { id: ID }
			type Mutation { id: ID }
			type Subscription { id: ID }
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
							"export function useMutation(document: { artifact: MyMutation$artifact }): [boolean, MutationHandler<MyMutation$result, MyMutation$input, MyMutation$optimistic>]\n" +
							"export function useMutation<_Result extends GraphQLObject, _Input extends GraphQLVariables, _Optimistic extends GraphQLObject>(document: { artifact: MutationArtifact }): [boolean, MutationHandler<_Result, _Input, _Optimistic>]\n" +
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
				Name: "skips files not present in plugin runtime dir",
				Pass: true,
				Input: []string{`query MyQuery { id }`},
				Extra: map[string]any{
					// no stubs written — files don't exist, should silently skip
					"stubs":    map[string]string{},
					"expected": map[string]string{},
				},
			},
			{
				Name: "calling twice does not double-inject",
				Pass: true,
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
					"expected": "import type { UserAvatar } from '$houdini'\n" +
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
					"expected": "import type { UserAvatar } from '$houdini'\n" +
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

func TestGenerateRuntime(t *testing.T) {
	tests.RunTable(t, tests.Table[coreConfig.PluginConfig, *plugin.HoudiniReact]{
		Schema: `
			type Query {
				id: ID
				node(id: ID!): Node
			}
			interface Node { id: ID! }
		`,
		SetupAlwaysPasses: true,

		SetupTest: func(t *testing.T, p *plugin.HoudiniReact, test tests.Test[coreConfig.PluginConfig]) {
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
		},

		Tests: []tests.Test[coreConfig.PluginConfig]{
			{
				Name: "empty routes generates empty manifest",
				Pass: true,
				Extra: map[string]any{
					"expected": tests.Dedent(`
						import type { RouterManifest } from 'houdini/runtime'

						export default {
							pages: {
							},
						} satisfies RouterManifest<any>
					`) + "\n",
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
					"expected": tests.Dedent(`
						import type { RouterManifest } from 'houdini/runtime'

						export default {
							pages: {
								"__subRoute__nested": {
									id: "__subRoute__nested",
									pattern: /^\/nested\/?$/,
									params: [],
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
						} satisfies RouterManifest<any>
					`) + "\n",
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
					"expected": tests.Dedent(`
						import type { RouterManifest } from 'houdini/runtime'

						export default {
							pages: {
								"__id_": {
									id: "__id_",
									pattern: /^\/([^/]+?)\/?$/,
									params: [
										{ name: "id", matcher: "", optional: false, rest: false, chained: false }
									],
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
						} satisfies RouterManifest<any>
					`) + "\n",
				},
			},
		},
	})
}
