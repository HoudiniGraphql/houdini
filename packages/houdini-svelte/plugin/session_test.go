package plugin_test

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-svelte/plugin"
	"code.houdinigraphql.com/packages/houdini-svelte/plugin/config"
	"code.houdinigraphql.com/plugins/tests"
)

const hooksWithSession = `
import { setSession } from '$houdini'

export const handle = async ({ event, resolve }) => {
	setSession(event, { user: { token: 'value' } })
	return await resolve(event)
}
`

const hooksWithoutSession = `
export const handle = async ({ event, resolve }) => {
	return await resolve(event)
}
`

func TestSessionLayoutWarnings(t *testing.T) {
	projectRoot := "/project"

	table := []struct {
		name   string
		files  map[string]string
		config config.PluginConfig
		// substrings that must each appear in exactly one warning, in order
		expected []string
	}{
		{
			name:     "no hooks file",
			files:    map[string]string{},
			expected: []string{},
		},
		{
			name: "hooks file without setSession",
			files: map[string]string{
				"src/hooks.server.ts": hooksWithoutSession,
			},
			expected: []string{},
		},
		{
			name: "setSession with both layout files",
			files: map[string]string{
				"src/hooks.server.ts":          hooksWithSession,
				"src/routes/+layout.server.ts": "",
				"src/routes/+layout.svelte":    "",
			},
			expected: []string{},
		},
		{
			name: "setSession with no layout files",
			files: map[string]string{
				"src/hooks.server.ts": hooksWithSession,
			},
			expected: []string{
				"src/routes/+layout.server.js (or .ts) does not exist",
				"src/routes/+layout.svelte does not exist",
			},
		},
		{
			name: "setSession missing only the server layout",
			files: map[string]string{
				"src/hooks.server.ts":       hooksWithSession,
				"src/routes/+layout.svelte": "",
			},
			expected: []string{
				"src/routes/+layout.server.js (or .ts) does not exist",
			},
		},
		{
			name: "setSession missing only the layout component",
			files: map[string]string{
				"src/hooks.server.ts":          hooksWithSession,
				"src/routes/+layout.server.js": "",
			},
			expected: []string{
				"src/routes/+layout.svelte does not exist",
			},
		},
		{
			name: "javascript hooks file is detected",
			files: map[string]string{
				"src/hooks.server.js": hooksWithSession,
			},
			expected: []string{
				"src/hooks.server.js calls setSession but src/routes/+layout.server.js",
				"src/hooks.server.js calls setSession but src/routes/+layout.svelte",
			},
		},
		{
			name: "static projects are skipped",
			files: map[string]string{
				"src/hooks.server.ts": hooksWithSession,
			},
			config:   config.PluginConfig{Static: true},
			expected: []string{},
		},
		{
			name: "non-kit projects are skipped",
			files: map[string]string{
				"src/hooks.server.ts": hooksWithSession,
			},
			config:   config.PluginConfig{Framework: config.PluginFrameworkSvelte},
			expected: []string{},
		},
	}

	for _, test := range table {
		t.Run(test.name, func(t *testing.T) {
			fs := afero.NewMemMapFs()
			for path, content := range test.files {
				fp := filepath.Join(projectRoot, filepath.FromSlash(path))
				require.NoError(t, fs.MkdirAll(filepath.Dir(fp), 0755))
				require.NoError(t, afero.WriteFile(fs, fp, []byte(content), 0644))
			}

			warnings := plugin.SessionLayoutWarnings(fs, projectRoot, test.config)

			require.Len(t, warnings, len(test.expected))
			for i, want := range test.expected {
				require.Contains(t, warnings[i], want)
			}
		})
	}
}

// the session check runs as part of Validate against the registered plugin config.
// warnings are printed, never returned, so a project with missing layout files still
// builds
func TestValidate_sessionWarningsDoNotFailTheBuild(t *testing.T) {
	tests.RunTable(t, tests.Table[config.PluginConfig, *plugin.HoudiniSvelte]{
		Schema: `type Query { hello: String }`,
		Plugin: tests.Plugin[config.PluginConfig]{
			Name: "houdini-svelte",
		},
		SetupTest: func(t *testing.T, p *plugin.HoudiniSvelte, test tests.Test[config.PluginConfig]) {
			// a hooks file that uses the session without any root layout files
			require.NoError(t, afero.WriteFile(
				p.Filesystem(),
				filepath.Join("/project", "src", "hooks.server.ts"),
				[]byte(hooksWithSession),
				0644,
			))
		},
		PerformTest: func(t *testing.T, p *plugin.HoudiniSvelte, test tests.Test[config.PluginConfig]) {
			require.NoError(t, p.Validate(context.Background()))
		},
		Tests: []tests.Test[config.PluginConfig]{
			{
				Name: "missing layout files warn but do not error",
				Pass: true,
				Input: []string{
					`query GetUser { hello }`,
				},
			},
		},
	})
}
