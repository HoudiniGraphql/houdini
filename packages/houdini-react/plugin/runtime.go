package plugin

import (
	"context"
	"fmt"
	"path/filepath"
	"sort"
	"strings"

	"github.com/spf13/afero"

	plugins "code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/graphql"
)

// TransformRuntime patches static runtime files as they are copied into the plugin directory.
func (p *HoudiniReact) TransformRuntime(ctx context.Context, fp string, content string) (string, error) {
	// Inject `// @refresh reset` into every JSX/TSX runtime file. These are
	// framework internals the user never edits directly, so they should opt
	// out of react-refresh's preamble injection (which causes "can't detect
	// preamble" errors with @vitejs/plugin-react-oxc) and instead trigger a
	// full page reset on change. This replaces the old fastRefresh: false
	// workaround that the legacy implementation required.
	ext := filepath.Ext(fp)
	if ext == ".tsx" || ext == ".jsx" {
		if !strings.HasPrefix(content, "// @refresh reset") {
			content = "// @refresh reset\n" + content
		}
	}

	switch fp {
	case "client.ts":
		projectConfig, err := p.DB.ProjectConfig(ctx)
		if err != nil {
			return "", err
		}

		runtimeDir := projectConfig.PluginRuntimeDirectory(p.Name())
		clientPath := filepath.Join(projectConfig.ProjectRoot, "src", "+client")
		relPath, err := filepath.Rel(runtimeDir, clientPath)
		if err != nil {
			return "", err
		}

		return fmt.Sprintf("import client from '%s'\nexport default () => client\n",
			filepath.ToSlash(relPath)), nil
	}

	return content, nil
}

// UpdateIndexFiles injects typed graphql() overloads into the core runtime index.ts.
// For each visible document it adds an import of the artifact type and an overload that
// maps the document's literal template string to { artifact: ${name}$artifact }.
func (p *HoudiniReact) UpdateIndexFiles(ctx context.Context) ([]string, error) {
	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return nil, err
	}

	targetPath := filepath.Join(
		projectConfig.ProjectRoot,
		projectConfig.RuntimeDir,
		"runtime",
		"index.ts",
	)

	// Query all visible documents with their raw content.
	var imports strings.Builder
	var overloads strings.Builder

	err = p.DB.StepQuery(ctx, `
		SELECT d.name, rd.content
		FROM documents d
		JOIN raw_documents rd ON d.raw_document = rd.id
		WHERE d.visible = 1
		ORDER BY d.name ASC
	`, nil, func(q plugins.Row) {
		name := q.ColumnText(0)
		content := q.ColumnText(1)
		imports.WriteString(fmt.Sprintf(
			"import type { %s$artifact } from '../artifacts/%s'\n",
			name, name,
		))
		overloads.WriteString(fmt.Sprintf(
			"export function graphql(str: `%s`): { artifact: %s$artifact };\n",
			content, name,
		))
	})
	if err != nil {
		return nil, err
	}

	// Nothing to inject if no documents are present.
	if imports.Len() == 0 {
		return []string{}, nil
	}

	existing, err := afero.ReadFile(p.Filesystem(), targetPath)
	if err != nil {
		// index.ts is written by the core plugin's runtime copy; skip if not present yet.
		return []string{}, nil
	}

	existingStr := string(existing)
	const marker = "export function graphql<_Payload, _Result = _Payload>(str: string): _Result"
	insertPos := strings.Index(existingStr, marker)
	if insertPos == -1 {
		return nil, fmt.Errorf("could not find generic graphql declaration in %s", targetPath)
	}

	// If the content before the marker already contains artifact imports the file
	// was patched in a previous call this run — skip to stay idempotent.
	if strings.Contains(existingStr[:insertPos], "$artifact }") {
		return []string{}, nil
	}

	var newContent strings.Builder
	newContent.WriteString("\n")
	newContent.WriteString(imports.String())
	newContent.WriteString("\n")
	newContent.WriteString(existingStr[:insertPos])
	newContent.WriteString(overloads.String())
	newContent.WriteString(existingStr[insertPos:])

	result := newContent.String()
	if result == existingStr {
		return []string{}, nil
	}

	if err := plugins.WriteFile(p.Filesystem(), targetPath, []byte(result), 0644); err != nil {
		return nil, err
	}
	return []string{targetPath}, nil
}

// GenerateRuntime runs after the runtime files have been copied. It loads the project
// manifest and writes manifest.ts into the plugin runtime directory.
func (p *HoudiniReact) GenerateRuntime(ctx context.Context) ([]string, error) {
	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return nil, err
	}

	manifest, err := p.LoadManifest(ctx)
	if err != nil {
		return nil, err
	}

	graphqlTypeFiles, err := p.AddGraphQLType(ctx)
	if err != nil {
		return nil, err
	}

	changed, err := p.UpdateIndexFiles(ctx)
	if err != nil {
		return nil, err
	}

	hookFiles, err := p.UpdateHookFiles(ctx)
	if err != nil {
		return nil, err
	}
	changed = append(changed, hookFiles...)
	changed = append(changed, graphqlTypeFiles...)

	cfTypes, err := p.GenerateComponentFieldTypes(ctx)
	if err != nil {
		return nil, err
	}
	changed = append(changed, cfTypes...)

	cfWrappers, err := p.GenerateComponentFieldWrappers(ctx)
	if err != nil {
		return nil, err
	}
	changed = append(changed, cfWrappers...)

	wrappers, err := p.GenerateDocumentWrappers(ctx)
	if err != nil {
		return nil, err
	}
	changed = append(changed, wrappers...)

	errorWrappers, err := p.GenerateErrorWrappers(ctx)
	if err != nil {
		return nil, err
	}
	changed = append(changed, errorWrappers...)

	fallbacks, err := p.GenerateFallbacks(ctx)
	if err != nil {
		return nil, err
	}
	changed = append(changed, fallbacks...)

	entries, err := p.GeneratePageEntries(ctx)
	if err != nil {
		return nil, err
	}
	changed = append(changed, entries...)

	renderFiles, err := p.GenerateRenderInfrastructure(ctx)
	if err != nil {
		return nil, err
	}
	changed = append(changed, renderFiles...)

	typeRoots, err := p.GenerateTypeRoots(ctx)
	if err != nil {
		return nil, err
	}
	changed = append(changed, typeRoots...)

	tsConfig, err := p.GenerateTsConfig(ctx)
	if err != nil {
		return nil, err
	}
	changed = append(changed, tsConfig...)

	runtimeDir := projectConfig.PluginRuntimeDirectory(p.Name())
	artifactDir := filepath.Join(projectConfig.ProjectRoot, projectConfig.RuntimeDir, "artifacts")

	content, err := formatManifest(manifest, runtimeDir, artifactDir, projectConfig.ProjectRoot, projectConfig.Scalars)
	if err != nil {
		return nil, err
	}

	manifestPath := filepath.Join(runtimeDir, "manifest.ts")

	existing, _ := afero.ReadFile(p.Filesystem(), manifestPath)
	if string(existing) != content {
		if err := p.Filesystem().MkdirAll(runtimeDir, 0755); err != nil {
			return nil, err
		}
		if err := plugins.WriteFile(p.Filesystem(), manifestPath, []byte(content), 0644); err != nil {
			return nil, err
		}
		changed = append(changed, manifestPath)
	}

	mockContent, err := formatMockFile(manifest)
	if err != nil {
		return nil, err
	}

	mockPath := filepath.Join(runtimeDir, "mock.ts")
	existingMock, _ := afero.ReadFile(p.Filesystem(), mockPath)
	if string(existingMock) != mockContent {
		if err := plugins.WriteFile(p.Filesystem(), mockPath, []byte(mockContent), 0644); err != nil {
			return nil, err
		}
		changed = append(changed, mockPath)
	}

	return changed, nil
}

