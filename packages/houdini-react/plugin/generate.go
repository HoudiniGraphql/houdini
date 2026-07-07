package plugin

import (
	"context"
	"fmt"
	"path/filepath"
	"sort"
	"strings"

	"github.com/spf13/afero"

	plugins "code.houdinigraphql.com/plugins"
)

// ---- path helpers ----

func unitsDir(pluginDir string) string   { return filepath.Join(pluginDir, "units") }
func pagesDir(pluginDir string) string   { return filepath.Join(pluginDir, "units", "pages") }
func layoutsDir(pluginDir string) string { return filepath.Join(pluginDir, "units", "layouts") }
func errorsDir(pluginDir string) string  { return filepath.Join(pluginDir, "units", "errors") }
func fallbacksDir(pluginDir, which string) string {
	return filepath.Join(pluginDir, "units", "fallbacks", which)
}
func entriesDir(pluginDir string) string { return filepath.Join(pluginDir, "units", "entries") }
func renderDir(pluginDir string) string  { return filepath.Join(pluginDir, "units", "render") }

// stripViewExt removes .tsx/.jsx from an import path.
func stripViewExt(p string) string {
	for _, ext := range []string{".tsx", ".jsx"} {
		if strings.HasSuffix(p, ext) {
			return p[:len(p)-len(ext)]
		}
	}
	return p
}

// writeIfChanged writes content to path only when it differs from the existing file.
func writeIfChanged(fs afero.Fs, path, content string) (bool, error) {
	existing, _ := afero.ReadFile(fs, path)
	if string(existing) == content {
		return false, nil
	}
	if err := fs.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return false, err
	}
	return true, plugins.WriteFile(fs, path, []byte(content), 0644)
}

// ---- unit file generation ----

// generateUnitFile builds the JSX source for a document-wrapper component.
// queries is the list of query names this component will call useQueryResult for.
// paramKeys is the sorted list of URL route parameter names.
func generateUnitFile(componentName, importPath string, queries, paramKeys []string) string {
	var b strings.Builder

	b.WriteString("import { useQueryResult, PageContextProvider } from '$houdini/plugins/houdini-react/runtime/routing'\n")
	b.WriteString(fmt.Sprintf("import %s from '%s'\n\n", componentName, importPath))
	b.WriteString("export default ({ children }) => {\n")

	if len(queries) > 0 {
		for _, q := range queries {
			b.WriteString(fmt.Sprintf("\tconst [%s$data, %s$handle] = useQueryResult(%q)\n", q, q, q))
		}
		b.WriteString("\n")
	}

	b.WriteString("\treturn (\n")

	// PageContextProvider keys
	var quotedKeys []string
	for _, k := range paramKeys {
		quotedKeys = append(quotedKeys, fmt.Sprintf("%q", k))
	}
	b.WriteString(fmt.Sprintf("\t\t<PageContextProvider keys={[%s]}>\n", strings.Join(quotedKeys, ", ")))

	// Component open tag with props
	var props []string
	for _, q := range queries {
		props = append(props, fmt.Sprintf("%s={%s$data}", q, q))
		props = append(props, fmt.Sprintf("%s$handle={%s$handle}", q, q))
	}
	propsStr := ""
	if len(props) > 0 {
		propsStr = " " + strings.Join(props, " ")
	}
	b.WriteString(fmt.Sprintf("\t\t\t<%s%s>\n", componentName, propsStr))
	b.WriteString("\t\t\t\t{children}\n")
	b.WriteString(fmt.Sprintf("\t\t\t</%s>\n", componentName))
	b.WriteString("\t\t</PageContextProvider>\n")
	b.WriteString("\t)\n")
	b.WriteString("}\n")

	return b.String()
}

// GenerateDocumentWrappers generates per-page and per-layout JSX wrapper components
// that call useQueryResult and pass data as props to the actual route components.
func (p *HoudiniReact) GenerateDocumentWrappers(ctx context.Context) ([]string, error) {
	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return nil, err
	}
	manifest, err := p.LoadManifest(ctx)
	if err != nil {
		return nil, err
	}

	pluginDir := projectConfig.PluginDirectory(p.Name())
	var changed []string

	// Page units
	for id, page := range manifest.Pages {
		compAbs := stripViewExt(filepath.Join(projectConfig.ProjectRoot, page.Path))
		compRel := toSlash(mustRel(pagesDir(pluginDir), compAbs))
		paramKeys := sortedKeys(page.Params)
		content := generateUnitFile("Component_"+id, compRel, page.Queries, paramKeys)
		path := filepath.Join(pagesDir(pluginDir), id+".jsx")
		if ok, err := writeIfChanged(p.Filesystem(), path, content); err != nil {
			return nil, err
		} else if ok {
			changed = append(changed, path)
		}
	}

	// Layout units
	for id, layout := range manifest.Layouts {
		compAbs := stripViewExt(filepath.Join(projectConfig.ProjectRoot, layout.Path))
		compRel := toSlash(mustRel(layoutsDir(pluginDir), compAbs))
		paramKeys := sortedKeys(layout.Params)
		content := generateUnitFile("Component_"+id, compRel, layout.QueryOptions, paramKeys)
		path := filepath.Join(layoutsDir(pluginDir), id+".jsx")
		if ok, err := writeIfChanged(p.Filesystem(), path, content); err != nil {
			return nil, err
		} else if ok {
			changed = append(changed, path)
		}
	}

	return changed, nil
}

