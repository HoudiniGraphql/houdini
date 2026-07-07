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

// pluginUnitsDir returns the absolute path to the plugin's units directory.
func pluginUnitsDir(p *plugin.HoudiniReact) string {
	cfg, _ := p.DB.ProjectConfig(context.Background())
	return filepath.Join(cfg.PluginDirectory(p.Name()), "units")
}

// insertComponentFields inserts component_field rows directly into the DB.
// Each row must have keys: filepath, type, field, prop, fragment, content.
func insertComponentFields(t *testing.T, p *plugin.HoudiniReact, rows []map[string]any) {
	t.Helper()
	ctx := context.Background()
	conn, err := p.DB.Take(ctx)
	require.NoError(t, err)
	defer p.DB.Put(conn)

	for _, row := range rows {
		insertRaw, err := conn.Prepare(`INSERT INTO raw_documents (content, filepath) VALUES ($c, $f)`)
		require.NoError(t, err)
		content, _ := row["content"].(string) // default to "" if absent
		require.NoError(t, p.DB.ExecStatement(insertRaw, map[string]any{
			"c": content,
			"f": row["filepath"],
		}))
		insertRaw.Finalize()
		rawID := conn.LastInsertRowID()

		insertCF, err := conn.Prepare(
			`INSERT INTO component_fields (document, type, field, prop, fragment) VALUES ($d, $t, $fi, $p, $fr)`,
		)
		require.NoError(t, err)
		require.NoError(t, p.DB.ExecStatement(insertCF, map[string]any{
			"d": rawID, "t": row["type"], "fi": row["field"],
			"p": row["prop"], "fr": row["fragment"],
		}))
		insertCF.Finalize()
	}
}

func TestGenerateComponentFieldWrappers(t *testing.T) {
	tests.RunTable(t, tests.Table[coreConfig.PluginConfig, *plugin.HoudiniReact]{
		Schema:            `type Query { id: ID }`,
		SetupAlwaysPasses: true,

		SetupTest: func(t *testing.T, p *plugin.HoudiniReact, test tests.Test[coreConfig.PluginConfig]) {
			if rows, ok := test.Extra["rows"].([]map[string]any); ok {
				insertComponentFields(t, p, rows)
			}
		},

		PerformTest: func(t *testing.T, p *plugin.HoudiniReact, test tests.Test[coreConfig.PluginConfig]) {
			ctx := context.Background()
			_, err := p.GenerateComponentFieldWrappers(ctx)
			require.NoError(t, err)

			units := pluginUnitsDir(p)
			for file, expected := range test.Extra["expected"].(map[string]string) {
				got, err := afero.ReadFile(p.Filesystem(), filepath.Join(units, file))
				require.NoError(t, err)
				require.Equal(t, expected, string(got), "file: %s", file)
			}
		},

		Tests: []tests.Test[coreConfig.PluginConfig]{
			{
				Name: "generates wrapper that calls useFragment and registers with component cache",
				Pass: true,
				Extra: map[string]any{
					"rows": []map[string]any{
						{
							// filepath is the component file — stripped ext gives the import path
							"filepath": "src/components/Avatar.tsx",
							"type":     "User",
							"field":    "Avatar",
							"prop":     "user",
							"fragment": "UserAvatar",
						},
					},
					// wrapper is at {pluginDir}/units/componentFields/wrapper_UserAvatar.jsx
					// 6 levels up from there reaches /project, then src/components/Avatar
					"expected": map[string]string{
						"componentFields/wrapper_UserAvatar.jsx": `import { useFragment } from '$houdini'
import client from '$houdini/plugins/houdini-react/runtime/client'
import Component from '../../../../../src/components/Avatar'

import artifact from '$houdini/artifacts/UserAvatar'

const UserAvatar = ({ user, ...props }) => {
	const value = useFragment(user, { artifact })
	return <Component user={value} {...props} />
}

if (globalThis.window) {
	let window = globalThis.window

	if (!window.__houdini__client__) {
		window.__houdini__client__ = client()
	}

	window.__houdini__client__.componentCache["User.Avatar"] = UserAvatar
}

export default UserAvatar
`,
					},
				},
			},
		},
	})
}

