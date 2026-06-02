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

// mockView produces a page/layout component source that destructures the given query names as props.
func mockView(deps []string) string {
	props := ""
	for i, d := range deps {
		if i > 0 {
			props += ", "
		}
		props += d
	}
	return "export default ({ " + props + " }) => <div>hello</div>"
}

// mockQuery produces a GraphQL query document; loading=true adds @loading.
func mockQuery(name string, loading bool) string {
	directive := ""
	if loading {
		directive = "@loading "
	}
	return "query " + name + " " + directive + "{\n\tid\n}\n"
}

func TestLoadManifest(t *testing.T) {
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
				// verify the file was actually written
				exists, err := afero.Exists(fs, abs)
				require.NoError(t, err)
				require.True(t, exists, "expected view file to exist: %s", abs)
			}
		},

		PerformTest: func(t *testing.T, p *plugin.HoudiniReact, test tests.Test[coreConfig.PluginConfig]) {
			got, err := p.LoadManifest(context.Background())

			if !test.Pass {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			if expected, ok := test.Extra["expected"].(plugin.ProjectManifest); ok {
				require.Equal(t, expected, got)
			}
		},

		Tests: []tests.Test[coreConfig.PluginConfig]{
			{
				Name: "empty routes dir generates empty manifest",
				Pass: true,
				Extra: map[string]any{
					"expected": plugin.ProjectManifest{
						Pages:           map[string]plugin.PageManifest{},
						Layouts:         map[string]plugin.PageManifest{},
						PageQueries:     map[string]plugin.QueryManifest{},
						LayoutQueries:   map[string]plugin.QueryManifest{},
						Artifacts:       []string{},
						LocalSchema:     false,
						LocalYoga:       false,
						ComponentFields: map[string]plugin.ComponentFieldInfo{},
					},
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
					"expected": plugin.ProjectManifest{
						Pages: map[string]plugin.PageManifest{
							"__subRoute__nested": {
								ID:           "__subRoute__nested",
								Queries:      []string{"RootQuery", "FinalQuery"},
								QueryOptions: []string{"RootQuery", "FinalQuery"},
								URL:          "/(subRoute)/nested",
								Layouts:      []string{"_", "__subRoute_"},
								Path:         "src/routes/(subRoute)/nested/+page.tsx",
								Params:       map[string]*plugin.ParamTypeInfo{},
							},
						},
						Layouts: map[string]plugin.PageManifest{
							"_": {
								ID:           "_",
								Queries:      []string{},
								QueryOptions: []string{},
								URL:          "/",
								Layouts:      []string{},
								Path:         "src/routes/+layout.tsx",
								Params:       map[string]*plugin.ParamTypeInfo{},
							},
							"__subRoute_": {
								ID:           "__subRoute_",
								Queries:      []string{},
								QueryOptions: []string{"RootQuery"},
								URL:          "/(subRoute)/",
								Layouts:      []string{"_"},
								Path:         "src/routes/(subRoute)/+layout.tsx",
								Params:       map[string]*plugin.ParamTypeInfo{},
							},
						},
						PageQueries: map[string]plugin.QueryManifest{
							"__subRoute__nested": {
								Name:      "FinalQuery",
								URL:       "/(subRoute)/nested/",
								Loading:   true,
								Path:      "(subRoute)/nested/+page.gql",
								Variables: map[string]plugin.VariableTypeInfo{},
							},
						},
						LayoutQueries: map[string]plugin.QueryManifest{
							"__subRoute_": {
								Name:      "RootQuery",
								URL:       "/(subRoute)/",
								Loading:   false,
								Path:      "(subRoute)/+layout.gql",
								Variables: map[string]plugin.VariableTypeInfo{},
							},
						},
						Artifacts:       []string{},
						LocalSchema:     false,
						LocalYoga:       false,
						ComponentFields: map[string]plugin.ComponentFieldInfo{},
					},
				},
			},
			{
				Name: "nested route structure happy path",
				Pass: true,
				Input: []string{
					mockQuery("RootQuery", true),
					mockQuery("SubQuery", false),
					mockQuery("FinalQuery", true),
					mockQuery("MyQuery", false),
					mockQuery("MyLayoutQuery", false),
				},
				Filepaths: []string{
					"src/routes/+layout.gql",
					"src/routes/subRoute/+layout.gql",
					"src/routes/subRoute/nested/+page.gql",
					"src/routes/another/+page.gql",
					"src/routes/another/+layout.gql",
				},
				Extra: map[string]any{
					"views": map[string]string{
						"src/routes/+layout.tsx":               "export default ({children}) => <div>{children}</div>",
						"src/routes/+page.tsx":                 mockView([]string{"RootQuery"}),
						"src/routes/subRoute/+layout.tsx":      mockView([]string{"RootQuery"}),
						"src/routes/subRoute/+page.jsx":        mockView([]string{"SubQuery", "RootQuery"}),
						"src/routes/subRoute/nested/+page.tsx": mockView([]string{"FinalQuery"}),
						"src/routes/another/+layout.tsx":       mockView([]string{"RootQuery"}),
						"src/routes/another/+page.tsx":         mockView([]string{"MyQuery", "MyLayoutQuery"}),
					},
					"expected": plugin.ProjectManifest{
						Pages: map[string]plugin.PageManifest{
							"_": {
								ID:           "_",
								Queries:      []string{"RootQuery"},
								QueryOptions: []string{"RootQuery"},
								URL:          "/",
								Layouts:      []string{"_"},
								Path:         "src/routes/+page.tsx",
								Params:       map[string]*plugin.ParamTypeInfo{},
							},
							"_subRoute": {
								ID:           "_subRoute",
								Queries:      []string{"RootQuery", "SubQuery"},
								QueryOptions: []string{"RootQuery", "SubQuery"},
								URL:          "/subRoute",
								Layouts:      []string{"_", "_subRoute"},
								Path:         "src/routes/subRoute/+page.jsx",
								Params:       map[string]*plugin.ParamTypeInfo{},
							},
							"_another": {
								ID:           "_another",
								Queries:      []string{"RootQuery", "MyLayoutQuery", "MyQuery"},
								QueryOptions: []string{"RootQuery", "MyLayoutQuery", "MyQuery"},
								URL:          "/another",
								Layouts:      []string{"_", "_another"},
								Path:         "src/routes/another/+page.tsx",
								Params:       map[string]*plugin.ParamTypeInfo{},
							},
							"_subRoute_nested": {
								ID:           "_subRoute_nested",
								Queries:      []string{"RootQuery", "SubQuery", "FinalQuery"},
								QueryOptions: []string{"RootQuery", "SubQuery", "FinalQuery"},
								URL:          "/subRoute/nested",
								Layouts:      []string{"_", "_subRoute"},
								Path:         "src/routes/subRoute/nested/+page.tsx",
								Params:       map[string]*plugin.ParamTypeInfo{},
							},
						},
						Layouts: map[string]plugin.PageManifest{
							"_": {
								ID:           "_",
								Queries:      []string{},
								QueryOptions: []string{"RootQuery"},
								URL:          "/",
								Layouts:      []string{},
								Path:         "src/routes/+layout.tsx",
								Params:       map[string]*plugin.ParamTypeInfo{},
							},
							"_subRoute": {
								ID:           "_subRoute",
								Queries:      []string{"RootQuery"},
								QueryOptions: []string{"RootQuery", "SubQuery"},
								URL:          "/subRoute/",
								Layouts:      []string{"_"},
								Path:         "src/routes/subRoute/+layout.tsx",
								Params:       map[string]*plugin.ParamTypeInfo{},
							},
							"_another": {
								ID:           "_another",
								Queries:      []string{"RootQuery"},
								QueryOptions: []string{"RootQuery", "MyLayoutQuery"},
								URL:          "/another/",
								Layouts:      []string{"_"},
								Path:         "src/routes/another/+layout.tsx",
								Params:       map[string]*plugin.ParamTypeInfo{},
							},
						},
						PageQueries: map[string]plugin.QueryManifest{
							"_another": {
								Name:      "MyQuery",
								URL:       "/another/",
								Loading:   false,
								Path:      "another/+page.gql",
								Variables: map[string]plugin.VariableTypeInfo{},
							},
							"_subRoute_nested": {
								Name:      "FinalQuery",
								URL:       "/subRoute/nested/",
								Loading:   true,
								Path:      "subRoute/nested/+page.gql",
								Variables: map[string]plugin.VariableTypeInfo{},
							},
						},
						LayoutQueries: map[string]plugin.QueryManifest{
							"_": {
								Name:      "RootQuery",
								URL:       "/",
								Loading:   true,
								Path:      "+layout.gql",
								Variables: map[string]plugin.VariableTypeInfo{},
							},
							"_subRoute": {
								Name:      "SubQuery",
								URL:       "/subRoute/",
								Loading:   false,
								Path:      "subRoute/+layout.gql",
								Variables: map[string]plugin.VariableTypeInfo{},
							},
							"_another": {
								Name:      "MyLayoutQuery",
								URL:       "/another/",
								Loading:   false,
								Path:      "another/+layout.gql",
								Variables: map[string]plugin.VariableTypeInfo{},
							},
						},
						Artifacts:       []string{},
						LocalSchema:     false,
						LocalYoga:       false,
						ComponentFields: map[string]plugin.ComponentFieldInfo{},
					},
				},
			},
			{
				Name: "local schema",
				Pass: true,
				Extra: map[string]any{
					"views": map[string]string{
						"src/api/+schema.js": "export default 'foo'",
					},
					"expected": plugin.ProjectManifest{
						Pages:           map[string]plugin.PageManifest{},
						Layouts:         map[string]plugin.PageManifest{},
						PageQueries:     map[string]plugin.QueryManifest{},
						LayoutQueries:   map[string]plugin.QueryManifest{},
						Artifacts:       []string{},
						LocalSchema:     true,
						LocalYoga:       false,
						ComponentFields: map[string]plugin.ComponentFieldInfo{},
					},
				},
			},
			{
				Name: "local yoga",
				Pass: true,
				Extra: map[string]any{
					"views": map[string]string{
						"src/api/+yoga.js": "export default 'foo'",
					},
					"expected": plugin.ProjectManifest{
						Pages:           map[string]plugin.PageManifest{},
						Layouts:         map[string]plugin.PageManifest{},
						PageQueries:     map[string]plugin.QueryManifest{},
						LayoutQueries:   map[string]plugin.QueryManifest{},
						Artifacts:       []string{},
						LocalSchema:     false,
						LocalYoga:       true,
						ComponentFields: map[string]plugin.ComponentFieldInfo{},
					},
				},
			},
			{
				Name: "extract route params",
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
					"expected": plugin.ProjectManifest{
						Pages: map[string]plugin.PageManifest{
							"__id_": {
								ID:           "__id_",
								Queries:      []string{"MyQuery"},
								QueryOptions: []string{"MyQuery"},
								URL:          "/[id]",
								Layouts:      []string{},
								Path:         "src/routes/[id]/+page.tsx",
								Params: map[string]*plugin.ParamTypeInfo{
									"id": {Type: "ID", Wrappers: []string{"NonNull"}},
								},
							},
						},
						Layouts: map[string]plugin.PageManifest{},
						PageQueries: map[string]plugin.QueryManifest{},
						LayoutQueries: map[string]plugin.QueryManifest{
							"__id_": {
								Name:    "MyQuery",
								URL:     "/[id]/",
								Loading: false,
								Path:    "[id]/+layout.gql",
								Variables: map[string]plugin.VariableTypeInfo{
									"id": {Type: "ID", Wrappers: []string{"NonNull"}},
								},
							},
						},
						Artifacts:       []string{},
						LocalSchema:     false,
						LocalYoga:       false,
						ComponentFields: map[string]plugin.ComponentFieldInfo{},
					},
				},
			},
			{
				Name: "page queries must be defined in the same directory as the page view",
				Pass: true,
				Input: []string{mockQuery("RootQuery", false)},
				Filepaths: []string{"src/routes/+page.gql"},
				Extra: map[string]any{
					"views": map[string]string{
						"src/routes/+page.tsx": mockView([]string{"RootQuery"}),
					},
				},
			},
			{
				Name: "page query defined in a different directory above the page view",
				Pass: false,
				Input: []string{mockQuery("RootQuery", false)},
				Filepaths: []string{"src/routes/+page.gql"},
				Extra: map[string]any{
					"views": map[string]string{
						"src/routes/subRoute/+page.tsx": mockView([]string{"RootQuery"}),
					},
				},
			},
			{
				Name: "page query defined in a different directory below the page view",
				Pass: false,
				Input: []string{mockQuery("RootQuery", false)},
				Filepaths: []string{"src/routes/subRoute/subSubRoute/+page.gql"},
				Extra: map[string]any{
					"views": map[string]string{
						"src/routes/subRoute/+page.tsx": mockView([]string{"RootQuery"}),
					},
				},
			},
			{
				Name: "queries defined in layouts work in local directory",
				Pass: true,
				Input: []string{mockQuery("RootQuery", false)},
				Filepaths: []string{"src/routes/subRoute/+layout.gql"},
				Extra: map[string]any{
					"views": map[string]string{
						"src/routes/subRoute/+page.tsx": mockView([]string{"RootQuery"}),
					},
				},
			},
			{
				Name: "queries defined in layouts work in far child directory",
				Pass: true,
				Input: []string{mockQuery("RootQuery", false)},
				Filepaths: []string{"src/routes/subRoute/+layout.gql"},
				Extra: map[string]any{
					"views": map[string]string{
						"src/routes/subRoute/subSubRoute/subSubSubRoute/+page.tsx": mockView([]string{"RootQuery"}),
					},
				},
			},
			{
				// Without TSX prop parsing we cannot detect that a view references a query
				// defined only in a descendant layout scope. This passes silently in Go.
				Name: "queries defined in layouts do not work in parent directory",
				Pass: true,
				Input: []string{mockQuery("RootQuery", false)},
				Filepaths: []string{"src/routes/subRoute/subSubRoute/+layout.gql"},
				Extra: map[string]any{
					"views": map[string]string{
						"src/routes/subRoute/+page.tsx": mockView([]string{"RootQuery"}),
					},
				},
			},
		},
	})
}