// formatMockFile generates the typed createMock function for all routes.
//
// Uses a single generic function with precomputed route param types so TypeScript
// gives "Property 'params' is missing in type ... but required in type { params: { id: string } }"
// with concrete, human-readable types rather than the verbose _ParamObj<readonly [...]> form.
func formatMockFile(manifest ProjectManifest) (string, error) {
	var sb strings.Builder

	sb.WriteString("import React from 'react'\n")
	sb.WriteString("import { _createMock, buildMockPath } from './testing'\n")

	// Per-route param/search typing is shared with <Link> and goto (defined in routes.ts,
	// derived from the manifest) so createMock accepts exactly the params and search the
	// route declares, with no duplicate rules generated here.
	if len(manifest.Pages) > 0 {
		sb.WriteString("import type { RouteHrefs, ParamsForRoute, SearchForRoute } from './routes'\n")
	}

	// Collect unique query and mutation names across all pages.
	// Both import $unmasked (fully-resolved server payload, fragments inlined, no masks) and $input.
	allQueryNames := map[string]bool{}
	for _, page := range manifest.Pages {
		for _, q := range page.Queries {
			allQueryNames[q] = true
		}
	}
	hasMutations := len(manifest.Mutations) > 0 && len(manifest.Pages) > 0
	hasSubscriptions := len(manifest.Subscriptions) > 0 && len(manifest.Pages) > 0

	if len(allQueryNames) > 0 || hasMutations || hasSubscriptions {
		sb.WriteString("\n")
		for _, name := range sortedKeys(allQueryNames) {
			sb.WriteString(fmt.Sprintf(
				"import type { %s$unmasked, %s$input } from '$houdini/artifacts/%s'\n",
				name, name, name,
			))
		}
		if hasMutations {
			for _, m := range manifest.Mutations {
				if !allQueryNames[m] {
					sb.WriteString(fmt.Sprintf(
						"import type { %s$unmasked, %s$input } from '$houdini/artifacts/%s'\n",
						m, m, m,
					))
				}
			}
		}
		if hasSubscriptions {
			for _, s := range manifest.Subscriptions {
				if !allQueryNames[s] {
					sb.WriteString(fmt.Sprintf(
						"import type { %s$unmasked, %s$input } from '$houdini/artifacts/%s'\n",
						s, s, s,
					))
				}
			}
		}
	}

	sb.WriteString("\ntype _MockValue<R, V> = R | ((vars: V) => R)\n\n")

	if len(manifest.Pages) == 0 {
		// No routes yet — simple stub so the file is still importable.
		sb.WriteString("export function createMock({ url, params = {}, search, data }: { url: string; params?: Record<string, string>; search?: Record<string, unknown>; data: Record<string, any> }): React.ComponentType<{}> {\n")
		sb.WriteString("\treturn _createMock({ path: buildMockPath(url, params, search), data })\n")
		sb.WriteString("}\n")
		return sb.String(), nil
	}

	// Per-route mock data types. Required keys are the queries the route uses; mutations
	// and subscriptions are optional keys. Mutation handlers get vars typed as $input;
	// subscription handlers are AsyncIterables that yield $unmasked values.
	for _, id := range sortedKeys(manifest.Pages) {
		page := manifest.Pages[id]
		sb.WriteString(fmt.Sprintf("type _TestData_%s = {\n", id))
		for _, q := range page.Queries {
			sb.WriteString(fmt.Sprintf("\t%s: _MockValue<%s$unmasked, %s$input>\n", q, q, q))
		}
		for _, m := range manifest.Mutations {
			sb.WriteString(fmt.Sprintf("\t%s?: _MockValue<%s$unmasked, %s$input>\n", m, m, m))
		}
		for _, s := range manifest.Subscriptions {
			sb.WriteString(fmt.Sprintf("\t%s?: _MockValue<AsyncIterable<%s$unmasked>, %s$input>\n", s, s, s))
		}
		sb.WriteString("}\n\n")
	}

	// _RouteData maps each URL literal to its per-route mock-data type. This is the only
	// route→type map the mock owns; the param and search typing comes from the shared
	// ParamsForRoute / SearchForRoute imported above.
	sb.WriteString("type _RouteData = {\n")
	for _, id := range sortedKeys(manifest.Pages) {
		page := manifest.Pages[id]
		cleanURL := stripRouteGroups(page.URL)
		sb.WriteString(fmt.Sprintf("\t%q: _TestData_%s\n", cleanURL, id))
	}
	sb.WriteString("}\n")
	sb.WriteString("type _DataForRoute<H extends string> = H extends keyof _RouteData ? _RouteData[H] : never\n\n")

	sb.WriteString("export function createMock<H extends RouteHrefs>(args: { url: H; data: _DataForRoute<H> } & ParamsForRoute<H> & SearchForRoute<H>): React.ComponentType<{}> {\n")
	sb.WriteString("\treturn _createMock({ path: buildMockPath(args.url as string, (args as any).params ?? {}, (args as any).search), data: args.data as Record<string, any> })\n")
	sb.WriteString("}\n")

	return sb.String(), nil
}