func TestGenerateDocumentWrappers(t *testing.T) {
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
			_, err := p.GenerateDocumentWrappers(ctx)
			require.NoError(t, err)

			units := pluginUnitsDir(p)
			for file, expected := range test.Extra["expected"].(map[string]string) {
				got, err := afero.ReadFile(p.Filesystem(), filepath.Join(units, file))
				require.NoError(t, err)
				require.Equal(t, expected, string(got), "file: %s", file)
			}
		},

		Tests: []tests.Test[coreConfig.PluginConfig]{
			{
				// Ported from entries.test.ts "composes layouts and pages"
				Name: "page unit passes queries as props",
				Pass: true,
				Input: []string{
					mockQuery("RootQuery", true),
					mockQuery("SubQuery", false),
					mockQuery("FinalQuery", true),
				},
				Filepaths: []string{
					"src/routes/+layout.gql",
					"src/routes/subRoute/+layout.gql",
					"src/routes/subRoute/nested/+page.gql",
				},
				Extra: map[string]any{
					"views": map[string]string{
						"src/routes/+layout.tsx":               "export default ({children}) => <div>{children}</div>",
						"src/routes/subRoute/+layout.tsx":      mockView([]string{"RootQuery", "SubQuery"}),
						"src/routes/subRoute/nested/+page.tsx": mockView([]string{"FinalQuery"}),
					},
					"expected": map[string]string{
						// page unit: passes ALL accumulated queries (page.Queries = page.QueryOptions)
						"pages/_subRoute_nested.jsx": `import { useQueryResult, PageContextProvider } from '$houdini/plugins/houdini-react/runtime/routing'
import Component__subRoute_nested from '../../../../../src/routes/subRoute/nested/+page'

export default ({ children }) => {
	const [RootQuery$data, RootQuery$handle] = useQueryResult("RootQuery")
	const [SubQuery$data, SubQuery$handle] = useQueryResult("SubQuery")
	const [FinalQuery$data, FinalQuery$handle] = useQueryResult("FinalQuery")

	return (
		<PageContextProvider keys={[]}>
			<Component__subRoute_nested RootQuery={RootQuery$data} RootQuery$handle={RootQuery$handle} SubQuery={SubQuery$data} SubQuery$handle={SubQuery$handle} FinalQuery={FinalQuery$data} FinalQuery$handle={FinalQuery$handle}>
				{children}
			</Component__subRoute_nested>
		</PageContextProvider>
	)
}
`,
						// root layout unit: QueryOptions = ["RootQuery"] so one call
						"layouts/_.jsx": `import { useQueryResult, PageContextProvider } from '$houdini/plugins/houdini-react/runtime/routing'
import Component__ from '../../../../../src/routes/+layout'

export default ({ children }) => {
	const [RootQuery$data, RootQuery$handle] = useQueryResult("RootQuery")

	return (
		<PageContextProvider keys={[]}>
			<Component__ RootQuery={RootQuery$data} RootQuery$handle={RootQuery$handle}>
				{children}
			</Component__>
		</PageContextProvider>
	)
}
`,
						// subRoute layout unit: QueryOptions = ["RootQuery", "SubQuery"]
						"layouts/_subRoute.jsx": `import { useQueryResult, PageContextProvider } from '$houdini/plugins/houdini-react/runtime/routing'
import Component__subRoute from '../../../../../src/routes/subRoute/+layout'

export default ({ children }) => {
	const [RootQuery$data, RootQuery$handle] = useQueryResult("RootQuery")
	const [SubQuery$data, SubQuery$handle] = useQueryResult("SubQuery")

	return (
		<PageContextProvider keys={[]}>
			<Component__subRoute RootQuery={RootQuery$data} RootQuery$handle={RootQuery$handle} SubQuery={SubQuery$data} SubQuery$handle={SubQuery$handle}>
				{children}
			</Component__subRoute>
		</PageContextProvider>
	)
}
`,
					},
				},
			},
			{
				// Ported from entries.test.ts "layout with params"
				Name: "page unit includes param keys in PageContextProvider",
				Pass: true,
				Input: []string{
					"query RootQuery($id: ID!) {\n\tnode(id: $id) { id }\n}\n",
				},
				Filepaths: []string{
					"src/routes/[id]/+layout.gql",
				},
				Extra: map[string]any{
					"views": map[string]string{
						"src/routes/[id]/+page.tsx": mockView([]string{"RootQuery"}),
					},
					"expected": map[string]string{
						"pages/__id_.jsx": `import { useQueryResult, PageContextProvider } from '$houdini/plugins/houdini-react/runtime/routing'
import Component___id_ from '../../../../../src/routes/[id]/+page'

export default ({ children }) => {
	const [RootQuery$data, RootQuery$handle] = useQueryResult("RootQuery")

	return (
		<PageContextProvider keys={["id"]}>
			<Component___id_ RootQuery={RootQuery$data} RootQuery$handle={RootQuery$handle}>
				{children}
			</Component___id_>
		</PageContextProvider>
	)
}
`,
					},
				},
			},
		},
	})
}

