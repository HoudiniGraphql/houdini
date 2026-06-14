package plugin

import (
	"context"
	"fmt"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"github.com/spf13/afero"

	plugins "code.houdinigraphql.com/plugins"
	pluginglob "code.houdinigraphql.com/plugins/glob"
)

// ProjectManifest is the static description of a project's routes and queries.
type ProjectManifest struct {
	Pages           map[string]PageManifest       `json:"pages"`
	Layouts         map[string]PageManifest       `json:"layouts"`
	PageQueries     map[string]QueryManifest      `json:"page_queries"`
	LayoutQueries   map[string]QueryManifest      `json:"layout_queries"`
	Artifacts       []string                      `json:"artifacts"`
	LocalSchema     bool                          `json:"local_schema"`
	LocalYoga       bool                          `json:"local_yoga"`
	ComponentFields map[string]ComponentFieldInfo `json:"component_fields"`
}

type PageManifest struct {
	ID           string                    `json:"id"`
	Queries      []string                  `json:"queries"`
	QueryOptions []string                  `json:"query_options"`
	URL          string                    `json:"url"`
	Layouts      []string                  `json:"layouts"`
	Path         string                    `json:"path"`
	Params       map[string]*ParamTypeInfo `json:"params"`
}

// ParamTypeInfo describes the GraphQL type of a URL route parameter.
// A nil value in PageManifest.Params means the type is unconstrained.
type ParamTypeInfo struct {
	Type     string   `json:"type"`
	Wrappers []string `json:"wrappers"`
}

type QueryManifest struct {
	Name      string                      `json:"name"`
	URL       string                      `json:"url"`
	Loading   bool                        `json:"loading"`
	Path      string                      `json:"path"`
	Variables map[string]VariableTypeInfo `json:"variables"`
}

type VariableTypeInfo struct {
	Type     string   `json:"type"`
	Wrappers []string `json:"wrappers"`
}

type ComponentFieldInfo struct {
	Filepath string `json:"filepath"`
}

// routeDoc holds the database-side information for a single +page.gql or +layout.gql.
type routeDoc struct {
	name      string
	filepath  string // as stored in raw_documents, relative to project root
	loading   bool
	variables map[string]VariableTypeInfo
}

// walkState carries accumulated context as we descend the route tree.
type walkState struct {
	availableQueries []string               // layout query names in scope, outermost first
	availableLayouts []string               // layout IDs currently wrapping this level
	variables        map[string]VariableTypeInfo // route param types contributed by layout queries
}