// hookSpec describes how to inject per-document overloads into one hook file.
type hookSpec struct {
	file     string // filename within the hooks/ directory
	kind     string // "query", "mutation", "subscription", or "fragment"
	marker   string // text immediately before which overloads are inserted
	preamble string // extra import line to prepend (empty if not needed)
	// paginationQuery is the name of the pagination query document for paginated fragments, or "";
	// plural is true when the document is a @plural fragment.
	imports     func(name string, paginationQuery string, plural bool) string
	overloads   func(name string, paginationQuery string, plural bool) string
	passthrough string // generic overload inserted last, bridges concrete overloads to the implementation
}

// fragmentKey is the literal value of houdini's fragmentKey constant.
const fragmentKeyLiteral = " $fragments"

var hookSpecs = []hookSpec{
	{
		file:   "useQuery.ts",
		kind:   "query",
		marker: "export function useQuery<",
		imports: func(name string, _ string, _ bool) string {
			return fmt.Sprintf("import type { %s$result, %s$artifact, %s$input } from '$houdini/artifacts/%s'\n", name, name, name, name)
		},
		overloads: func(name string, _ string, _ bool) string {
			return fmt.Sprintf(
				"export function useQuery(document: { artifact: %s$artifact }, variables?: %s$input, config?: UseQueryConfig): %s$result\n",
				name, name, name,
			)
		},
		passthrough: "export function useQuery<_Artifact extends QueryArtifact, _Data extends GraphQLObject>(document: { artifact: _Artifact }, variables?: GraphQLVariables, config?: UseQueryConfig): _Data",
	},
	{
		file:   "useQueryHandle.ts",
		kind:   "query",
		marker: "export function useQueryHandle<",
		imports: func(name string, _ string, _ bool) string {
			return fmt.Sprintf("import type { %s$result, %s$artifact, %s$input } from '$houdini/artifacts/%s'\n", name, name, name, name)
		},
		overloads: func(name string, _ string, _ bool) string {
			return fmt.Sprintf(
				"export function useQueryHandle(document: { artifact: %s$artifact }, variables?: %s$input, config?: UseQueryConfig): DocumentHandle<%s$artifact, %s$result, GraphQLVariables>\n",
				name, name, name, name,
			)
		},
		passthrough: "export function useQueryHandle<_Artifact extends QueryArtifact, _Data extends GraphQLObject>(document: { artifact: _Artifact }, variables?: GraphQLVariables, config?: UseQueryConfig): DocumentHandle<_Artifact, _Data, GraphQLVariables>",
	},
	{
		file:   "useFragment.ts",
		kind:   "fragment",
		marker: "export function useFragment<",
		imports: func(name string, _ string, _ bool) string {
			return fmt.Sprintf("import type { %s$data, %s$artifact } from '$houdini/artifacts/%s'\n", name, name, name)
		},
		overloads: func(name string, _ string, plural bool) string {
			// @plural fragments are spread on a list field, so they take a list of
			// references and return a list of data
			if plural {
				return fmt.Sprintf(
					"export function useFragment(reference: ReadonlyArray<{ readonly %q: { %s: any } }>, document: { artifact: %s$artifact }): %s$data[]\n"+
						"export function useFragment(reference: ReadonlyArray<{ readonly %q: { %s: any } }> | null, document: { artifact: %s$artifact }): %s$data[] | null\n",
					fragmentKeyLiteral, name, name, name,
					fragmentKeyLiteral, name, name, name,
				)
			}
			return fmt.Sprintf(
				"export function useFragment(reference: { readonly %q: { %s: any } }, document: { artifact: %s$artifact }): %s$data\n"+
					"export function useFragment(reference: { readonly %q: { %s: any } } | null, document: { artifact: %s$artifact }): %s$data | null\n",
				fragmentKeyLiteral, name, name, name,
				fragmentKeyLiteral, name, name, name,
			)
		},
		passthrough: `export function useFragment<_Data extends GraphQLObject, _ReferenceType extends {}, _Input extends GraphQLVariables>(reference: _Data | { " $fragments": _ReferenceType } | null, document: { artifact: FragmentArtifact }): _Data | null`,
	},
	{
		file:   "useFragmentHandle.ts",
		kind:   "fragment",
		marker: "export function useFragmentHandle<",
		// For paginated fragments, import the pagination query artifact too.
		imports: func(name string, paginationQuery string, _ bool) string {
			base := fmt.Sprintf("import type { %s$data, %s$artifact, %s$input } from '$houdini/artifacts/%s'\n", name, name, name, name)
			if paginationQuery != "" {
				base += fmt.Sprintf("import type { %s$artifact } from '$houdini/artifacts/%s'\n", paginationQuery, paginationQuery)
			}
			return base
		},
		// For paginated fragments, return DocumentHandle typed with the pagination query artifact
		// so TypeScript exposes loadNext/loadPrevious/pageInfo on the returned handle.
		// For non-paginated fragments, fall back to DocumentHandle<QueryArtifact, ...>.
		overloads: func(name string, paginationQuery string, _ bool) string {
			if paginationQuery != "" {
				return fmt.Sprintf(
					"export function useFragmentHandle(reference: { readonly %q: { %s: any } }, document: { artifact: %s$artifact; refetchArtifact?: %s$artifact }): DocumentHandle<%s$artifact, %s$data, %s$input>\n"+
						"export function useFragmentHandle(reference: { readonly %q: { %s: any } } | null, document: { artifact: %s$artifact; refetchArtifact?: %s$artifact }): DocumentHandle<%s$artifact, %s$data, %s$input>\n",
					fragmentKeyLiteral, name, name, paginationQuery, paginationQuery, name, name,
					fragmentKeyLiteral, name, name, paginationQuery, paginationQuery, name, name,
				)
			}
			return fmt.Sprintf(
				"export function useFragmentHandle(reference: { readonly %q: { %s: any } }, document: { artifact: %s$artifact }): DocumentHandle<QueryArtifact, %s$data, GraphQLVariables>\n"+
					"export function useFragmentHandle(reference: { readonly %q: { %s: any } } | null, document: { artifact: %s$artifact }): DocumentHandle<QueryArtifact, %s$data, GraphQLVariables>\n",
				fragmentKeyLiteral, name, name, name,
				fragmentKeyLiteral, name, name, name,
			)
		},
		passthrough: `export function useFragmentHandle<_Artifact extends FragmentArtifact, _Data extends GraphQLObject, _ReferenceType extends {}, _PaginationArtifact extends QueryArtifact, _Input extends GraphQLVariables>(reference: _Data | { " $fragments": _ReferenceType } | null, document: { artifact: _Artifact; refetchArtifact?: _PaginationArtifact }): DocumentHandle<_PaginationArtifact, _Data, _Input>`,
	},
	{
		file:   "useMutation.ts",
		kind:   "mutation",
		marker: "export function useMutation<",
		imports: func(name string, _ string, _ bool) string {
			return fmt.Sprintf("import type { %s$result, %s$artifact, %s$input, %s$optimistic } from '$houdini/artifacts/%s'\n", name, name, name, name, name)
		},
		overloads: func(name string, _ string, _ bool) string {
			return fmt.Sprintf(
				"export function useMutation(document: { artifact: %s$artifact }): [MutationHandler<%s$result, %s$input, %s$optimistic>, boolean]\n",
				name, name, name, name,
			)
		},
		passthrough: "export function useMutation<_Result extends GraphQLObject, _Input extends GraphQLVariables, _Optimistic extends GraphQLObject>(document: { artifact: MutationArtifact }): [MutationHandler<_Result, _Input, _Optimistic>, boolean]",
	},
	{
		file:   "useMutationForm.tsx",
		kind:   "mutation",
		marker: "export function useMutationForm<",
		imports: func(name string, _ string, _ bool) string {
			return fmt.Sprintf("import type { %s$result, %s$artifact } from '$houdini/artifacts/%s'\n", name, name, name)
		},
		overloads: func(name string, _ string, _ bool) string {
			return fmt.Sprintf(
				"export function useMutationForm(document: { artifact: %s$artifact }, opts?: UseMutationFormOptions<%s$result>): MutationForm<%s$result>\n",
				name, name, name,
			)
		},
		passthrough: "export function useMutationForm<_Result extends GraphQLObject, _Input extends GraphQLVariables>(document: { artifact: MutationArtifact }, opts?: UseMutationFormOptions<_Result>): MutationForm<_Result>",
	},
	{
		file:   "useSubscription.ts",
		kind:   "subscription",
		marker: "export function useSubscription<",
		imports: func(name string, _ string, _ bool) string {
			return fmt.Sprintf("import type { %s$result, %s$artifact, %s$input } from '$houdini/artifacts/%s'\n", name, name, name, name)
		},
		overloads: func(name string, _ string, _ bool) string {
			return fmt.Sprintf(
				"export function useSubscription(document: { artifact: %s$artifact }, variables?: %s$input): %s$result\n",
				name, name, name,
			)
		},
		passthrough: "export function useSubscription<_Result extends GraphQLObject, _Input extends GraphQLVariables>(document: { artifact: SubscriptionArtifact }, variables?: _Input): _Result",
	},
	{
		file:   "useSubscriptionHandle.ts",
		kind:   "subscription",
		marker: "export function useSubscriptionHandle<",
		imports: func(name string, _ string, _ bool) string {
			return fmt.Sprintf("import type { %s$result, %s$artifact, %s$input } from '$houdini/artifacts/%s'\n", name, name, name, name)
		},
		overloads: func(name string, _ string, _ bool) string {
			return fmt.Sprintf(
				"export function useSubscriptionHandle(document: { artifact: %s$artifact }, variables?: %s$input): SubscriptionHandle<%s$result, %s$input>\n",
				name, name, name, name,
			)
		},
		passthrough: "export function useSubscriptionHandle<_Result extends GraphQLObject, _Input extends GraphQLVariables>(document: { artifact: SubscriptionArtifact }, variables?: _Input): SubscriptionHandle<_Result, _Input>",
	},
}