func TestGenerateFallbacks(t *testing.T) {
	tests.RunTable(t, tests.Table[coreConfig.PluginConfig, *plugin.HoudiniReact]{
		Schema:            `type Query { id: ID }`,
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
			_, err := p.GenerateFallbacks(ctx)
			require.NoError(t, err)

			units := pluginUnitsDir(p)
			for file, expected := range test.Extra["expected"].(map[string]string) {
				got, err := afero.ReadFile(p.Filesystem(), filepath.Join(units, file))
				require.NoError(t, err)
				require.Equal(t, expected, string(got), "file: %s", file)
			}
		},

		Tests: []tests.Test[coreConfig.PluginConfig]{
			{
				// Ported from entries.test.ts fallback assertions
				Name: "generates fallback with loading queries",
				Pass: true,
				Input: []string{
					mockQuery("RootQuery", true),
					mockQuery("FinalQuery", true),
				},
				Filepaths: []string{
					"src/routes/+layout.gql",
					"src/routes/subRoute/nested/+page.gql",
				},
				Extra: map[string]any{
					"views": map[string]string{
						"src/routes/+layout.tsx":               "export default ({children}) => <div>{children}</div>",
						"src/routes/subRoute/nested/+page.tsx": mockView([]string{"FinalQuery"}),
					},
					"expected": map[string]string{
						// page fallback: FinalQuery is @loading, and the page inherits the
						// root layout's @loading RootQuery (the frame renders the page with
						// every query it receives, so inherited ones are included too)
						"fallbacks/page/_subRoute_nested.jsx": `import { useRouterContext, useCache, useClient } from '$houdini/plugins/houdini-react/runtime/routing/Router'
import { useDocumentHandle } from '$houdini/plugins/houdini-react/runtime/hooks/useDocumentHandle'
import Component from '../../../../../../src/routes/subRoute/nested/+page'
import React, { Suspense } from 'react'

export const Frame = () => {
	const { artifact_cache } = useRouterContext()
	const cache = useCache()
	const client = useClient()
	const RootQuery_artifact = artifact_cache.get("RootQuery")
	const RootQuery_loading = React.useMemo(() => ({
		data: cache.read({ selection: RootQuery_artifact.selection, loading: true }).data,
		errors: null,
		fetching: true,
		partial: false,
		stale: false,
		source: null,
		variables: null,
	}), [cache, RootQuery_artifact])
	const RootQuery_observer = React.useMemo(() => client.observe({ artifact: RootQuery_artifact, cache }), [client, RootQuery_artifact, cache])
	const RootQuery_handle = useDocumentHandle({
		artifact: RootQuery_artifact,
		observer: RootQuery_observer,
		storeValue: RootQuery_loading,
	})
	const FinalQuery_artifact = artifact_cache.get("FinalQuery")
	const FinalQuery_loading = React.useMemo(() => ({
		data: cache.read({ selection: FinalQuery_artifact.selection, loading: true }).data,
		errors: null,
		fetching: true,
		partial: false,
		stale: false,
		source: null,
		variables: null,
	}), [cache, FinalQuery_artifact])
	const FinalQuery_observer = React.useMemo(() => client.observe({ artifact: FinalQuery_artifact, cache }), [client, FinalQuery_artifact, cache])
	const FinalQuery_handle = useDocumentHandle({
		artifact: FinalQuery_artifact,
		observer: FinalQuery_observer,
		storeValue: FinalQuery_loading,
	})
	const props = {
		RootQuery: RootQuery_loading.data,
		RootQuery$handle: RootQuery_handle,
		FinalQuery: FinalQuery_loading.data,
		FinalQuery$handle: FinalQuery_handle,
	}
	return <Component {...props} />
}

export default ({ children }) => {
	const { artifact_cache } = useRouterContext()
	artifact_cache.get("RootQuery")
	artifact_cache.get("FinalQuery")

	return (
		<Suspense fallback={<Frame />}>
			{children}
		</Suspense>
	)
}
`,
						// layout fallback: RootQuery is @loading
						"fallbacks/layout/_.jsx": `import { useRouterContext, useCache, useClient } from '$houdini/plugins/houdini-react/runtime/routing/Router'
import { useDocumentHandle } from '$houdini/plugins/houdini-react/runtime/hooks/useDocumentHandle'
import Component from '../../../../../../src/routes/+layout'
import React, { Suspense } from 'react'

export const Frame = () => {
	const { artifact_cache } = useRouterContext()
	const cache = useCache()
	const client = useClient()
	const RootQuery_artifact = artifact_cache.get("RootQuery")
	const RootQuery_loading = React.useMemo(() => ({
		data: cache.read({ selection: RootQuery_artifact.selection, loading: true }).data,
		errors: null,
		fetching: true,
		partial: false,
		stale: false,
		source: null,
		variables: null,
	}), [cache, RootQuery_artifact])
	const RootQuery_observer = React.useMemo(() => client.observe({ artifact: RootQuery_artifact, cache }), [client, RootQuery_artifact, cache])
	const RootQuery_handle = useDocumentHandle({
		artifact: RootQuery_artifact,
		observer: RootQuery_observer,
		storeValue: RootQuery_loading,
	})
	const props = {
		RootQuery: RootQuery_loading.data,
		RootQuery$handle: RootQuery_handle,
	}
	return <Component {...props} />
}

export default ({ children }) => {
	const { artifact_cache } = useRouterContext()
	artifact_cache.get("RootQuery")

	return (
		<Suspense fallback={<Frame />}>
			{children}
		</Suspense>
	)
}
`,
					},
				},
			},
		},
	})
}

