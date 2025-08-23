package glob

import (
	"context"
	"path/filepath"
	"sync"
	"testing"

	"github.com/spf13/afero"
)

// createTestFiles creates (empty) files for each key in paths inside root on the given afero.Fs.
// The keys should use forward slashes ("/") as separators.
func createTestFiles(t *testing.T, fs afero.Fs, root string, paths map[string]bool) {
	t.Helper()
	for relPath := range paths {
		// Convert the test’s path (using "/") into the OS-specific path.
		fullPath := filepath.Join(root, filepath.FromSlash(relPath))
		dir := filepath.Dir(fullPath)
		if err := fs.MkdirAll(dir, 0755); err != nil {
			t.Fatalf("failed to create directory %q: %v", dir, err)
		}
		if err := afero.WriteFile(fs, fullPath, []byte("dummy"), 0644); err != nil {
			t.Fatalf("failed to create file %q: %v", fullPath, err)
		}
	}
}

// collectVisitedFiles runs walker.Walk on the given afero.Fs and collects the relative file
// paths for which the onFile callback is called.
func collectVisitedFiles(t *testing.T, walker *Walker, fs afero.Fs, root string) *sync.Map {
	files := &sync.Map{}

	err := walker.Walk(context.Background(), fs, root, func(relPath string) error {
		files.Store(relPath, true)
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}

	return files
}

// TestWalker_FileMatching verifies that files are included or excluded
// according to the include/exclude patterns.
func TestWalker_FileMatching(t *testing.T) {
	tests := []struct {
		name     string
		includes []string
		excludes []string
		paths    map[string]bool // relative file path -> should be visited
	}{
		{
			name:     "basic extension matching",
			includes: []string{"src/**/*.js"},
			excludes: []string{},
			paths: map[string]bool{
				"src/foo.js":           true,
				"src/nested/bar.js":    true,
				"src/deep/nested.js":   true,
				"src/foo.ts":           false,
				"other/file.js":        false,
				"src/nested/style.css": false,
			},
		},
		{
			name:     "multiple extensions",
			includes: []string{"src/**/*.{ts,tsx}"},
			excludes: []string{},
			paths: map[string]bool{
				"src/foo.ts":         true,
				"src/bar.tsx":        true,
				"src/nested/baz.ts":  true,
				"src/nested/app.tsx": true,
				"src/other.js":       false,
				"src/style.css":      false,
			},
		},
		{
			name:     "exclude directory",
			includes: []string{"src/**/*.js"},
			excludes: []string{"src/test/**"},
			paths: map[string]bool{
				"src/foo.js":         true,
				"src/bar/baz.js":     true,
				"src/test/helper.js": false,
				"src/test/unit/a.js": false,
				"src/other/test.js":  true,
			},
		},
		{
			name:     "exclude specific files",
			includes: []string{"src/**/*.js"},
			excludes: []string{"src/**/*.test.js", "src/**/*.spec.js"},
			paths: map[string]bool{
				"src/foo.js":              true,
				"src/bar/baz.test.js":     false,
				"src/nested/app.spec.js":  false,
				"src/test.js":             true,
				"src/deep/nested/main.js": true,
			},
		},
		{
			name:     "specific file includes",
			includes: []string{"**/package.json", "**/tsconfig.json"},
			excludes: []string{},
			paths: map[string]bool{
				"package.json":          true,
				"nested/package.json":   true,
				"deep/tsconfig.json":    true,
				"other.json":            false,
				"config/other.json":     false,
				"deep/nested/config.js": false,
			},
		},
		{
			name:     "overlapping includes and excludes",
			includes: []string{"src/routes/**/foo.js"},
			excludes: []string{"src/routes/bar/**"},
			paths: map[string]bool{
				"src/routes/foo.js":         true,
				"src/routes/api/foo.js":     true,
				"src/routes/bar/foo.js":     false,
				"src/routes/bar/baz/foo.js": false,
				"src/routes/other/foo.js":   true,
			},
		},
		{
			name:     "mixed file types and directories",
			includes: []string{"src/**/*.{js,ts}", "tests/**/*.spec.js"},
			excludes: []string{"src/vendor/**", "**/node_modules/**"},
			paths: map[string]bool{
				"src/app.js":                    true,
				"src/components/button.ts":      true,
				"src/vendor/lib.js":             false,
				"src/vendor/deep/util.ts":       false,
				"src/vendor/auth.spec.js":       false,
				"tests/unit/auth.spec.js":       true,
				"node_modules/pkg/index.js":     false,
				"src/node_modules/pkg/index.ts": false,
			},
		},
		{
			name:     "wildcard filenames",
			includes: []string{"src/**/.env.*", "config/*.yaml"},
			excludes: []string{"**/.env.local"},
			paths: map[string]bool{
				"src/.env.development":     true,
				"src/config/.env.prod":     true,
				"src/deep/.env.staging":    true,
				"src/app/.env.local":       false,
				"config/app.yaml":          true,
				"config/deep/service.yaml": false,
				"other/.env.test":          false,
			},
		},
		{
			name: "complex nested patterns",
			includes: []string{
				"src/**/*.{js,ts}",
				"**/package.json",
				"config/**/*.yaml",
			},
			excludes: []string{
				"src/test/**",
				"**/*.spec.*",
				"**/vendor/**",
			},
			paths: map[string]bool{
				"src/app.js":                true,
				"src/lib/util.ts":           true,
				"src/test/helper.js":        false,
				"src/components/button.ts":  true,
				"src/button.spec.js":        false,
				"src/vendor/lib.js":         false,
				"package.json":              true,
				"nested/package.json":       true,
				"config/app.yaml":           true,
				"config/nested/db.yaml":     true,
				"src/vendor/nested/util.ts": false,
			},
		},
		{
			name:     "empty patterns",
			includes: []string{},
			excludes: []string{},
			paths: map[string]bool{
				"foo.js":     false,
				"nested/bar": false, // note: no file extension so likely no match
			},
		},
		{
			name:     "root files only",
			includes: []string{"*.js"},
			excludes: []string{},
			paths: map[string]bool{
				"foo.js":        true,
				"nested/foo.js": false,
			},
		},
		{
			name:     "nested exclusions with includes",
			includes: []string{"**/*.js"},
			excludes: []string{"a/**/b/**/c/**"},
			paths: map[string]bool{
				"a/b/c/foo.js":     false,
				"a/x/b/y/c/foo.js": false,
				"a/x/foo.js":       true,
				"b/c/foo.js":       true,
			},
		},
		{
			name:     "overlapping patterns with different extensions",
			includes: []string{"src/**/*.{js,ts}", "src/**/*.test.*"},
			excludes: []string{"src/**/*.spec.*"},
			paths: map[string]bool{
				"src/foo.js":           true,
				"src/foo.ts":           true,
				"src/foo.test.js":      true,
				"src/foo.test.ts":      true,
				"src/foo.spec.js":      false,
				"src/foo.spec.ts":      false,
				"src/foo.test.spec":    true,
				"src/foo.test.spec.js": false,
			},
		},
		{
			name:     "include everything with **",
			includes: []string{"**"},
			excludes: []string{},
			paths: map[string]bool{
				"a.txt":         true,
				"dir/b.txt":     true,
				"dir/sub/c.txt": true,
			},
		},
		{
			name:     "exclude hidden files (starting with a dot)",
			includes: []string{"**"},
			excludes: []string{"**/.*"},
			paths: map[string]bool{
				"a.txt":           true,
				".hidden":         false,
				"dir/.hidden2":    false,
				"dir/visible.txt": true,
			},
		},
		{
			name:     "nested brace expansion in directories",
			includes: []string{"src/{a,b}/**/{c,d}.ext"},
			excludes: []string{},
			paths: map[string]bool{
				"src/a/x/c.ext": true,
				"src/a/y/d.ext": true,
				"src/b/z/c.ext": true,
				"src/b/z/d.ext": true,
				"src/a/x/e.ext": false, // does not match c or d
				"src/c/x/c.ext": false, // directory "c" is not in {a,b}
			},
		},
		{
			name:     "multiple consecutive wildcards",
			includes: []string{"**/**/*.txt"},
			excludes: []string{},
			paths: map[string]bool{
				"a.txt":         true,
				"dir/b.txt":     true,
				"dir/sub/c.txt": true,
				"a/b/c/d.txt":   true,
				"a/b/c/d.jpg":   false,
			},
		},
		{
			name:     "character class matching",
			includes: []string{"file[0-9].txt"},
			excludes: []string{},
			paths: map[string]bool{
				"file1.txt":  true,
				"file9.txt":  true,
				"file10.txt": false,
				"filea.txt":  false,
			},
		},
		{
			name:     "exact match with no wildcards",
			includes: []string{"src/exact.js"},
			excludes: []string{},
			paths: map[string]bool{
				"src/exact.js":        true,
				"src/exact.jsx":       false,
				"src/exact.js.backup": false,
			},
		},
		{
			name:     "single-level directory wildcard",
			includes: []string{"src/*/foo.js"},
			excludes: []string{},
			paths: map[string]bool{
				"src/a/foo.js":   true,
				"src/b/foo.js":   true,
				"src/a/b/foo.js": false,
			},
		},
		{
			name:     "overlapping include and exclude (all .log files)",
			includes: []string{"logs/**/*.log"},
			excludes: []string{"logs/**/*.log"},
			paths: map[string]bool{
				"logs/a.log":     false,
				"logs/sub/b.log": false,
			},
		},
		{
			name:     "include .txt files but exclude those starting with 'secret'",
			includes: []string{"**/*.txt"},
			excludes: []string{"**/secret*.txt"},
			paths: map[string]bool{
				"a.txt":               true,
				"dir/b.txt":           true,
				"dir/secret.txt":      false,
				"dir/secret_data.txt": false,
			},
		},
		{
			name:     "brace expansion in the middle of path",
			includes: []string{"src/{components,routes}/**/*.{ts,tsx,gql}"},
			excludes: []string{},
			paths: map[string]bool{
				"src/components/foo.ts":  true,
				"src/components/bar.tsx": true,
				"src/components/baz.gql": true,
				"src/routes/home.ts":     true,
				"src/routes/api.gql":     true,
				"src/routes/bar.jsx":     false, // wrong extension
				"src/utils/foo.ts":       false, // wrong directory
				"src/components/foo.js":  false, // wrong extension
			},
		},
	}

	for _, tt := range tests {
		tt := tt // capture range variable
		t.Run(tt.name, func(t *testing.T) {
			memFs := afero.NewMemMapFs()
			root := "/project"
			createTestFiles(t, memFs, root, tt.paths)

			walker := NewWalker()
			for _, inc := range tt.includes {
				walker.AddInclude(inc)
			}
			for _, exc := range tt.excludes {
				walker.AddExclude(exc)
			}

			visited := collectVisitedFiles(t, walker, memFs, root)
			for path, expected := range tt.paths {
				if _, ok := visited.Load(path); ok != expected {
					t.Errorf("file %q: got visited=%v, expected %v", path, ok, expected)
				}
			}
		})
	}
}