// AddGraphQLType appends the GraphQL<_Document> mapped type to the core runtime index.ts.
// For each component field fragment it maps the document's literal GQL string to the
// fragment's shape type so users get proper typing when using component fields.
func (p *HoudiniReact) AddGraphQLType(ctx context.Context) ([]string, error) {
	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return nil, err
	}

	cfs, err := p.loadComponentFields(ctx)
	if err != nil {
		return nil, err
	}
	if len(cfs) == 0 {
		return []string{}, nil
	}

	targetPath := filepath.Join(
		projectConfig.ProjectRoot,
		projectConfig.RuntimeDir,
		"runtime",
		"index.ts",
	)

	existing, err := afero.ReadFile(p.Filesystem(), targetPath)
	if err != nil {
		return []string{}, nil
	}
	existingStr := string(existing)

	// Idempotency: skip if already injected.
	if strings.Contains(existingStr, "GraphQL<_Document") {
		return []string{}, nil
	}

	var preamble strings.Builder
	var typeChain strings.Builder

	for _, cf := range cfs {
		preamble.WriteString(fmt.Sprintf("import type { %s } from '../artifacts/%s'\n", cf.fragment, cf.fragment))
		typeChain.WriteString(fmt.Sprintf("_Document extends `%s` ? Required<%s>['shape'] : ", cf.content, cf.fragment))
	}

	// Legacy structure: preamble (fragment imports) first, then existing content, then type.
	appended := preamble.String() +
		existingStr +
		"\nexport type GraphQL<_Document extends string> = " +
		typeChain.String() + "never\n"

	if err := plugins.WriteFile(p.Filesystem(), targetPath, []byte(appended), 0644); err != nil {
		return nil, err
	}
	return []string{targetPath}, nil
}