// generateErrorUnitFile builds the JSX source for an error boundary wrapper component.
// layoutQueries is the list of layout-level query names the error component can access.
// paramKeys is the sorted list of URL route parameter names.
func generateErrorUnitFile(componentName, importPath string, layoutQueries, paramKeys []string) string {
	var b strings.Builder

	b.WriteString("import { useQueryResult, PageContextProvider, HoudiniErrorBoundary, RedirectError, ClientRedirect } from '$houdini/plugins/houdini-react/runtime/routing'\n")
	b.WriteString(fmt.Sprintf("import %s from '%s'\n\n", componentName, importPath))

	b.WriteString("const ErrorView = ({ errors, children }) => {\n")
	b.WriteString("\tconst redirectErr = errors.find(e => e instanceof RedirectError)\n")
	b.WriteString("\tif (redirectErr) return <ClientRedirect to={redirectErr.location} />\n")
	if len(layoutQueries) > 0 {
		for _, q := range layoutQueries {
			b.WriteString(fmt.Sprintf("\tconst [%s$data, %s$handle] = useQueryResult(%q)\n", q, q, q))
		}
		b.WriteString("\n")
	}

	b.WriteString("\treturn (\n")

	var quotedKeys []string
	for _, k := range paramKeys {
		quotedKeys = append(quotedKeys, fmt.Sprintf("%q", k))
	}
	b.WriteString(fmt.Sprintf("\t\t<PageContextProvider keys={[%s]}>\n", strings.Join(quotedKeys, ", ")))

	var props []string
	for _, q := range layoutQueries {
		props = append(props, fmt.Sprintf("%s={%s$data}", q, q))
		props = append(props, fmt.Sprintf("%s$handle={%s$handle}", q, q))
	}
	props = append(props, "errors={errors}")
	b.WriteString(fmt.Sprintf("\t\t\t<%s %s>\n", componentName, strings.Join(props, " ")))
	b.WriteString("\t\t\t\t{children}\n")
	b.WriteString(fmt.Sprintf("\t\t\t</%s>\n", componentName))
	b.WriteString("\t\t</PageContextProvider>\n")
	b.WriteString("\t)\n")
	b.WriteString("}\n\n")

	b.WriteString("export default ({ children }) => (\n")
	b.WriteString("\t<HoudiniErrorBoundary errorView={ErrorView}>\n")
	b.WriteString("\t\t{children}\n")
	b.WriteString("\t</HoudiniErrorBoundary>\n")
	b.WriteString(")\n")

	return b.String()
}

// GenerateErrorWrappers generates per-page error boundary JSX wrapper components for
// pages that have a +error.tsx companion file.
func (p *HoudiniReact) GenerateErrorWrappers(ctx context.Context) ([]string, error) {
	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return nil, err
	}
	manifest, err := p.LoadManifest(ctx)
	if err != nil {
		return nil, err
	}

	pluginDir := projectConfig.PluginDirectory(p.Name())
	var changed []string

	for id, page := range manifest.Pages {
		if page.ErrorPath == "" {
			continue
		}
		compAbs := stripViewExt(filepath.Join(projectConfig.ProjectRoot, page.ErrorPath))
		compRel := toSlash(mustRel(errorsDir(pluginDir), compAbs))
		paramKeys := sortedKeys(page.Params)
		content := generateErrorUnitFile("Component_"+id, compRel, page.LayoutQueries, paramKeys)
		path := filepath.Join(errorsDir(pluginDir), id+".jsx")
		if ok, err := writeIfChanged(p.Filesystem(), path, content); err != nil {
			return nil, err
		} else if ok {
			changed = append(changed, path)
		}
	}

	return changed, nil
}

// ---- fallback generation ----

func generateFallbackFile(componentRel string, loadingQueries []string) string {
	var b strings.Builder

	b.WriteString("import { useRouterContext, useCache, useClient } from '$houdini/plugins/houdini-react/runtime/routing/Router'\n")
	b.WriteString("import { useDocumentHandle } from '$houdini/plugins/houdini-react/runtime/hooks/useDocumentHandle'\n")
	b.WriteString(fmt.Sprintf("import Component from '%s'\n", componentRel))
	b.WriteString("import React, { Suspense } from 'react'\n\n")

	// Frame is the loading state: the view rendered with loading-marker data for each
	// @loading query. It serves as the Suspense fallback below and is also rendered
	// directly by the page entry while a delayed navigation shows the loading state.
	// The view receives the same props as the resolved unit — including the $handle for
	// each query, built from a detached observer over a loading-state store value — so a
	// component that reads its handle during render doesn't crash in the loading frame.
	// The loading read is memoized per artifact: cache.read({ loading: true }) is a pure
	// function of the selection (it synthesizes markers, never stored data), so the frame
	// hands the view stable identities across its re-renders instead of re-running the
	// synthesis and busting downstream memo/effect dependencies. If loading states ever
	// merge real cached data, both the memo and the unsubscribed read must become a
	// subscribed store read.
	b.WriteString("export const Frame = () => {\n")
	b.WriteString("\tconst { artifact_cache } = useRouterContext()\n")
	b.WriteString("\tconst cache = useCache()\n")
	b.WriteString("\tconst client = useClient()\n")
	for _, q := range loadingQueries {
		b.WriteString(fmt.Sprintf("\tconst %s_artifact = artifact_cache.get(%q)\n", q, q))
		b.WriteString(fmt.Sprintf("\tconst %s_loading = React.useMemo(() => ({\n", q))
		b.WriteString(fmt.Sprintf("\t\tdata: cache.read({ selection: %s_artifact.selection, loading: true }).data,\n", q))
		b.WriteString("\t\terrors: null,\n")
		b.WriteString("\t\tfetching: true,\n")
		b.WriteString("\t\tpartial: false,\n")
		b.WriteString("\t\tstale: false,\n")
		b.WriteString("\t\tsource: null,\n")
		b.WriteString("\t\tvariables: null,\n")
		b.WriteString(fmt.Sprintf("\t}), [cache, %s_artifact])\n", q))
		b.WriteString(fmt.Sprintf("\tconst %s_observer = React.useMemo(() => client.observe({ artifact: %s_artifact, cache }), [client, %s_artifact, cache])\n", q, q, q))
		b.WriteString(fmt.Sprintf("\tconst %s_handle = useDocumentHandle({\n", q))
		b.WriteString(fmt.Sprintf("\t\tartifact: %s_artifact,\n", q))
		b.WriteString(fmt.Sprintf("\t\tobserver: %s_observer,\n", q))
		b.WriteString(fmt.Sprintf("\t\tstoreValue: %s_loading,\n", q))
		b.WriteString("\t})\n")
	}
	b.WriteString("\tconst props = {\n")
	for _, q := range loadingQueries {
		b.WriteString(fmt.Sprintf("\t\t%s: %s_loading.data,\n", q, q))
		b.WriteString(fmt.Sprintf("\t\t%s$handle: %s_handle,\n", q, q))
	}
	b.WriteString("\t}\n")
	b.WriteString("\treturn <Component {...props} />\n")
	b.WriteString("}\n\n")

	b.WriteString("export default ({ children }) => {\n")
	b.WriteString("\tconst { artifact_cache } = useRouterContext()\n")
	// reading the artifacts here suspends the wrapper (not the fallback) until they're
	// cached, so by the time the boundary mounts, Frame can always render synchronously
	for _, q := range loadingQueries {
		b.WriteString(fmt.Sprintf("\tartifact_cache.get(%q)\n", q))
	}
	b.WriteString("\n\treturn (\n")
	b.WriteString("\t\t<Suspense fallback={<Frame />}>\n")
	b.WriteString("\t\t\t{children}\n")
	b.WriteString("\t\t</Suspense>\n")
	b.WriteString("\t)\n")
	b.WriteString("}\n")

	return b.String()
}