// LoadManifest builds a ProjectManifest by querying the database for route GQL
// documents and walking the filesystem for page/layout view files.
func (p *HoudiniReact) LoadManifest(ctx context.Context) (ProjectManifest, error) {
	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return ProjectManifest{}, err
	}

	routesDir := filepath.Join(projectConfig.ProjectRoot, "src", "routes")
	apiDir := filepath.Join(projectConfig.ProjectRoot, "src", "api")

	manifest := ProjectManifest{
		Pages:           map[string]PageManifest{},
		Layouts:         map[string]PageManifest{},
		PageQueries:     map[string]QueryManifest{},
		LayoutQueries:   map[string]QueryManifest{},
		Artifacts:       []string{},
		ComponentFields: map[string]ComponentFieldInfo{},
	}

	// Load all route GQL documents from the database.
	pageDocByDir, layoutDocByDir, err := p.loadRouteDocuments(ctx, projectConfig.ProjectRoot, routesDir)
	if err != nil {
		return ProjectManifest{}, err
	}

	// Phase 1: use the parallel glob walker to discover all view files under routesDir.
	// This replaces per-directory afero.Exists calls with a single bounded-concurrency scan.
	viewsByDir, err := p.discoverViewFiles(ctx, routesDir)
	if err != nil {
		return ProjectManifest{}, err
	}

	// Phase 2: compute every directory that needs visiting — union of dirs from view files,
	// dirs from DB GQL filepaths, and all their ancestors — sorted topologically
	// (shallowest first) so parents are always processed before children.
	dirSet := map[string]bool{".": true}
	addWithAncestors := func(dirKey string) {
		for d := dirKey; d != "." && d != ""; d = filepath.Dir(d) {
			if dirSet[d] {
				break
			}
			dirSet[d] = true
		}
	}
	for dir := range viewsByDir {
		addWithAncestors(dir)
	}
	for dir := range pageDocByDir {
		addWithAncestors(dir)
	}
	for dir := range layoutDocByDir {
		addWithAncestors(dir)
	}

	dirs := sortedKeys(dirSet)
	// Sort so parents always precede children. "." is the root (depth 0); all
	// other paths get depth = number of path components. Within the same depth,
	// sort alphabetically.
	dirDepth := func(d string) int {
		if d == "." {
			return 0
		}
		return strings.Count(d, "/") + 1
	}
	sort.Slice(dirs, func(i, j int) bool {
		di, dj := dirDepth(dirs[i]), dirDepth(dirs[j])
		if di != dj {
			return di < dj
		}
		return dirs[i] < dirs[j]
	})

	// Phase 3: iterate topologically, accumulating layout query scope and building the manifest.
	claimedPageDocs := map[string]bool{}
	stateByDir := map[string]walkState{
		".": {availableQueries: []string{}, availableLayouts: []string{}, variables: map[string]VariableTypeInfo{}},
	}

	for _, dirKey := range dirs {
		parentKey := filepath.Dir(dirKey)
		if parentKey == dirKey {
			parentKey = "."
		}
		state, ok := stateByDir[parentKey]
		if !ok {
			state = stateByDir["."]
		}

		url := dirKeyToURL(dirKey)
		id := pageID(url)

		newLayoutQueries := clone(state.availableQueries)
		newLayoutIDs := clone(state.availableLayouts)
		newVariables := cloneVariables(state.variables)

		// Layout query.
		if layoutDoc, ok := layoutDocByDir[dirKey]; ok {
			qPath := routeRelPath(layoutDoc.filepath, projectConfig.ProjectRoot, routesDir)
			manifest.LayoutQueries[id] = QueryManifest{
				Name:      layoutDoc.name,
				URL:       url,
				Loading:   layoutDoc.loading,
				Path:      qPath,
				Variables: cloneVariables(layoutDoc.variables),
			}
			newLayoutQueries = append(newLayoutQueries, layoutDoc.name)
			for k, v := range layoutDoc.variables {
				newVariables[k] = v
			}
		}

		// Layout view.
		if info, ok := viewsByDir[dirKey]; ok && info.layoutViewPath != "" {
			relPath := toSlash(mustRel(projectConfig.ProjectRoot, info.layoutViewPath))
			manifest.Layouts[id] = PageManifest{
				ID:           id,
				Queries:      clone(state.availableQueries),
				QueryOptions: clone(newLayoutQueries),
				URL:          url,
				Layouts:      clone(state.availableLayouts),
				Path:         relPath,
				Params:       buildParams(url, newVariables),
			}
			newLayoutIDs = append(newLayoutIDs, id)
		}

		// Page query.
		if pageDoc, ok := pageDocByDir[dirKey]; ok {
			qPath := routeRelPath(pageDoc.filepath, projectConfig.ProjectRoot, routesDir)
			manifest.PageQueries[id] = QueryManifest{
				Name:      pageDoc.name,
				URL:       url,
				Loading:   pageDoc.loading,
				Path:      qPath,
				Variables: cloneVariables(pageDoc.variables),
			}
		}

		// Page view.
		if info, ok := viewsByDir[dirKey]; ok && info.pageViewPath != "" {
			claimedPageDocs[dirKey] = true
			allQueries := clone(newLayoutQueries)
			// Merge page query variables so param types from the page's own
			// query (e.g. $id: ID!) are available when building the param map.
			allVars := cloneVariables(newVariables)
			if pageDoc, ok := pageDocByDir[dirKey]; ok {
				allQueries = append(allQueries, pageDoc.name)
				for k, v := range pageDoc.variables {
					allVars[k] = v
				}
			}
			pageURL := url
			if len(url) > 1 && strings.HasSuffix(url, "/") {
				pageURL = url[:len(url)-1]
			}
			relPath := toSlash(mustRel(projectConfig.ProjectRoot, info.pageViewPath))
			manifest.Pages[id] = PageManifest{
				ID:           id,
				Queries:      clone(allQueries),
				QueryOptions: clone(allQueries),
				URL:          pageURL,
				Layouts:      clone(newLayoutIDs),
				Path:         relPath,
				Params:       buildParams(url, allVars),
			}
		}

		stateByDir[dirKey] = walkState{
			availableQueries: newLayoutQueries,
			availableLayouts: newLayoutIDs,
			variables:        newVariables,
		}
	}

	// Any page.gql without a matching view file in the same directory is invalid.
	for dir, doc := range pageDocByDir {
		if !claimedPageDocs[dir] {
			return ProjectManifest{}, fmt.Errorf(
				"page query %q at %q has no corresponding page view in the same directory",
				doc.name, doc.filepath,
			)
		}
	}

	manifest.LocalSchema, manifest.LocalYoga, err = p.detectLocalAPI(apiDir)
	if err != nil {
		return ProjectManifest{}, err
	}

	return manifest, nil
}