func TestGeneratePageEntries(t *testing.T) {
	tests.RunTable(t, tests.Table[coreConfig.PluginConfig, *plugin.HoudiniReact]{
		Schema:            `type Query { id: ID }`,
		SetupAlwaysPasses: true,

		SetupTest: func(t *testing.T, p *plugin.HoudiniReact, test tests.Test[coreConfig.PluginConfig]) {
			if views, ok := test.Extra["views"].(map[string]string); ok {
				fs := p.Filesystem()
				for fp, content := range views {
					abs := filepath.Join("/project", fp)
					require.NoError(t, fs.MkdirAll(filepath.Dir(abs), 0755))
					require.NoError(t, afero.WriteFile(fs, abs, []byte(content), 0644))
				}
			}
			if rows, ok := test.Extra["component_fields"].([]map[string]any); ok {
				insertComponentFields(t, p, rows)
			}
		},

		PerformTest: func(t *testing.T, p *plugin.HoudiniReact, test tests.Test[coreConfig.PluginConfig]) {
			ctx := context.Background()
			_, err := p.GeneratePageEntries(ctx)
			require.NoError(t, err)

			units := pluginUnitsDir(p)
			for file, expected := range test.Extra["expected"].(map[string]string) {
				got, err := afero.ReadFile(p.Filesystem(), filepath.Join(units, file))
				require.NoError(t, err)
				require.Equal(t, expected, string(got), "file: %s", file)
			}
		},

		Tests: []tests.Test[coreConfig.PluginConfig]{
			{
				// Ported from entries.test.ts "composes layouts and pages"
				Name: "composes layout wrappers and fallbacks around page",
				Pass: true,
				Input: []string{
					mockQuery("RootQuery", true),
					mockQuery("SubQuery", false),
					mockQuery("FinalQuery", true),
				},
				Filepaths: []string{
					"src/routes/+layout.gql",
					"src/routes/subRoute/+layout.gql",
					"src/routes/subRoute/nested/+page.gql",
				},
				Extra: map[string]any{
					"views": map[string]string{
						"src/routes/+layout.tsx":               "export default ({children}) => <div>{children}</div>",
						"src/routes/subRoute/+layout.tsx":      mockView([]string{"RootQuery", "SubQuery"}),
						"src/routes/subRoute/nested/+page.tsx": mockView([]string{"FinalQuery"}),
					},
					// entry composes: LayoutFallback(root) > Layout(root) > Layout(subRoute) > PageFallback > Page
					"expected": map[string]string{
						"entries/_subRoute_nested.jsx": `import Layout__ from '../layouts/_.jsx'
import Layout__subRoute from '../layouts/_subRoute.jsx'
import Page__subRoute_nested from '../pages/_subRoute_nested.jsx'
import client from '$houdini/plugins/houdini-react/runtime/client'
import { NotFoundGate, setCurrentSegment } from '$houdini/plugins/houdini-react/runtime/routing'
import PageFallback__subRoute_nested, { Frame as Frame__subRoute_nested } from '../fallbacks/page/_subRoute_nested.jsx'
import LayoutFallback__ from '../fallbacks/layout/_.jsx'

const SegmentSetter__ = ({ children }) => { setCurrentSegment('_'); return children }
const SegmentSetter__subRoute = ({ children }) => { setCurrentSegment('_subRoute'); return children }

export default ({ showLoading }) => {
	return (
		<LayoutFallback__>
			<SegmentSetter__>
				<Layout__>
					<SegmentSetter__subRoute>
						<Layout__subRoute>
							<NotFoundGate>
								<PageFallback__subRoute_nested>
									{showLoading ? <Frame__subRoute_nested /> : <Page__subRoute_nested />}
								</PageFallback__subRoute_nested>
							</NotFoundGate>
						</Layout__subRoute>
					</SegmentSetter__subRoute>
				</Layout__>
			</SegmentSetter__>
		</LayoutFallback__>
	)
}
`,
					},
				},
			},
			{
				Name: "includes side-effect imports for component field wrappers",
				Pass: true,
				Input: []string{mockQuery("FinalQuery", false)},
				Filepaths: []string{"src/routes/+page.gql"},
				Extra: map[string]any{
					"views": map[string]string{
						"src/routes/+page.tsx": mockView([]string{"FinalQuery"}),
					},
					"component_fields": []map[string]any{
						{"filepath": "src/components/Avatar.tsx", "type": "User", "field": "Avatar", "prop": "user", "fragment": "UserAvatar", "content": ""},
					},
					"expected": map[string]string{
						"entries/_.jsx": `import Page__ from '../pages/_.jsx'
import client from '$houdini/plugins/houdini-react/runtime/client'
import { NotFoundGate } from '$houdini/plugins/houdini-react/runtime/routing'
import '../componentFields/wrapper_UserAvatar'

export default ({ showLoading }) => {
	return (
		<NotFoundGate>
			<Page__ />
		</NotFoundGate>
	)
}
`,
					},
				},
			},
			{
				Name: "wraps page with error boundary when +error.tsx is present",
				Pass: true,
				Input: []string{
					mockQuery("RootQuery", false),
					mockQuery("PageQuery", false),
				},
				Filepaths: []string{
					"src/routes/+layout.gql",
					"src/routes/subRoute/+page.gql",
				},
				Extra: map[string]any{
					"views": map[string]string{
						"src/routes/+layout.tsx":           "export default ({children}) => <div>{children}</div>",
						"src/routes/subRoute/+page.tsx":    mockView([]string{"RootQuery", "PageQuery"}),
						"src/routes/subRoute/+error.tsx":   "export default ({ errors }) => <div>{errors[0].message}</div>",
					},
					// entry: Layout(root) > Error > Page (no fallbacks — no @loading)
					"expected": map[string]string{
						"entries/_subRoute.jsx": `import Layout__ from '../layouts/_.jsx'
import Error__subRoute from '../errors/_subRoute.jsx'
import Page__subRoute from '../pages/_subRoute.jsx'
import client from '$houdini/plugins/houdini-react/runtime/client'
import { NotFoundGate, setCurrentSegment } from '$houdini/plugins/houdini-react/runtime/routing'

const SegmentSetter__ = ({ children }) => { setCurrentSegment('_'); return children }

export default ({ showLoading }) => {
	return (
		<SegmentSetter__>
			<Layout__>
				<Error__subRoute>
					<NotFoundGate>
						<Page__subRoute />
					</NotFoundGate>
				</Error__subRoute>
			</Layout__>
		</SegmentSetter__>
	)
}
`,
					},
				},
			},
		},
	})
}