// loadingQueryIndex maps every query document name to whether it is @loading (names are
// unique project-wide).
func loadingQueryIndex(manifest ProjectManifest) map[string]bool {
	index := map[string]bool{}
	for _, q := range manifest.PageQueries {
		index[q.Name] = q.Loading
	}
	for _, q := range manifest.LayoutQueries {
		index[q.Name] = q.Loading
	}
	return index
}

// pageLoadingQueries returns the page's @loading query names (its own or inherited layout
// queries), in the order the page consumes them. GenerateFallbacks uses the list to build
// the page's loading frame and generatePageEntry uses it to decide whether the entry has a
// frame to render — the two must agree, which is why they share this.
func pageLoadingQueries(index map[string]bool, page PageManifest) []string {
	var loadingQueries []string
	for _, name := range page.Queries {
		if index[name] {
			loadingQueries = append(loadingQueries, name)
		}
	}
	return loadingQueries
}

// GenerateFallbacks generates Suspense fallback components for routes with @loading queries.
func (p *HoudiniReact) GenerateFallbacks(ctx context.Context) ([]string, error) {
	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return nil, err
	}
	manifest, err := p.LoadManifest(ctx)
	if err != nil {
		return nil, err
	}

	pluginDir := projectConfig.PluginDirectory(p.Name())
	var changed []string

	loadingByName := loadingQueryIndex(manifest)

	// Page fallbacks — one per page that consumes any @loading query, its own or an
	// inherited layout query. The fallback renders the page with every query it
	// receives, so it must include inherited layout @loading queries too (matching the
	// resolved page unit and PageProps); otherwise those props are undefined during the
	// loading frame and the page crashes.
	for id, page := range manifest.Pages {
		loadingQueries := pageLoadingQueries(loadingByName, page)
		if len(loadingQueries) == 0 {
			continue
		}
		compAbs := stripViewExt(filepath.Join(projectConfig.ProjectRoot, page.Path))
		compRel := toSlash(mustRel(fallbacksDir(pluginDir, "page"), compAbs))
		content := generateFallbackFile(compRel, loadingQueries)
		path := filepath.Join(fallbacksDir(pluginDir, "page"), id+".jsx")
		if ok, err := writeIfChanged(p.Filesystem(), path, content); err != nil {
			return nil, err
		} else if ok {
			changed = append(changed, path)
		}
	}

	// Layout fallbacks — one per layout that has a @loading layout query
	for id, layout := range manifest.Layouts {
		lq, ok := manifest.LayoutQueries[id]
		if !ok || !lq.Loading {
			continue
		}
		compAbs := stripViewExt(filepath.Join(projectConfig.ProjectRoot, layout.Path))
		compRel := toSlash(mustRel(fallbacksDir(pluginDir, "layout"), compAbs))
		content := generateFallbackFile(compRel, []string{lq.Name})
		path := filepath.Join(fallbacksDir(pluginDir, "layout"), id+".jsx")
		if ok, err := writeIfChanged(p.Filesystem(), path, content); err != nil {
			return nil, err
		} else if ok {
			changed = append(changed, path)
		}
	}

	return changed, nil
}

// ---- page entry generation ----

// GeneratePageEntries generates per-page entry JSX components that compose the
// full layout/fallback tree around each page.
func (p *HoudiniReact) GeneratePageEntries(ctx context.Context) ([]string, error) {
	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return nil, err
	}
	manifest, err := p.LoadManifest(ctx)
	if err != nil {
		return nil, err
	}

	pluginDir := projectConfig.PluginDirectory(p.Name())
	var changed []string

	cfs, err := p.loadComponentFields(ctx)
	if err != nil {
		return nil, err
	}

	for id, page := range manifest.Pages {
		content := generatePageEntry(id, page, manifest, pluginDir, cfs)
		path := filepath.Join(entriesDir(pluginDir), id+".jsx")
		if ok, err := writeIfChanged(p.Filesystem(), path, content); err != nil {
			return nil, err
		} else if ok {
			changed = append(changed, path)
		}
	}

	return changed, nil
}