// loadRouteDocuments queries the database for all +page.gql and +layout.gql documents
// and their variables in a single trip, keyed by directory path relative to routesDir.
func (p *HoudiniReact) loadRouteDocuments(
	ctx context.Context,
	projectRoot string,
	routesDir string,
) (pageDocByDir map[string]routeDoc, layoutDocByDir map[string]routeDoc, err error) {
	pageDocByDir = map[string]routeDoc{}
	layoutDocByDir = map[string]routeDoc{}

	// Intermediate map from document ID to routeDoc to accumulate variables across rows.
	type docEntry struct {
		doc    routeDoc
		isPage bool
		dirKey string
	}
	docsByID := map[int64]*docEntry{}

	err = p.DB.StepQuery(ctx, `
		SELECT d.id, d.name, rd.filepath,
		       CASE WHEN EXISTS(
		           SELECT 1 FROM document_directives dd
		           WHERE dd.document = d.id AND dd.directive = 'loading'
		       ) THEN 1 ELSE 0 END AS loading,
		       dv.name,
		       dv.type,
		       COALESCE(dv.type_modifiers, '')
		FROM documents d
		JOIN raw_documents rd ON d.raw_document = rd.id
		LEFT JOIN document_variables dv ON dv.document = d.id
		WHERE d.kind = 'query'
		  AND (rd.filepath LIKE '%+page.gql' OR rd.filepath LIKE '%+layout.gql')
		ORDER BY d.id
	`, nil, func(q plugins.Row) {
		id := q.ColumnInt64(0)
		entry, ok := docsByID[id]
		if !ok {
			fp := q.ColumnText(2)
			fullPath := filepath.Join(projectRoot, fp)
			dirKey, _ := filepath.Rel(routesDir, filepath.Dir(fullPath))
			entry = &docEntry{
				doc: routeDoc{
					name:      q.ColumnText(1),
					filepath:  fp,
					loading:   q.ColumnInt(3) == 1,
					variables: map[string]VariableTypeInfo{},
				},
				isPage: strings.HasSuffix(fp, "+page.gql"),
				dirKey: dirKey,
			}
			docsByID[id] = entry
		}
		// columns 4-6 are NULL when there are no variables (LEFT JOIN)
		if varName := q.ColumnText(4); varName != "" {
			entry.doc.variables[varName] = VariableTypeInfo{
				Type:     q.ColumnText(5),
				Wrappers: modifiersToWrappers(q.ColumnText(6)),
			}
		}
	})
	if err != nil {
		return nil, nil, err
	}

	for _, entry := range docsByID {
		if entry.isPage {
			pageDocByDir[entry.dirKey] = entry.doc
		} else {
			layoutDocByDir[entry.dirKey] = entry.doc
		}
	}

	return pageDocByDir, layoutDocByDir, nil
}

type viewInfo struct {
	pageViewPath   string // absolute path to +page.tsx or +page.jsx, empty if absent
	layoutViewPath string // absolute path to +layout.tsx or +layout.jsx, empty if absent
}

// discoverViewFiles uses the parallel glob walker to find all +page and +layout view
// files under routesDir in a single bounded-concurrency scan. Returns a map keyed
// by directory path relative to routesDir.
func (p *HoudiniReact) discoverViewFiles(ctx context.Context, routesDir string) (map[string]viewInfo, error) {
	walker := pluginglob.NewWalker()
	for _, pattern := range []string{"+page.tsx", "+page.jsx", "+layout.tsx", "+layout.jsx"} {
		if err := walker.AddInclude("**/" + pattern); err != nil {
			return nil, err
		}
		// also match files at the root of routesDir (no leading **)
		if err := walker.AddInclude(pattern); err != nil {
			return nil, err
		}
	}

	var mu sync.Mutex
	views := map[string]viewInfo{}

	// If the routes dir doesn't exist yet, there are simply no view files.
	if exists, _ := afero.DirExists(p.Filesystem(), routesDir); !exists {
		return views, nil
	}

	err := walker.Walk(ctx, p.Filesystem(), routesDir, func(relPath string) error {
		dir := filepath.Dir(relPath)
		if dir == "." {
			dir = "."
		}
		absPath := filepath.Join(routesDir, relPath)
		base := filepath.Base(relPath)

		mu.Lock()
		info := views[dir]
		if strings.HasPrefix(base, "+page") {
			info.pageViewPath = absPath
		} else {
			info.layoutViewPath = absPath
		}
		views[dir] = info
		mu.Unlock()
		return nil
	})
	return views, err
}