// UpdateHookFiles injects per-document typed overloads into each hook .ts file
// in the plugin runtime directory.
func (p *HoudiniReact) UpdateHookFiles(ctx context.Context) ([]string, error) {
	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return nil, err
	}

	hooksDir := filepath.Join(projectConfig.PluginRuntimeDirectory(p.Name()), "hooks")

	// Load all visible documents grouped by kind in a single DB trip, also noting which
	// fragments are marked @plural (so useFragment overloads can take/return a list).
	docsByKind := map[string][]string{} // kind → []name
	pluralFragments := map[string]bool{}
	err = p.DB.StepQuery(ctx, `
		SELECT d.name, d.kind, dd.document IS NOT NULL AS plural
		FROM documents d
		LEFT JOIN document_directives dd ON dd.document = d.id AND dd.directive = 'plural'
		WHERE d.visible = 1
		ORDER BY d.name ASC
	`, nil, func(q plugins.Row) {
		name := q.ColumnText(0)
		docsByKind[q.ColumnText(1)] = append(docsByKind[q.ColumnText(1)], name)
		if q.ColumnInt(2) == 1 {
			pluralFragments[name] = true
		}
	})
	if err != nil {
		return nil, err
	}

	// Build the set of visible fragments that get an embedded refetch query, so
	// useFragmentHandle is wired up with the generated query as its refetchArtifact.
	// This covers both @paginate fragments (detected via discovered_lists, populated
	// during Validate) and @refetchable fragments (detected via the directive). We
	// don't look for a pre-existing _Pagination_Query document because GenerateRuntime
	// runs concurrently with GenerateDocuments and it may not exist yet.
	refetchableFragments := map[string]string{}
	err = p.DB.StepQuery(ctx, `
		SELECT DISTINCT d.name, 0 AS refetchable
		FROM documents d
		JOIN discovered_lists dl ON dl.document = d.id
		WHERE d.visible = 1 AND d.kind = 'fragment'
		  AND dl.paginate IS NOT NULL

		UNION

		SELECT DISTINCT d.name, 1 AS refetchable
		FROM documents d
		JOIN document_directives dd ON dd.document = d.id
		WHERE d.visible = 1 AND d.kind = 'fragment'
		  AND dd.directive = 'refetchable'
	`, nil, func(q plugins.Row) {
		name := q.ColumnText(0)
		// @paginate fragments embed a <name>_Pagination_Query; @refetchable fragments
		// embed a <name>_Refetch_Query. both are wired up as the refetchArtifact.
		if q.ColumnInt(1) == 1 {
			refetchableFragments[name] = graphql.FragmentRefetchQueryName(name)
		} else {
			refetchableFragments[name] = graphql.FragmentPaginationQueryName(name)
		}
	})
	if err != nil {
		return nil, err
	}

	var changed []string
	for _, spec := range hookSpecs {
		names := docsByKind[spec.kind]
		if len(names) == 0 {
			continue
		}

		fp := filepath.Join(hooksDir, spec.file)
		existing, err := afero.ReadFile(p.Filesystem(), fp)
		if err != nil {
			continue // file not yet copied — skip
		}
		existingStr := string(existing)

		insertPos := strings.Index(existingStr, spec.marker)
		if insertPos == -1 {
			continue
		}

		// Already patched — skip to stay idempotent.
		if strings.Contains(existingStr[:insertPos], "$houdini/artifacts/") {
			continue
		}

		// Imports go at the top of the file; overloads go immediately before the
		// generic function so TypeScript sees them as proper overload declarations.
		var top strings.Builder
		if spec.preamble != "" {
			top.WriteString(spec.preamble)
			top.WriteString("\n")
		}
		for _, name := range names {
			top.WriteString(spec.imports(name, refetchableFragments[name], pluralFragments[name]))
		}
		top.WriteString("\n")

		var before strings.Builder
		for _, name := range names {
			before.WriteString(spec.overloads(name, refetchableFragments[name], pluralFragments[name]))
		}
		if spec.passthrough != "" {
			before.WriteString(spec.passthrough + "\n")
		}

		result := top.String() + existingStr[:insertPos] + before.String() + existingStr[insertPos:]

		if err := plugins.WriteFile(p.Filesystem(), fp, []byte(result), 0644); err != nil {
			return nil, err
		}
		changed = append(changed, fp)
	}

	return changed, nil
}