func generatePageEntry(id string, page PageManifest, manifest ProjectManifest, pluginDir string, cfs []componentField) string {
	var imports []string

	// whether the page has a loading frame (any @loading query, its own or an inherited
	// layout query) — shared with GenerateFallbacks, which generates the fallback unit
	// under the same condition
	hasFrame := len(pageLoadingQueries(loadingQueryIndex(manifest), page)) > 0

	// Import each layout unit
	for _, layoutID := range page.Layouts {
		imports = append(imports, fmt.Sprintf("import Layout_%s from '../layouts/%s.jsx'", layoutID, layoutID))
	}

	// Import error wrapper if the page has a +error companion
	if page.ErrorPath != "" {
		imports = append(imports, fmt.Sprintf("import Error_%s from '../errors/%s.jsx'", id, id))
	}

	// Import page unit and client
	imports = append(imports, fmt.Sprintf("import Page_%s from '../pages/%s.jsx'", id, id))
	imports = append(imports, "import client from '$houdini/plugins/houdini-react/runtime/client'")
	if len(page.Layouts) > 0 {
		imports = append(imports, "import { NotFoundGate, setCurrentSegment } from '$houdini/plugins/houdini-react/runtime/routing'")
	} else {
		imports = append(imports, "import { NotFoundGate } from '$houdini/plugins/houdini-react/runtime/routing'")
	}

	// Import the page fallback (boundary + loading frame) if the page has one
	if hasFrame {
		imports = append(imports, fmt.Sprintf("import PageFallback_%s, { Frame as Frame_%s } from '../fallbacks/page/%s.jsx'", id, id, id))
	}

	// Import layout fallbacks for layouts with loading queries
	for _, layoutID := range page.Layouts {
		if lq, ok := manifest.LayoutQueries[layoutID]; ok && lq.Loading {
			imports = append(imports, fmt.Sprintf("import LayoutFallback_%s from '../fallbacks/layout/%s.jsx'", layoutID, layoutID))
		}
	}

	// Side-effect imports for component field wrappers so Vite bundles them.
	for _, cf := range cfs {
		imports = append(imports, fmt.Sprintf("import '../componentFields/wrapper_%s'", cf.fragment))
	}

	// Build the ordered list of wrapper component names, outermost first.
	// Process layouts outermost→innermost; inside each layout add fallback then SegmentSetter then layout.
	var wrappers []string
	var segmentSetters []string
	for _, layoutID := range page.Layouts {
		if lq, ok := manifest.LayoutQueries[layoutID]; ok && lq.Loading {
			wrappers = append(wrappers, "LayoutFallback_"+layoutID)
		}
		wrappers = append(wrappers, "SegmentSetter_"+layoutID)
		wrappers = append(wrappers, "Layout_"+layoutID)
		segmentSetters = append(segmentSetters,
			fmt.Sprintf("const SegmentSetter_%s = ({ children }) => { setCurrentSegment('%s'); return children }", layoutID, layoutID))
	}
	// Error boundary wraps page (inside layouts, outside page fallback)
	if page.ErrorPath != "" {
		wrappers = append(wrappers, "Error_"+id)
	}

	// NotFoundGate sits inside the error boundary (if present) so that when the
	// Router renders this entry for a 404 URL, the throw is caught at the right
	// level and the layouts above it render normally.
	wrappers = append(wrappers, "NotFoundGate")

	if hasFrame {
		wrappers = append(wrappers, "PageFallback_"+id)
	}

	// The page slot: while the router wants to show the loading state (a navigation
	// pending longer than loadingDelay), render the loading frame directly instead of
	// the page — plain conditional rendering, nothing suspends. Pages without a frame
	// ignore showLoading entirely: the transition just keeps the previous page on
	// screen until this one is ready.
	leaf := fmt.Sprintf("<Page_%s />", id)
	if hasFrame {
		leaf = fmt.Sprintf("{showLoading ? <Frame_%s /> : <Page_%s />}", id, id)
	}

	// Render the nested JSX with correct per-depth indentation (base = 2 tabs).
	nestedContent := renderWrappedJSX(wrappers, leaf, 2)

	var b strings.Builder
	b.WriteString(strings.Join(imports, "\n"))
	if len(segmentSetters) > 0 {
		b.WriteString("\n\n")
		b.WriteString(strings.Join(segmentSetters, "\n"))
	}
	b.WriteString("\n\nexport default ({ showLoading }) => {\n")
	b.WriteString("\treturn (\n")
	b.WriteString(nestedContent)
	b.WriteString("\n\t)\n}\n")

	return b.String()
}

// renderWrappedJSX renders a sequence of JSX wrappers (outermost first) around a leaf
// expression (rendered verbatim), incrementing indentation by one tab per nesting level.
func renderWrappedJSX(wrappers []string, leaf string, baseDepth int) string {
	var lines []string

	for i, w := range wrappers {
		lines = append(lines, strings.Repeat("\t", baseDepth+i)+fmt.Sprintf("<%s>", w))
	}
	lines = append(lines, strings.Repeat("\t", baseDepth+len(wrappers))+leaf)
	for i := len(wrappers) - 1; i >= 0; i-- {
		lines = append(lines, strings.Repeat("\t", baseDepth+i)+fmt.Sprintf("</%s>", wrappers[i]))
	}

	return strings.Join(lines, "\n")
}

// ---- render infrastructure ----