// dirKeyToURL converts a routesDir-relative directory key (e.g. "(subRoute)/nested")
// to its manifest URL (e.g. "/(subRoute)/nested/").
func dirKeyToURL(dirKey string) string {
	if dirKey == "." {
		return "/"
	}
	return "/" + filepath.ToSlash(dirKey) + "/"
}

// detectLocalAPI checks src/api for +schema and +yoga files.
func (p *HoudiniReact) detectLocalAPI(apiDir string) (localSchema, localYoga bool, err error) {
	fs := p.Filesystem()
	entries, err := afero.ReadDir(fs, apiDir)
	if err != nil {
		return false, false, nil // api dir doesn't exist — not an error
	}
	for _, entry := range entries {
		name := entry.Name()
		if !entry.IsDir() {
			name = strings.TrimSuffix(name, filepath.Ext(name))
		}
		switch name {
		case "+schema":
			localSchema = true
		case "+yoga":
			localYoga = true
		}
	}
	return localSchema, localYoga, nil
}

// pageID converts a URL (like "/(subRoute)/nested/") to a manifest ID (like "__subRoute__nested").
func pageID(url string) string {
	if len(url) > 1 && strings.HasSuffix(url, "/") {
		url = url[:len(url)-1]
	}
	var b strings.Builder
	for _, c := range url {
		switch c {
		case '/', '[', ']', '(', ')', '-':
			b.WriteByte('_')
		default:
			b.WriteRune(c)
		}
	}
	return b.String()
}

// modifiersToWrappers converts a DB type_modifiers string (e.g. "!]!") to TypeScript
// wrapper names (e.g. ["NonNull","List","NonNull"]), reading right-to-left so the
// outermost wrapper comes first.
func modifiersToWrappers(modifiers string) []string {
	var wrappers []string
	for i := len(modifiers) - 1; i >= 0; i-- {
		switch modifiers[i] {
		case '!':
			wrappers = append(wrappers, "NonNull")
		case ']':
			wrappers = append(wrappers, "List")
		}
	}
	if len(wrappers) == 0 {
		return []string{}
	}
	return wrappers
}


// routeRelPath returns the document filepath relative to routesDir for queries,
// using forward slashes.
func routeRelPath(dbFilepath, projectRoot, routesDir string) string {
	full := filepath.Join(projectRoot, dbFilepath)
	rel, _ := filepath.Rel(routesDir, full)
	return toSlash(rel)
}

// buildParams extracts [param] segments from url and maps them to their types.
func buildParams(url string, variables map[string]VariableTypeInfo) map[string]*ParamTypeInfo {
	params := map[string]*ParamTypeInfo{}
	for _, part := range strings.Split(url, "/") {
		if strings.HasPrefix(part, "[") && strings.HasSuffix(part, "]") {
			name := part[1 : len(part)-1]
			if info, ok := variables[name]; ok {
				params[name] = &ParamTypeInfo{Type: info.Type, Wrappers: info.Wrappers}
			} else {
				params[name] = nil
			}
		}
	}
	return params
}

func clone(s []string) []string {
	if s == nil {
		return []string{}
	}
	out := make([]string, len(s))
	copy(out, s)
	return out
}

func cloneVariables(m map[string]VariableTypeInfo) map[string]VariableTypeInfo {
	out := make(map[string]VariableTypeInfo, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}

func mustRel(base, target string) string {
	rel, _ := filepath.Rel(base, target)
	return rel
}

func toSlash(p string) string {
	return filepath.ToSlash(p)
}

// sortedKeys returns the sorted keys of a string-keyed map (used in tests for
// deterministic output).
func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