func TestGenerateErrorWrappers(t *testing.T) {
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
			_, err := p.GenerateErrorWrappers(ctx)
			require.NoError(t, err)

			units := pluginUnitsDir(p)
			for file, expected := range test.Extra["expected"].(map[string]string) {
				got, err := afero.ReadFile(p.Filesystem(), filepath.Join(units, file))
				require.NoError(t, err)
				require.Equal(t, expected, string(got), "file: %s", file)
			}
		},

		Tests: []tests.Test[coreConfig.PluginConfig]{
			{
				Name: "generates error wrapper with no layout queries",
				Pass: true,
				Extra: map[string]any{
					"views": map[string]string{
						"src/routes/+page.tsx":  mockView([]string{}),
						"src/routes/+error.tsx": "export default ({ errors }) => <div>{errors[0].message}</div>",
					},
					"expected": map[string]string{
						"errors/_.jsx": `import { useQueryResult, PageContextProvider, HoudiniErrorBoundary, RedirectError, ClientRedirect } from '$houdini/plugins/houdini-react/runtime/routing'
import Component__ from '../../../../../src/routes/+error'

const ErrorView = ({ errors, children }) => {
	const redirectErr = errors.find(e => e instanceof RedirectError)
	if (redirectErr) return <ClientRedirect to={redirectErr.location} />
	return (
		<PageContextProvider keys={[]}>
			<Component__ errors={errors}>
				{children}
			</Component__>
		</PageContextProvider>
	)
}

export default ({ children }) => (
	<HoudiniErrorBoundary errorView={ErrorView}>
		{children}
	</HoudiniErrorBoundary>
)
`,
					},
				},
			},
			{
				Name: "generates error wrapper with layout queries",
				Pass: true,
				Input: []string{
					mockQuery("RootQuery", false),
					mockQuery("SubQuery", false),
				},
				Filepaths: []string{
					"src/routes/+layout.gql",
					"src/routes/subRoute/+layout.gql",
				},
				Extra: map[string]any{
					"views": map[string]string{
						"src/routes/+layout.tsx":         "export default ({children}) => <div>{children}</div>",
						"src/routes/subRoute/+page.tsx":  mockView([]string{"RootQuery", "SubQuery"}),
						"src/routes/subRoute/+error.tsx": "export default ({ errors }) => <div>{errors[0].message}</div>",
					},
					// error wrapper at subRoute: layout queries are RootQuery + SubQuery
					"expected": map[string]string{
						"errors/_subRoute.jsx": `import { useQueryResult, PageContextProvider, HoudiniErrorBoundary, RedirectError, ClientRedirect } from '$houdini/plugins/houdini-react/runtime/routing'
import Component__subRoute from '../../../../../src/routes/subRoute/+error'

const ErrorView = ({ errors, children }) => {
	const redirectErr = errors.find(e => e instanceof RedirectError)
	if (redirectErr) return <ClientRedirect to={redirectErr.location} />
	const [RootQuery$data, RootQuery$handle] = useQueryResult("RootQuery")
	const [SubQuery$data, SubQuery$handle] = useQueryResult("SubQuery")

	return (
		<PageContextProvider keys={[]}>
			<Component__subRoute RootQuery={RootQuery$data} RootQuery$handle={RootQuery$handle} SubQuery={SubQuery$data} SubQuery$handle={SubQuery$handle} errors={errors}>
				{children}
			</Component__subRoute>
		</PageContextProvider>
	)
}

export default ({ children }) => (
	<HoudiniErrorBoundary errorView={ErrorView}>
		{children}
	</HoudiniErrorBoundary>
)
`,
					},
				},
			},
		},
	})
}