// GenerateRenderInfrastructure generates three one-time SSR files:
// App.jsx, server.js, and config.js (which varies by local schema/yoga).
func (p *HoudiniReact) GenerateRenderInfrastructure(ctx context.Context) ([]string, error) {
	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return nil, err
	}
	manifest, err := p.LoadManifest(ctx)
	if err != nil {
		return nil, err
	}

	cfs, err := p.loadComponentFields(ctx)
	if err != nil {
		return nil, err
	}

	// Read the API endpoint from router_config, defaulting to "/_api"
	apiEndpoint := "/_api"
	_ = p.DB.StepQuery(ctx, `SELECT api_endpoint FROM router_config LIMIT 1`, nil, func(q plugins.Row) {
		if v := q.ColumnText(0); v != "" {
			apiEndpoint = v
		}
	})

	pluginDir := projectConfig.PluginDirectory(p.Name())
	rDir := renderDir(pluginDir)
	// 5 levels up from units/render/ reaches projectRoot
	rootRel := toSlash(mustRel(rDir, projectConfig.ProjectRoot))

	var changed []string

	// App.jsx — always the same
	appContent := fmt.Sprintf(`import { Router } from '$houdini/plugins/houdini-react/runtime'
import React from 'react'

import Shell from '%s/src/+index'

export default ({ cssLinks, ...props }) => (
	<>
		{(cssLinks || []).map(href => <link key={href} rel="stylesheet" href={href} precedence="default" />)}
		<Shell>
			<Router {...props} />
		</Shell>
	</>
)
`, rootRel)

	appPath := filepath.Join(rDir, "App.jsx")
	if ok, err := writeIfChanged(p.Filesystem(), appPath, appContent); err != nil {
		return nil, err
	} else if ok {
		changed = append(changed, appPath)
	}

	// server.js — mostly static
	serverContent := fmt.Sprintf(`import { Cache } from 'houdini/runtime/cache'
import { serverAdapterFactory, _serverHandler } from 'houdini/router/server'
import { HoudiniClient } from 'houdini/runtime/client'
import { renderToStream } from 'houdini-react/server'
import React from 'react'

import { router_cache, StatusContext } from '../../runtime/routing'
import { escapeScriptTag } from '../../runtime/escape'
// @ts-expect-error
import client from '%s/src/+client'
// @ts-expect-error
import App from "./App"
import router_manifest from '$houdini/plugins/houdini-react/runtime/manifest'

import config from '%s/houdini.config.js'

// route_headers maps a page id to its ordered headers() loaders. It is a
// server-only export so headers() stays out of the client bundle; attach it to
// the manifest here so the request handler can evaluate it before streaming.
import * as manifest_module from '$houdini/plugins/houdini-react/runtime/manifest'
for (const id of Object.keys(manifest_module.route_headers ?? {})) {
	if (router_manifest.pages[id]) {
		router_manifest.pages[id].headers = manifest_module.route_headers[id]
	}
}
// form_actions is server-only too: attach the @endpoint mutation loaders so the no-JS
// form handler can resolve a submitted form's mutation artifact.
if (manifest_module.form_actions) {
	router_manifest.formActions = manifest_module.form_actions
}
// session_mutations (name → sessionPath) is server-only too: the session-mint plugin and the
// no-JS form handler use it to find the result field that becomes the session.
if (manifest_module.session_mutations) {
	router_manifest.sessionMutations = manifest_module.session_mutations
}

export const on_render =
	({ assetPrefix, pipe, production, documentPremable, cssLinks }) =>
	async ({
		url,
		match,
		is404,
		session,
		manifest,
		componentCache,
		headers,
		formResult,
		formToken,
		authUrl,
	}) => {
		const cache = new Cache({
			disabled: false,
			...config,
			componentCache,
			createComponent: React.createElement
		})

		// Wire the per-request cache into the client so that all observe() calls
		// during this render write to (and read from) the same cache we serialize.
		client.setCache(cache)

		// Mutable ref threaded through StatusContext. It carries the response status and,
		// when the first render pass throws, the failure the error boundary renders on the
		// second pass (see the retry around renderToStream below).
		const statusRef = { status: is404 ? 404 : 200, errors: undefined }

		// renderToStream only hands back injectToStream as a return value, i.e. after <App> has
		// already been constructed — too late to pass it down as a prop for the first render.
		// We thread a stable wrapper that delegates to this holder, then fill the holder once
		// renderToStream resolves. @loading queries resolve after the shell flushes (so the
		// holder is set by the time their resolution scripts stream); non-@loading queries
		// resolve before the shell and simply no-op the wrapper, falling back to the initial
		// cache as before. Sourcing it this way (rather than react-streaming's useStream context)
		// keeps the bare react-streaming import out of the isomorphic runtime, which trips a
		// "loaded in browser" poison-pill assertion under browser-like test environments.
		const streamHolder = {}
		// One set of router caches for the whole request, shared by both render passes.
		// When the first pass rejects and we retry, every query that settled during it —
		// including the one whose errors caused the rejection — already has its observer
		// in data_cache, so the retry renders from those instead of re-fetching (the
		// results would be unused anyway: the error boundary starts errored). Sends still
		// in flight from the first pass are deduped through ssr_signals the same way.
		const caches = router_cache()
		const render = () => renderToStream(
			React.createElement(StatusContext.Provider, { value: statusRef },
				React.createElement(App, {
					initialURL: url,
					cache: cache,
					session: session,
					formResult: formResult ?? null,
					formToken: formToken ?? null,
					assetPrefix: assetPrefix,
					manifest: manifest,
					cssLinks: cssLinks || [],
					// best-effort: a dangling query from an earlier render pass can resolve
					// after the stream has ended, and react-streaming throws on late
					// injections (inside a floating promise, which would take the whole
					// process down). The client refetches anything a dropped chunk carried.
					injectToStream: (chunk) => {
						try {
							streamHolder.injectToStream?.(chunk)
						} catch (_) {}
					},
					...caches
				})
			),
			{ webStream: production, userAgent: 'Vite' }
		)

		// respond without a rendered body — the redirect and render-failure paths
		const respondEmpty = (status, location) => {
			if (pipe && typeof pipe.setHeader === 'function') {
				for (const [key, value] of Object.entries(headers ?? {})) {
					pipe.setHeader(key, value)
				}
				if (location) {
					pipe.setHeader('Location', location)
				}
				pipe.statusCode = status
				pipe.end()
				return true
			}
			return new Response(null, {
				status,
				headers: location ? { ...headers, Location: location } : headers,
			})
		}

		let stream
		try {
			stream = await render()
		} catch (error) {
			// Error boundaries don't run during SSR, so a component that throws on the
			// first pass — notFound(), redirect(), or a query resolving with GraphQL
			// errors — rejects the stream instead of rendering +error.tsx. A redirect
			// needs no body: answer with the Location directly. Anything else is recorded
			// on statusRef and rendered once more: HoudiniErrorBoundary starts in its
			// error state when the context carries an error status, so the second pass
			// streams the error view with the right status instead of a raw stack trace.
			// Name checks instead of instanceof so a duplicated runtime module (e.g. two
			// import specifiers resolving separately in dev) can't break the detection.
			if (error?.name === 'RedirectError' && error.location) {
				return respondEmpty(error.status, error.location)
			}
			if (error?.name === 'RoutingError') {
				statusRef.status = error.status
			} else {
				statusRef.status = 500
				// the thrown errors are handed to +error.tsx as-is, in production too:
				// deciding what an error view exposes is the app's call, not the router's
				statusRef.errors = error?.name === 'GraphQLErrors' ? error.graphqlErrors : [error]
			}
			// if the second pass throws too (the throw came from a layout, which renders
			// above the error boundary, or the route has no +error.tsx at all) the
			// rejection propagates as if there were no retry: the adapter answers with
			// the error's status and message, exactly like before
			stream = await render()
		}
		const { readable, injectToStream, pipe: pipeTo } = stream
		streamHolder.injectToStream = injectToStream

		// The page bootstrap below is intentionally not async. On a streaming page (e.g. an
		// @loading query renders its loading state inside a Suspense boundary, so the shell
		// flushes immediately and the document stays open), an async module runs the moment
		// it loads — before the deferred react-refresh preamble, which waits for the still-open
		// document to finish parsing. That makes every JSX import throw "can't detect preamble".
		// A plain (deferred) module runs in document order, after the preamble.
		injectToStream(`+"`"+`
		<script>
			window.__houdini__initial__cache__ = ${escapeScriptTag(cache.serialize())};
			window.__houdini__initial__session__ = ${escapeScriptTag(JSON.stringify(session))};
			window.__houdini__form_result__ = ${escapeScriptTag(JSON.stringify(formResult ?? null))};
			window.__houdini__form_token__ = ${escapeScriptTag(JSON.stringify(formToken ?? null))};
			window.__houdini__auth_url__ = ${escapeScriptTag(JSON.stringify(authUrl ?? null))};
		</script>

		${documentPremable ?? ''}

		${match ? '<script type="module" src="' + assetPrefix + '/pages/' + match.id + '.' + (production ? 'js' : 'jsx') + '"></script>' : ''}
	`+"`"+`)

		if (pipeTo && pipe) {
			// route headers must be set on the underlying response before any of
			// the stream is written
			if (headers && typeof pipe.setHeader === 'function') {
				for (const [key, value] of Object.entries(headers)) {
					pipe.setHeader(key, value)
				}
			}
			// the second render pass can carry an error status (404/500)
			pipe.statusCode = statusRef.status
			pipeTo(pipe)
			return true
		} else {
			return new Response(readable, { status: statusRef.status, headers })
		}
	}

export function createServerAdapter(options) {
	return serverAdapterFactory({
		client,
		production: true,
		manifest: router_manifest,
		on_render: on_render(options),
		config_file: config,
		...options,
	})
}
`, rootRel, rootRel)

	serverPath := filepath.Join(rDir, "server.js")
	if ok, err := writeIfChanged(p.Filesystem(), serverPath, serverContent); err != nil {
		return nil, err
	} else if ok {
		changed = append(changed, serverPath)
	}

	// config.js — varies by local_schema, local_yoga, and component fields
	schemaLine := "const schema = null"
	if manifest.LocalSchema {
		schemaLine = fmt.Sprintf("import schema from '%s/src/server/+schema'", rootRel)
	}
	yogaLine := "const yoga = null"
	if manifest.LocalYoga {
		yogaLine = fmt.Sprintf("import yoga from '%s/src/server/+yoga'", rootRel)
	}

	// Component field wrapper imports (relative from render/ to componentFields/)
	var cfImports []string
	var cfCacheEntries []string
	for _, cf := range cfs {
		cfImports = append(cfImports, fmt.Sprintf("import %s from '../componentFields/wrapper_%s.jsx'", cf.fragment, cf.fragment))
		cfCacheEntries = append(cfCacheEntries, fmt.Sprintf("\t%q: %s,", cf.typeName+"."+cf.field, cf.fragment))
	}
	cfImportBlock := ""
	if len(cfImports) > 0 {
		cfImportBlock = strings.Join(cfImports, "\n") + "\n\n"
	}
	cacheBody := ""
	if len(cfCacheEntries) > 0 {
		cacheBody = "\n" + strings.Join(cfCacheEntries, "\n") + "\n"
	}

	// server-only config: src/server/+config (HoudiniServerConfig) holds secrets — sessionKeys, and
	// later oauth — that must never reach houdini.config, which the client bundles for scalars. It
	// is passed to the adapter SEPARATELY from config_file (never merged), so the public and
	// server configs stay distinct, mirroring how the build loads them.
	serverConfigImport := "const server_config = {}"
	if manifest.LocalConfig {
		serverConfigImport = fmt.Sprintf("import server_config from '%s/src/server/+config'", rootRel)
	}

	configContent := fmt.Sprintf(`import { createServerAdapter as createAdapter } from './server'
import config_file from '%s/houdini.config'
%s

%s%s
%s

export const endpoint = "%s"

export const componentCache = {%s}

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
`, rootRel, serverConfigImport, cfImportBlock, schemaLine, yogaLine, apiEndpoint, cacheBody)

	configPath := filepath.Join(rDir, "config.js")
	if ok, err := writeIfChanged(p.Filesystem(), configPath, configContent); err != nil {
		return nil, err
	} else if ok {
		changed = append(changed, configPath)
	}

	return changed, nil
}