// formatManifest generates the TypeScript source for manifest.ts.
func formatManifest(
	manifest ProjectManifest,
	runtimeDir string,
	artifactDir string,
	projectRoot string,
	scalars map[string]plugins.ScalarConfig,
) (string, error) {
	// Build a lookup from query name → QueryManifest for artifact/loading/variable info.
	queryByName := map[string]QueryManifest{}
	for _, q := range manifest.PageQueries {
		queryByName[q.Name] = q
	}
	for _, q := range manifest.LayoutQueries {
		queryByName[q.Name] = q
	}

	var sb strings.Builder
	sb.WriteString("import type { RouterManifest } from 'houdini/runtime'\n\n")
	sb.WriteString("export default {\n")
	sb.WriteString("\tpages: {\n")

	// Accumulate the ordered headers() loaders per page. These are emitted as a
	// separate `route_headers` export (below) rather than nested in the manifest
	// so that the client bundle, which only imports the default manifest, never
	// references the source modules' headers() exports — letting dead-code
	// elimination strip them from the client build.
	headerLoadersByID := map[string][]string{}

	for _, id := range sortedKeys(manifest.Pages) {
		page := manifest.Pages[id]

		cleanURL := stripRouteGroups(page.URL)
		pattern, params, err := parsePagePattern(page.URL)
		if err != nil {
			return "", fmt.Errorf("could not parse pattern for page %s: %w", id, err)
		}

		// Component points to the generated entry file, not the source file.
		// Entry files live at {pluginDir}/units/entries/{id}.jsx.
		pluginDir := filepath.Dir(runtimeDir) // runtimeDir = {pluginDir}/runtime
		entryAbs := filepath.Join(pluginDir, "units", "entries", id)
		componentRel, err := filepath.Rel(runtimeDir, entryAbs)
		if err != nil {
			return "", err
		}

		sb.WriteString(fmt.Sprintf("\t\t%q: {\n", id))
		sb.WriteString(fmt.Sprintf("\t\t\tid: %q,\n", id))
		sb.WriteString(fmt.Sprintf("\t\t\turl: %q,\n", cleanURL))
		sb.WriteString(fmt.Sprintf("\t\t\tpattern: %s,\n", pattern))
		sb.WriteString(fmt.Sprintf("\t\t\tparams: %s,\n", formatParams(params, page.Params)))
		sb.WriteString(fmt.Sprintf("\t\t\tsearchParams: %s,\n", formatSearchParams(page.SearchParams)))

		// Documents block.
		sb.WriteString("\t\t\tdocuments: {\n")
		for _, queryName := range page.Queries {
			q, ok := queryByName[queryName]
			if !ok {
				continue
			}
			artifactAbs := filepath.Join(artifactDir, queryName)
			artifactRel, err := filepath.Rel(runtimeDir, artifactAbs)
			if err != nil {
				return "", err
			}
			loading := "false"
			if q.Loading {
				loading = "true"
			}
			sb.WriteString(fmt.Sprintf("\t\t\t\t%s: {\n", queryName))
			sb.WriteString(fmt.Sprintf("\t\t\t\t\tartifact: () => import(%q),\n", filepath.ToSlash(artifactRel)))
			sb.WriteString(fmt.Sprintf("\t\t\t\t\tloading: %s,\n", loading))
			sb.WriteString("\t\t\t\t\tvariables: ")
			sb.WriteString(formatVariables(q.Variables))
			sb.WriteString(",\n")
			sb.WriteString("\t\t\t\t},\n")
		}
		sb.WriteString("\t\t\t},\n")

		sb.WriteString(fmt.Sprintf("\t\t\tcomponent: () => import(%q),\n", filepath.ToSlash(componentRel)))

		sb.WriteString("\t\t},\n")

		// Collect the ordered headers() loaders for every segment in the layout
		// chain (outermost first) and then the page itself. The server calls them
		// in order and merges the results so the page wins over layouts and inner
		// layouts win over outer ones.
		var headerSources []string
		for _, layoutID := range page.Layouts {
			if layout, ok := manifest.Layouts[layoutID]; ok && layout.Headers {
				headerSources = append(headerSources, layout.Path)
			}
		}
		if page.Headers {
			headerSources = append(headerSources, page.Path)
		}
		var loaders []string
		for _, src := range headerSources {
			srcAbs := stripViewExt(filepath.Join(projectRoot, src))
			srcRel, err := filepath.Rel(runtimeDir, srcAbs)
			if err != nil {
				return "", err
			}
			loaders = append(loaders, fmt.Sprintf("() => import(%q).then(m => m.headers)", filepath.ToSlash(srcRel)))
		}
		if len(loaders) > 0 {
			headerLoadersByID[id] = loaders
		}
	}

	sb.WriteString("\t},\n")

	// pagesByUrl maps each route's url to its page id so <Link> and goto can resolve a
	// destination to its page in O(1), without scanning the manifest at runtime.
	sb.WriteString("\tpagesByUrl: {\n")
	for _, id := range sortedKeys(manifest.Pages) {
		sb.WriteString(fmt.Sprintf("\t\t%q: %q,\n", stripRouteGroups(manifest.Pages[id].URL), id))
	}
	sb.WriteString("\t},\n")

	sb.WriteString("} as const satisfies RouterManifest<any>\n")

	// route_headers is a server-only export: it maps a page id to the ordered
	// list of headers() loaders for that page and its layout chain. It is kept
	// out of the default manifest so the client build can tree-shake it away.
	if len(headerLoadersByID) > 0 {
		sb.WriteString("\nexport const route_headers = {\n")
		for _, id := range sortedKeys(headerLoadersByID) {
			sb.WriteString(fmt.Sprintf("\t%q: [\n", id))
			for _, loader := range headerLoadersByID[id] {
				sb.WriteString(fmt.Sprintf("\t\t%s,\n", loader))
			}
			sb.WriteString("\t],\n")
		}
		sb.WriteString("}\n")
	}

	// form_actions is a server-only export: lazy literal-import thunks for the artifacts of
	// mutations carrying @endpoint, keyed by mutation name. The no-JS form handler looks a
	// submitted form's mutation up here. Kept out of the default manifest so the client
	// build tree-shakes the mutation artifacts away.
	if len(manifest.FormActions) > 0 {
		sb.WriteString("\nexport const form_actions = {\n")
		for _, name := range manifest.FormActions {
			artifactAbs := filepath.Join(artifactDir, name)
			artifactRel, err := filepath.Rel(runtimeDir, artifactAbs)
			if err != nil {
				return "", err
			}
			sb.WriteString(fmt.Sprintf("\t%s: () => import(%q),\n", name, filepath.ToSlash(artifactRel)))
		}
		sb.WriteString("}\n")
	}

	// auth_mutations maps each @auth mutation to its sessionPath. Server-only: the session-mint
	// plugin and the no-JS form handler use it to find the result field that becomes the
	// session. A plain string map (sorted for stable output), independent of form_actions.
	if len(manifest.AuthMutations) > 0 {
		authNames := make([]string, 0, len(manifest.AuthMutations))
		for name := range manifest.AuthMutations {
			authNames = append(authNames, name)
		}
		sort.Strings(authNames)
		sb.WriteString("\nexport const auth_mutations = {\n")
		for _, name := range authNames {
			sb.WriteString(fmt.Sprintf("\t%s: %q,\n", name, manifest.AuthMutations[name]))
		}
		sb.WriteString("}\n")
	}

	// Export a name→TS-type map for custom scalars, plus the _TSType resolver that maps
	// a GQL scalar name to its TS type. Both Link.tsx and the generated mock import
	// _TSType from here so the resolution lives in exactly one place.
	sb.WriteString("\nexport type RouteScalars = {\n")
	for _, name := range sortedKeys(scalars) {
		sb.WriteString(fmt.Sprintf("\t%s: %s\n", name, scalars[name].Type))
	}
	sb.WriteString("}\n")
	sb.WriteString(tsTypeResolver)

	return sb.String(), nil
}

// tsTypeResolver is the shared _TSType<T> definition emitted into manifest.ts: custom
// scalars come from RouteScalars, built-ins map to their JS types, everything else is a
// string. Link.tsx and the mock file both import it rather than redefining it.
const tsTypeResolver = "\nexport type _TSType<T extends string> = T extends keyof RouteScalars\n" +
	"\t? RouteScalars[T]\n" +
	"\t: T extends 'Int' | 'Float'\n" +
	"\t\t? number\n" +
	"\t\t: T extends 'ID'\n" +
	"\t\t\t? string | number\n" +
	"\t\t\t: T extends 'Boolean'\n" +
	"\t\t\t\t? boolean\n" +
	"\t\t\t\t: string\n"