func TestGenerateRenderInfrastructure(t *testing.T) {
	tests.RunTable(t, tests.Table[coreConfig.PluginConfig, *plugin.HoudiniReact]{
		Schema:            `type Query { id: ID }`,
		SetupAlwaysPasses: true,

		SetupTest: func(t *testing.T, p *plugin.HoudiniReact, test tests.Test[coreConfig.PluginConfig]) {
			if apiFiles, ok := test.Extra["api_files"].(map[string]string); ok {
				fs := p.Filesystem()
				for fp, content := range apiFiles {
					abs := filepath.Join("/project", fp)
					require.NoError(t, fs.MkdirAll(filepath.Dir(abs), 0755))
					require.NoError(t, afero.WriteFile(fs, abs, []byte(content), 0644))
				}
			}
			if rows, ok := test.Extra["component_fields"].([]map[string]any); ok {
				insertComponentFields(t, p, rows)
			}
		},

		PerformTest: func(t *testing.T, p *plugin.HoudiniReact, test tests.Test[coreConfig.PluginConfig]) {
			ctx := context.Background()
			_, err := p.GenerateRenderInfrastructure(ctx)
			require.NoError(t, err)

			units := pluginUnitsDir(p)
			for file, expected := range test.Extra["expected"].(map[string]string) {
				got, err := afero.ReadFile(p.Filesystem(), filepath.Join(units, file))
				require.NoError(t, err)
				require.Equal(t, expected, string(got), "file: %s", file)
			}
		},

		Tests: []tests.Test[coreConfig.PluginConfig]{
			{
				Name: "generates App.jsx and config.js without schema or yoga",
				Pass: true,
				Extra: map[string]any{
					// render/ is at {pluginDir}/units/render — 5 levels up reaches projectRoot
					"expected": map[string]string{
						"render/App.jsx": `import { Router } from '$houdini/plugins/houdini-react/runtime'
import React from 'react'

import Shell from '../../../../../src/+index'

export default ({ cssLinks, ...props }) => (
	<>
		{(cssLinks || []).map(href => <link key={href} rel="stylesheet" href={href} precedence="default" />)}
		<Shell>
			<Router {...props} />
		</Shell>
	</>
)
`,
						"render/config.js": `import { createServerAdapter as createAdapter } from './server'
import config_file from '../../../../../houdini.config'
const server_config = {}

const schema = null
const yoga = null

export const endpoint = "/_api"

export const componentCache = {}

export function createServerAdapter(options) {
	return createAdapter({
		schema,
		yoga,
		componentCache,
		graphqlEndpoint: endpoint,
		config_file,
		server_config,
		...options,
	})
}
`,
					},
				},
			},
			{
				Name: "config.js imports schema when local schema is present",
				Pass: true,
				Extra: map[string]any{
					"api_files": map[string]string{
						"src/server/+schema.js": "export default 'schema'",
					},
					"expected": map[string]string{
						"render/config.js": `import { createServerAdapter as createAdapter } from './server'
import config_file from '../../../../../houdini.config'
const server_config = {}

import schema from '../../../../../src/server/+schema'
const yoga = null

export const endpoint = "/_api"

export const componentCache = {}

export function createServerAdapter(options) {
	return createAdapter({
		schema,
		yoga,
		componentCache,
		graphqlEndpoint: endpoint,
		config_file,
		server_config,
		...options,
	})
}
`,
					},
				},
			},
			{
				Name: "config.js imports yoga when local yoga is present",
				Pass: true,
				Extra: map[string]any{
					"api_files": map[string]string{
						"src/server/+yoga.js": "export default 'yoga'",
					},
					"expected": map[string]string{
						"render/config.js": `import { createServerAdapter as createAdapter } from './server'
import config_file from '../../../../../houdini.config'
const server_config = {}

const schema = null
import yoga from '../../../../../src/server/+yoga'

export const endpoint = "/_api"

export const componentCache = {}

export function createServerAdapter(options) {
	return createAdapter({
		schema,
		yoga,
		componentCache,
		graphqlEndpoint: endpoint,
		config_file,
		server_config,
		...options,
	})
}
`,
					},
				},
			},
			{
				Name: "config.js includes component field imports and componentCache",
				Pass: true,
				Extra: map[string]any{
					"component_fields": []map[string]any{
						{"filepath": "src/components/Avatar.tsx", "type": "User", "field": "Avatar", "prop": "user", "fragment": "UserAvatar", "content": ""},
					},
					// wrapper import: ../componentFields/wrapper_UserAvatar (from render/)
					"expected": map[string]string{
						"render/config.js": `import { createServerAdapter as createAdapter } from './server'
import config_file from '../../../../../houdini.config'
const server_config = {}

import UserAvatar from '../componentFields/wrapper_UserAvatar.jsx'

const schema = null
const yoga = null

export const endpoint = "/_api"

export const componentCache = {
	"User.Avatar": UserAvatar,
}

export function createServerAdapter(options) {
	return createAdapter({
		schema,
		yoga,
		componentCache,
		graphqlEndpoint: endpoint,
		config_file,
		server_config,
		...options,
	})
}
`,
					},
				},
			},
		},
	})
}