// ---- type roots ----

// GenerateTypeRoots generates a $types.d.ts file per route directory into the
// .houdini/types/ tree. TypeScript's rootDirs setting (configured in GenerateTsConfig)
// merges .houdini/types/ with the project root, so imports like `./$types` in route
// files resolve to the generated declarations without polluting src/.
func (p *HoudiniReact) GenerateTypeRoots(ctx context.Context) ([]string, error) {
	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return nil, err
	}
	manifest, err := p.LoadManifest(ctx)
	if err != nil {
		return nil, err
	}

	runtimeDir := projectConfig.PluginRuntimeDirectory(p.Name())
	artifactDir := filepath.Join(projectConfig.ProjectRoot, projectConfig.RuntimeDir, "artifacts")
	routesDir := filepath.Join(projectConfig.ProjectRoot, "src", "routes")

	// Type root: .houdini/types/  (mirrors the project root via tsconfig rootDirs)
	typeRootDir := filepath.Join(projectConfig.ProjectRoot, projectConfig.RuntimeDir, "types")

	// Group pages and layouts by their route directory.
	type routeEntry struct {
		page   *PageManifest
		layout *PageManifest
	}
	byDir := map[string]*routeEntry{}

	for i := range manifest.Pages {
		pg := manifest.Pages[i]
		dir := filepath.Dir(filepath.Join(projectConfig.ProjectRoot, pg.Path))
		rel := toSlash(mustRel(routesDir, dir))
		if byDir[rel] == nil {
			byDir[rel] = &routeEntry{}
		}
		cp := pg
		byDir[rel].page = &cp
	}
	for i := range manifest.Layouts {
		l := manifest.Layouts[i]
		dir := filepath.Dir(filepath.Join(projectConfig.ProjectRoot, l.Path))
		rel := toSlash(mustRel(routesDir, dir))
		if byDir[rel] == nil {
			byDir[rel] = &routeEntry{}
		}
		cp := l
		byDir[rel].layout = &cp
	}

	var changed []string
	for routeRel, entry := range byDir {
		// Write to .houdini/types/src/routes/{rel}/$types.d.ts so TypeScript's
		// rootDirs merge makes it visible alongside the actual source file.
		targetDir := filepath.Join(typeRootDir, "src", "routes", filepath.FromSlash(routeRel))
		targetFile := filepath.Join(targetDir, "$types.d.ts")

		runtimeRel := toSlash(mustRel(targetDir, runtimeDir))
		artifactRelDir := toSlash(mustRel(targetDir, artifactDir))

		var pageQueries, layoutQueries, errorQueries []string
		var params map[string]*ParamTypeInfo
		if entry.page != nil {
			pageQueries = entry.page.QueryOptions
			errorQueries = entry.page.LayoutQueries
			params = entry.page.Params
		}
		if entry.layout != nil {
			layoutQueries = entry.layout.QueryOptions
			if params == nil {
				params = entry.layout.Params
			}
		}
		if errorQueries == nil {
			errorQueries = []string{}
		}

		allQueries := uniqueStrings(append(pageQueries, layoutQueries...))

		content := generateTypeRoot(runtimeRel, artifactRelDir, allQueries, pageQueries, layoutQueries, errorQueries, params)
		if ok, err := writeIfChanged(p.Filesystem(), targetFile, content); err != nil {
			return nil, err
		} else if ok {
			changed = append(changed, targetFile)
		}
	}

	return changed, nil
}