// parsePagePattern converts a page URL (e.g. "/(group)/[id]/nested") into a
// TypeScript regex literal and a params array. Route groups like (foo) are
// stripped since they don't affect the URL.
func parsePagePattern(url string) (pattern string, params []routeParam, err error) {
	if url == "/" {
		return `/^\/$/`, nil, nil
	}

	segments := routeSegments(url)
	var regexParts []string

	for _, seg := range segments {
		switch {
		case strings.HasPrefix(seg, "[...") && strings.HasSuffix(seg, "]"):
			name := seg[4 : len(seg)-1]
			params = append(params, routeParam{Name: name, Rest: true, Chained: true})
			// \/ escapes the path separator inside the JS regex literal
			regexParts = append(regexParts, `(?:\/(.*))?`)

		case strings.HasPrefix(seg, "[[") && strings.HasSuffix(seg, "]]"):
			name := seg[2 : len(seg)-2]
			params = append(params, routeParam{Name: name, Optional: true, Chained: true})
			regexParts = append(regexParts, `(?:\/([^/]+))?`)

		case strings.HasPrefix(seg, "[") && strings.HasSuffix(seg, "]"):
			name := seg[1 : len(seg)-1]
			params = append(params, routeParam{Name: name})
			// [^/] is inside a character class so the inner / does not need escaping
			regexParts = append(regexParts, `\/([^/]+?)`)

		default:
			regexParts = append(regexParts, `\/`+regexEscape(seg))
		}
	}

	pattern = `/^` + strings.Join(regexParts, "") + `\/?$/`
	return pattern, params, nil
}

type routeParam struct {
	Name     string
	Optional bool
	Rest     bool
	Chained  bool
}

// routeSegments splits a URL into its path segments, filtering out route groups.
func routeSegments(url string) []string {
	parts := strings.Split(strings.TrimPrefix(url, "/"), "/")
	var out []string
	for _, p := range parts {
		if p == "" {
			continue
		}
		// skip route groups like (group)
		if strings.HasPrefix(p, "(") && strings.HasSuffix(p, ")") {
			continue
		}
		out = append(out, p)
	}
	return out
}

// regexEscape escapes special regex characters in a literal URL segment.
func regexEscape(s string) string {
	var b strings.Builder
	for _, c := range s {
		switch c {
		case '.', '+', '*', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\':
			b.WriteRune('\\')
		}
		b.WriteRune(c)
	}
	return b.String()
}

// formatParams renders a []routeParam as a TypeScript array literal, including a
// resolved TypeScript type for each param so the manifest can drive type extraction.
func formatParams(params []routeParam, pageParams map[string]*ParamTypeInfo) string {
	if len(params) == 0 {
		return "[]"
	}
	var parts []string
	for _, p := range params {
		// Emit the GQL type name so the manifest-driven _TSType<T> utility can resolve
		// it against RouteScalars (custom scalars) and built-in GQL scalar names.
		gqlType := "String"
		if info, ok := pageParams[p.Name]; ok && info != nil {
			gqlType = info.Type
		}
		parts = append(parts, fmt.Sprintf(
			`{ name: %q, optional: %v, rest: %v, chained: %v, type: %q }`,
			p.Name, p.Optional, p.Rest, p.Chained, gqlType,
		))
	}
	return "[\n\t\t\t\t" + strings.Join(parts, ",\n\t\t\t\t") + "\n\t\t\t]"
}

// formatSearchParams renders the page's searchParams as a TypeScript array literal.
// Each entry carries the GQL type name (resolved against RouteScalars / built-in
// scalars by _TSType<T>) and the wrapper chain so list-typed params can be
// serialized as repeated query keys. All search params are optional by construction.
func formatSearchParams(searchParams map[string]*ParamTypeInfo) string {
	if len(searchParams) == 0 {
		return "[]"
	}
	var parts []string
	for _, name := range sortedKeys(searchParams) {
		info := searchParams[name]
		gqlType := "String"
		wrappers := "[]"
		if info != nil {
			gqlType = info.Type
			if len(info.Wrappers) > 0 {
				quoted := make([]string, len(info.Wrappers))
				for i, w := range info.Wrappers {
					quoted[i] = fmt.Sprintf("%q", w)
				}
				wrappers = "[" + strings.Join(quoted, ", ") + "]"
			}
		}
		parts = append(parts, fmt.Sprintf(
			`{ name: %q, type: %q, wrappers: %s }`,
			name, gqlType, wrappers,
		))
	}
	return "[\n\t\t\t\t" + strings.Join(parts, ",\n\t\t\t\t") + "\n\t\t\t]"
}

// InjectComponentFieldArtifactTypes patches generated artifact TypeScript files to add
// React.ComponentType<{}> accessors for component fields. This runs in houdini-react
// (not houdini-core) because React.ComponentType is a React-specific concern.
//
// For each component field (fragment → accessor field name), it scans all artifact .ts
// files looking for a `" $fragments"` block that references the component field fragment.
// When found, it injects the accessor property immediately before the `" $fragments"` key
// and adds the React import at the top of the file.
func (p *HoudiniReact) InjectComponentFieldArtifactTypes(ctx context.Context) ([]string, error) {
	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return nil, err
	}

	cfs, err := p.loadComponentFields(ctx)
	if err != nil {
		return nil, err
	}
	if len(cfs) == 0 {
		return []string{}, nil
	}

	artifactDir := filepath.Join(projectConfig.ProjectRoot, projectConfig.RuntimeDir, "artifacts")

	// Read all artifact .ts files once. The artifacts directory may not exist yet
	// on the very first run (GenerateDocuments and GenerateRuntime run in parallel);
	// treat that as a no-op rather than an error.
	entries, err := afero.ReadDir(p.Filesystem(), artifactDir)
	if err != nil {
		return []string{}, nil
	}

	var changed []string
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".ts") {
			continue
		}
		artPath := filepath.Join(artifactDir, entry.Name())
		raw, err := afero.ReadFile(p.Filesystem(), artPath)
		if err != nil {
			continue
		}
		str := string(raw)
		modified := str

		for _, cf := range cfs {
			// Look for this component field's fragment referenced in a $fragments block.
			// The generated pattern is:  <fragmentName>: {};
			cfRef := cf.fragment + ": {};"
			if !strings.Contains(modified, cfRef) {
				continue
			}
			// Derive the accessor type from the component's actual props, excluding the
			// runtime-injected fragment prop. Omit<ComponentPropsWithoutRef<typeof Comp>, prop>
			// gives the user all the component's other props while removing the one the
			// runtime always provides — the user can never pass it explicitly.
			compAlias := "__" + cf.typeName + cf.field + "Component__"
			artifactDir := filepath.Join(projectConfig.ProjectRoot, projectConfig.RuntimeDir, "artifacts")
			compAbs := stripViewExt(filepath.Join(projectConfig.ProjectRoot, cf.filepath))
			compRel := "./" + toSlash(mustRel(artifactDir, compAbs))
			accessor := fmt.Sprintf(
				"readonly %s: React.ComponentType<Omit<React.ComponentPropsWithoutRef<typeof %s>, %q>>;",
				cf.field, compAlias, cf.prop,
			)
			// Idempotency: skip if the accessor is already present.
			if strings.Contains(modified, accessor) {
				continue
			}
			// Import the component so TypeScript can derive its prop types.
			compImport := fmt.Sprintf("import type %s from '%s';", compAlias, compRel)
			if !strings.Contains(modified, compImport) {
				modified = compImport + "\n" + modified
			}
			// Find the `readonly " $fragments": {` line that contains this fragment
			// reference and insert the accessor property before it.
			fragmentsKey := `readonly " $fragments": {`
			insertIdx := strings.LastIndex(modified[:strings.Index(modified, cfRef)], fragmentsKey)
			if insertIdx == -1 {
				continue
			}
			// Determine the indentation of the $fragments line.
			lineStart := strings.LastIndex(modified[:insertIdx], "\n") + 1
			indent := ""
			for _, ch := range modified[lineStart:insertIdx] {
				if ch == '\t' || ch == ' ' {
					indent += string(ch)
				} else {
					break
				}
			}
			injection := indent + accessor + "\n"
			modified = modified[:insertIdx] + injection + modified[insertIdx:]
		}

		if modified == str {
			continue
		}

		// Prepend the React import if any accessor was injected.
		reactImport := "import type * as React from 'react';\n"
		if !strings.HasPrefix(modified, reactImport) {
			modified = reactImport + modified
		}

		if err := plugins.WriteFile(p.Filesystem(), artPath, []byte(modified), 0644); err != nil {
			return nil, err
		}
		changed = append(changed, artPath)
	}

	return changed, nil
}