func TestGenerateTypeRoots(t *testing.T) {
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
			cfg, err := p.DB.ProjectConfig(ctx)
			require.NoError(t, err)
			// $types.d.ts files are written to .houdini/types/src/routes/...
			typeRootDir := filepath.Join(cfg.ProjectRoot, cfg.RuntimeDir, "types")
			_, err = p.GenerateTypeRoots(ctx)
			require.NoError(t, err)

			for file, expected := range test.Extra["expected"].(map[string]string) {
				abs := filepath.Join(typeRootDir, file)
				got, err := afero.ReadFile(p.Filesystem(), abs)
				require.NoError(t, err)
				require.Equal(t, expected, string(got), "file: %s", file)
			}
		},

		Tests: []tests.Test[coreConfig.PluginConfig]{
			{
				// Ported from typeRoot.test.ts "generates type files for pages"
				Name: "generates $types.d.ts per route directory",
				Pass: true,
				Input: []string{
					mockQuery("LayoutQuery", false),
					mockQuery("FinalQuery", true),
					mockQuery("RootQuery", false),
				},
				Filepaths: []string{
					"src/routes/+layout.gql",
					"src/routes/(subRoute)/+page.gql",
					"src/routes/(subRoute)/+layout.gql",
				},
				Extra: map[string]any{
					"views": map[string]string{
						"src/routes/+page.tsx":            mockView([]string{"LayoutQuery"}),
						"src/routes/(subRoute)/+page.tsx": mockView([]string{"FinalQuery"}),
					},
					// runtime: ../../.houdini/plugins/houdini-react/runtime from src/routes/
					// artifacts: ../../.houdini/artifacts from src/routes/
					// Files live in .houdini/types/src/routes/ so imports are shorter:
					// runtime:   ../../plugins/houdini-react/runtime  (no extra .houdini/)
					// artifacts: ../../artifacts/
					"expected": map[string]string{
						"src/routes/$types.d.ts": `import { DocumentHandle } from '../../../plugins/houdini-react/runtime'
import React from 'react'
import type { LayoutQuery$result, LayoutQuery$artifact, LayoutQuery$input } from '../../../artifacts/LayoutQuery'
import type { GraphQLError } from 'houdini/runtime'
import type { RoutingError } from '../../../plugins/houdini-react/runtime'

export type PageProps = {
	LayoutQuery: LayoutQuery$result,
	LayoutQuery$handle: DocumentHandle<LayoutQuery$artifact, LayoutQuery$result, LayoutQuery$input>,
}

export type LayoutProps = {
	children: React.ReactNode,
}

export type ErrorProps = {
	errors: Array<Error | GraphQLError | RoutingError>,
	children: React.ReactNode,
	LayoutQuery: LayoutQuery$result,
	LayoutQuery$handle: DocumentHandle<LayoutQuery$artifact, LayoutQuery$result, LayoutQuery$input>,
}

type _Input<T> = T extends null | undefined ? {} : T

export type PageRoute = {
	params: Pick<_Input<LayoutQuery$input>, Extract<keyof _Input<LayoutQuery$input>, never>>,
	search: Omit<_Input<LayoutQuery$input>, never>,
}

export type LayoutRoute = {
	params: {},
	search: {},
}

export type ErrorRoute = {
	params: Pick<_Input<LayoutQuery$input>, Extract<keyof _Input<LayoutQuery$input>, never>>,
	search: Omit<_Input<LayoutQuery$input>, never>,
}
`,
						"src/routes/(subRoute)/$types.d.ts": `import { DocumentHandle } from '../../../../plugins/houdini-react/runtime'
import React from 'react'
import type { LayoutQuery$result, LayoutQuery$artifact, LayoutQuery$input } from '../../../../artifacts/LayoutQuery'
import type { RootQuery$result, RootQuery$artifact, RootQuery$input } from '../../../../artifacts/RootQuery'
import type { FinalQuery$result, FinalQuery$artifact, FinalQuery$input } from '../../../../artifacts/FinalQuery'
import type { GraphQLError } from 'houdini/runtime'
import type { RoutingError } from '../../../../plugins/houdini-react/runtime'

export type PageProps = {
	LayoutQuery: LayoutQuery$result,
	LayoutQuery$handle: DocumentHandle<LayoutQuery$artifact, LayoutQuery$result, LayoutQuery$input>,
	RootQuery: RootQuery$result,
	RootQuery$handle: DocumentHandle<RootQuery$artifact, RootQuery$result, RootQuery$input>,
	FinalQuery: FinalQuery$result,
	FinalQuery$handle: DocumentHandle<FinalQuery$artifact, FinalQuery$result, FinalQuery$input>,
}

export type LayoutProps = {
	children: React.ReactNode,
}

export type ErrorProps = {
	errors: Array<Error | GraphQLError | RoutingError>,
	children: React.ReactNode,
	LayoutQuery: LayoutQuery$result,
	LayoutQuery$handle: DocumentHandle<LayoutQuery$artifact, LayoutQuery$result, LayoutQuery$input>,
	RootQuery: RootQuery$result,
	RootQuery$handle: DocumentHandle<RootQuery$artifact, RootQuery$result, RootQuery$input>,
}

type _Input<T> = T extends null | undefined ? {} : T

export type PageRoute = {
	params: Pick<(_Input<LayoutQuery$input> & _Input<RootQuery$input> & _Input<FinalQuery$input>), Extract<keyof (_Input<LayoutQuery$input> & _Input<RootQuery$input> & _Input<FinalQuery$input>), never>>,
	search: Omit<(_Input<LayoutQuery$input> & _Input<RootQuery$input> & _Input<FinalQuery$input>), never>,
}

export type LayoutRoute = {
	params: {},
	search: {},
}

export type ErrorRoute = {
	params: Pick<(_Input<LayoutQuery$input> & _Input<RootQuery$input>), Extract<keyof (_Input<LayoutQuery$input> & _Input<RootQuery$input>), never>>,
	search: Omit<(_Input<LayoutQuery$input> & _Input<RootQuery$input>), never>,
}
`,
					},
				},
			},
			{
				// Ported from typeRoot.test.ts "generates route prop type"
				Name: "generates typed Params from route parameters",
				Pass: true,
				Input: []string{
					"query MyQuery($id: ID!) {\n\tnode(id: $id) { id }\n}\n",
				},
				Filepaths: []string{
					"src/routes/[id]/+layout.gql",
				},
				Extra: map[string]any{
					"views": map[string]string{
						"src/routes/[id]/+page.tsx": mockView([]string{"MyQuery"}),
					},
					"expected": map[string]string{
						"src/routes/[id]/$types.d.ts": `import { DocumentHandle } from '../../../../plugins/houdini-react/runtime'
import React from 'react'
import type { MyQuery$result, MyQuery$artifact, MyQuery$input } from '../../../../artifacts/MyQuery'
import type { GraphQLError } from 'houdini/runtime'
import type { RoutingError } from '../../../../plugins/houdini-react/runtime'

export type PageProps = {
	MyQuery: MyQuery$result,
	MyQuery$handle: DocumentHandle<MyQuery$artifact, MyQuery$result, MyQuery$input>,
}

export type LayoutProps = {
	children: React.ReactNode,
}

export type ErrorProps = {
	errors: Array<Error | GraphQLError | RoutingError>,
	children: React.ReactNode,
	MyQuery: MyQuery$result,
	MyQuery$handle: DocumentHandle<MyQuery$artifact, MyQuery$result, MyQuery$input>,
}

type _Input<T> = T extends null | undefined ? {} : T

export type PageRoute = {
	params: Pick<_Input<MyQuery$input>, Extract<keyof _Input<MyQuery$input>, 'id'>> & Omit<{ id: string }, keyof _Input<MyQuery$input>>,
	search: Omit<_Input<MyQuery$input>, 'id'>,
}

export type LayoutRoute = {
	params: { id: string },
	search: {},
}

export type ErrorRoute = {
	params: Pick<_Input<MyQuery$input>, Extract<keyof _Input<MyQuery$input>, 'id'>> & Omit<{ id: string }, keyof _Input<MyQuery$input>>,
	search: Omit<_Input<MyQuery$input>, 'id'>,
}
`,
					},
				},
			},
		},
	})
}