func generateTypeRoot(runtimeRel, artifactRelDir string, allQueries, pageQueries, layoutQueries, errorQueries []string, params map[string]*ParamTypeInfo) string {
	var b strings.Builder

	b.WriteString(fmt.Sprintf("import { DocumentHandle } from '%s'\n", runtimeRel))
	b.WriteString("import React from 'react'\n")
	for _, q := range allQueries {
		b.WriteString(fmt.Sprintf("import type { %s$result, %s$artifact, %s$input } from '%s/%s'\n",
			q, q, q, artifactRelDir, q))
	}
	b.WriteString("import type { GraphQLError } from 'houdini/runtime'\n")
	b.WriteString(fmt.Sprintf("import type { RoutingError } from '%s'\n", runtimeRel))

	paramsType := formatParamsType(params)
	routeKeys := formatRouteKeyUnion(params)

	// PageProps — only the page's query results + handles. Route params and search live
	// on PageRoute (read via useRoute), so they can't be accidentally destructured here.
	b.WriteString("\nexport type PageProps = {\n")
	for _, q := range pageQueries {
		b.WriteString(fmt.Sprintf("\t%s: %s$result,\n", q, q))
		b.WriteString(fmt.Sprintf("\t%s$handle: DocumentHandle<%s$artifact, %s$result, %s$input>,\n", q, q, q, q))
	}
	b.WriteString("}\n")

	// LayoutProps
	b.WriteString("\nexport type LayoutProps = {\n\tchildren: React.ReactNode,\n")
	for _, q := range layoutQueries {
		b.WriteString(fmt.Sprintf("\t%s: %s$result,\n", q, q))
		b.WriteString(fmt.Sprintf("\t%s$handle: DocumentHandle<%s$artifact, %s$result, %s$input>,\n", q, q, q, q))
	}
	b.WriteString("}\n")

	// ErrorProps
	b.WriteString("\nexport type ErrorProps = {\n\terrors: Array<Error | GraphQLError | RoutingError>,\n\tchildren: React.ReactNode,\n")
	for _, q := range errorQueries {
		b.WriteString(fmt.Sprintf("\t%s: %s$result,\n", q, q))
		b.WriteString(fmt.Sprintf("\t%s$handle: DocumentHandle<%s$artifact, %s$result, %s$input>,\n", q, q, q, q))
	}
	b.WriteString("}\n")

	// PageRoute / LayoutRoute / ErrorRoute — the route's params (from path segments) and
	// search (the component's nullable, non-route query variables). Consumed via
	// useRoute<PageRoute>(). Both are derived from the query inputs so they carry the exact
	// scalar types (including unmarshaled custom scalars like Date).
	//
	// A query with no variables has `$input = null | undefined` (that shape makes the
	// variables argument optional elsewhere), and intersecting null with another query's
	// input collapses the whole combination to never — so coalesce each input to {} first.
	if len(allQueries) > 0 || len(errorQueries) > 0 {
		b.WriteString("\ntype _Input<T> = T extends null | undefined ? {} : T\n")
	}
	b.WriteString(formatRouteType("PageRoute", pageQueries, routeKeys, paramsType))
	b.WriteString(formatRouteType("LayoutRoute", layoutQueries, routeKeys, paramsType))
	b.WriteString(formatRouteType("ErrorRoute", errorQueries, routeKeys, paramsType))

	return b.String()
}

func formatParamsType(params map[string]*ParamTypeInfo) string {
	if len(params) == 0 {
		return "{}"
	}
	keys := sortedKeys(params)
	var parts []string
	for _, k := range keys {
		parts = append(parts, fmt.Sprintf("%s: string", k))
	}
	return "{ " + strings.Join(parts, ", ") + " }"
}