// GenerateComponentFieldTypes generates a TypeScript module augmentation that widens
// CacheTypeDef.componentFields to include React.ComponentType<any>. This lets the
// houdini-react framework inject React components into GraphQL data objects (via
// injectComponents) while still satisfying the GraphQLObject constraint.
//
// The augmentation is a side-effect import injected into the plugin runtime index.tsx
// so that TypeScript applies it when the runtime is loaded.
func (p *HoudiniReact) GenerateComponentFieldTypes(ctx context.Context) ([]string, error) {
	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return nil, err
	}

	cfs, err := p.loadComponentFields(ctx)
	if err != nil {
		return nil, err
	}
	if len(cfs) == 0 {
		return []string{}, nil
	}

	runtimeDir := projectConfig.PluginRuntimeDirectory(p.Name())

	// Write the augmentation file.
	augPath := filepath.Join(runtimeDir, "componentFieldTypes.ts")
	augContent := `import type * as React from 'react'

declare module 'houdini/runtime' {
	interface CacheTypeDef {
		componentFields: React.ComponentType<any>
	}
}
`
	existing, _ := afero.ReadFile(p.Filesystem(), augPath)
	var changed []string
	if string(existing) != augContent {
		if err := p.Filesystem().MkdirAll(runtimeDir, 0755); err != nil {
			return nil, err
		}
		if err := plugins.WriteFile(p.Filesystem(), augPath, []byte(augContent), 0644); err != nil {
			return nil, err
		}
		changed = append(changed, augPath)
	}

	// Inject a side-effect import into the plugin runtime index so TypeScript
	// processes the augmentation when the runtime is loaded.
	indexPath := filepath.Join(runtimeDir, "index.tsx")
	indexBytes, err := afero.ReadFile(p.Filesystem(), indexPath)
	if err != nil {
		return changed, nil // index not yet copied; will be patched on next run
	}
	indexStr := string(indexBytes)
	sideEffect := `import './componentFieldTypes'`
	if !strings.Contains(indexStr, sideEffect) {
		patched := sideEffect + "\n" + indexStr
		if err := plugins.WriteFile(p.Filesystem(), indexPath, []byte(patched), 0644); err != nil {
			return nil, err
		}
		changed = append(changed, indexPath)
	}

	return changed, nil
}

// stripRouteGroups removes (group) segments from a URL, leaving only real path
// segments. E.g. "/(auth)/users/[id]" → "/users/[id]".
func stripRouteGroups(url string) string {
	parts := strings.Split(url, "/")
	var out []string
	for _, p := range parts {
		if p == "" {
			continue
		}
		if strings.HasPrefix(p, "(") && strings.HasSuffix(p, ")") {
			continue
		}
		out = append(out, p)
	}
	return "/" + strings.Join(out, "/")
}

// GenerateTsConfig writes .houdini/tsconfig.json by copying the template from the
// plugin runtime directory (written there by IncludeRuntime).
func (p *HoudiniReact) GenerateTsConfig(ctx context.Context) ([]string, error) {
	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return nil, err
	}

	runtimeDir := projectConfig.PluginRuntimeDirectory(p.Name())
	houdiniDir := filepath.Join(projectConfig.ProjectRoot, projectConfig.RuntimeDir)
	tsConfigPath := filepath.Join(houdiniDir, "tsconfig.json")

	content, err := afero.ReadFile(p.Filesystem(), filepath.Join(runtimeDir, "tsconfig.json"))
	if err != nil {
		return nil, err
	}

	existing, _ := afero.ReadFile(p.Filesystem(), tsConfigPath)
	if string(existing) == string(content) {
		return []string{}, nil
	}

	if err := p.Filesystem().MkdirAll(houdiniDir, 0755); err != nil {
		return nil, err
	}
	if err := afero.WriteFile(p.Filesystem(), tsConfigPath, content, 0644); err != nil {
		return nil, err
	}

	return []string{tsConfigPath}, nil
}

// formatVariables renders query variables as a TypeScript object literal.
func formatVariables(vars map[string]VariableTypeInfo) string {
	if len(vars) == 0 {
		return "{}"
	}
	var parts []string
	for _, name := range sortedKeys(vars) {
		parts = append(parts, fmt.Sprintf("%s: { type: %q }", name, vars[name].Type))
	}
	return "{ " + strings.Join(parts, ", ") + " }"
}