// formatRouteKeyUnion returns the route's param names as a string-literal union (e.g.
// "'id' | 'postId'"), or "never" when the route has no dynamic segments. Used to split a
// query's input into its path-param and search halves.
func formatRouteKeyUnion(params map[string]*ParamTypeInfo) string {
	if len(params) == 0 {
		return "never"
	}
	keys := sortedKeys(params)
	var quoted []string
	for _, k := range keys {
		quoted = append(quoted, fmt.Sprintf("'%s'", k))
	}
	return strings.Join(quoted, " | ")
}

// formatRouteType emits a PageRoute/LayoutRoute/ErrorRoute type: params are the route-key
// subset of the component's query inputs (plus any route key no query declares, typed as
// string from the path segment) and search is everything else (the nullable, non-route
// variables). With no queries there's no input to derive from, so params falls back to
// the path-segment names typed as string and search is empty.
func formatRouteType(name string, queries []string, routeKeys, paramsType string) string {
	var params, search string
	if len(queries) == 0 {
		params = paramsType
		search = "{}"
	} else {
		inputs := make([]string, 0, len(queries))
		for _, q := range queries {
			inputs = append(inputs, fmt.Sprintf("_Input<%s$input>", q))
		}
		combined := strings.Join(inputs, " & ")
		if len(inputs) > 1 {
			combined = "(" + combined + ")"
		}
		params = fmt.Sprintf("Pick<%s, Extract<keyof %s, %s>>", combined, combined, routeKeys)
		if paramsType != "{}" {
			params += fmt.Sprintf(" & Omit<%s, keyof %s>", paramsType, combined)
		}
		search = fmt.Sprintf("Omit<%s, %s>", combined, routeKeys)
	}
	return fmt.Sprintf("\nexport type %s = {\n\tparams: %s,\n\tsearch: %s,\n}\n", name, params, search)
}

// ---- component field helpers ----

type componentField struct {
	fragment string
	typeName string
	field    string
	prop     string
	filepath string // raw_documents.filepath — component or adjacent GQL file
	content  string // raw GQL content, used for GraphQL<_Document> type
}

// loadComponentFields returns all component field records joined with their raw document.
func (p *HoudiniReact) loadComponentFields(ctx context.Context) ([]componentField, error) {
	var fields []componentField
	err := p.DB.StepQuery(ctx, `
		SELECT cf.fragment, cf.type, cf.field, cf.prop, rd.filepath, rd.content
		FROM component_fields cf
		JOIN raw_documents rd ON rd.id = cf.document
		WHERE cf.fragment IS NOT NULL
		ORDER BY cf.fragment ASC
	`, nil, func(q plugins.Row) {
		fields = append(fields, componentField{
			fragment: q.ColumnText(0),
			typeName: q.ColumnText(1),
			field:    q.ColumnText(2),
			prop:     q.ColumnText(3),
			filepath: q.ColumnText(4),
			content:  q.ColumnText(5),
		})
	})
	return fields, err
}

// ---- component field wrappers ----

// GenerateComponentFieldWrappers generates a JSX wrapper per component field that calls
// useFragment and passes the result to the actual component, then registers it with
// the client's component cache for SSR.
func (p *HoudiniReact) GenerateComponentFieldWrappers(ctx context.Context) ([]string, error) {
	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return nil, err
	}

	cfDir := filepath.Join(projectConfig.PluginDirectory(p.Name()), "units", "componentFields")

	rows, err := p.loadComponentFields(ctx)
	if err != nil {
		return nil, err
	}

	var changed []string
	for _, row := range rows {
		wrapperPath := filepath.Join(cfDir, "wrapper_"+row.fragment+".jsx")

		// Relative import from the wrapper to the component file (no extension).
		compAbs := stripViewExt(filepath.Join(projectConfig.ProjectRoot, row.filepath))
		compRel := toSlash(mustRel(cfDir, compAbs))

		componentName := row.typeName + row.field
		content := generateComponentFieldWrapper(componentName, row.fragment, row.prop, compRel, row.typeName, row.field)
		_ = row.content // content used elsewhere (GraphQL type)

		if ok, err := writeIfChanged(p.Filesystem(), wrapperPath, content); err != nil {
			return nil, err
		} else if ok {
			changed = append(changed, wrapperPath)
		}
	}

	return changed, nil
}

func generateComponentFieldWrapper(componentName, fragment, prop, compRel, typeName, field string) string {
	var b strings.Builder

	b.WriteString("import { useFragment } from '$houdini'\n")
	b.WriteString("import client from '$houdini/plugins/houdini-react/runtime/client'\n")
	b.WriteString(fmt.Sprintf("import Component from '%s'\n\n", compRel))
	b.WriteString(fmt.Sprintf("import artifact from '$houdini/artifacts/%s'\n\n", fragment))

	b.WriteString(fmt.Sprintf("const %s = ({ %s, ...props }) => {\n", componentName, prop))
	b.WriteString(fmt.Sprintf("\tconst value = useFragment(%s, { artifact })\n", prop))
	b.WriteString(fmt.Sprintf("\treturn <Component %s={value} {...props} />\n", prop))
	b.WriteString("}\n\n")

	b.WriteString("if (globalThis.window) {\n")
	b.WriteString("\tlet window = globalThis.window\n\n")
	b.WriteString("\tif (!window.__houdini__client__) {\n")
	b.WriteString("\t\twindow.__houdini__client__ = client()\n")
	b.WriteString("\t}\n\n")
	b.WriteString(fmt.Sprintf("\twindow.__houdini__client__.componentCache[%q] = %s\n", typeName+"."+field, componentName))
	b.WriteString("}\n\n")

	b.WriteString(fmt.Sprintf("export default %s\n", componentName))

	return b.String()
}

func uniqueStrings(ss []string) []string {
	seen := map[string]bool{}
	var out []string
	for _, s := range ss {
		if !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	return out
}

// sortedStringKeys returns sorted keys of a string-valued map.
func sortedStringKeys(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
