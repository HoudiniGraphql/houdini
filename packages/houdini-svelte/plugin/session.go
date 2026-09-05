package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/spf13/afero"

	"code.houdinigraphql.com/packages/houdini-svelte/plugin/config"
)

// the session set in hooks.server.{js,ts} only reaches the application through code
// that houdini injects into the project's root layout files: +layout.server.{js,ts}
// moves the session from event.locals into the layout data (so every load can read it)
// and +layout.svelte keeps the client-side session in sync (so client-side fetches and
// mutations include it). Houdini transforms those files when they exist but never
// creates them, so a project that calls setSession without them silently drops the
// session. SessionLayoutWarnings returns a warning message for each missing file.
func SessionLayoutWarnings(
	fs afero.Fs,
	projectRoot string,
	pluginConfig config.PluginConfig,
) []string {
	// the session infrastructure only exists in kit projects that haven't opted out
	if pluginConfig.Framework == config.PluginFrameworkSvelte || pluginConfig.Static {
		return nil
	}

	// find the project's server hooks file (if there isn't one, the session is never set)
	hooksPath := ""
	for _, candidate := range []string{"hooks.server.ts", "hooks.server.js"} {
		fp := filepath.Join(projectRoot, "src", candidate)
		if exists, _ := afero.Exists(fs, fp); exists {
			hooksPath = fp
			break
		}
	}
	if hooksPath == "" {
		return nil
	}

	// the session is only in use if the hooks file calls setSession
	content, err := afero.ReadFile(fs, hooksPath)
	if err != nil || !strings.Contains(string(content), "setSession") {
		return nil
	}

	// reference the hooks file the way the user knows it (relative to the project root)
	relHooks := hooksPath
	if rel, err := filepath.Rel(projectRoot, hooksPath); err == nil {
		relHooks = filepath.ToSlash(rel)
	}

	warnings := []string{}

	// +layout.server.{js,ts} carries the session from event.locals into the layout data
	layoutServerExists := false
	for _, candidate := range []string{"+layout.server.js", "+layout.server.ts"} {
		fp := filepath.Join(projectRoot, "src", "routes", candidate)
		if exists, _ := afero.Exists(fs, fp); exists {
			layoutServerExists = true
			break
		}
	}
	if !layoutServerExists {
		warnings = append(warnings, fmt.Sprintf(
			"%s calls setSession but src/routes/+layout.server.js (or .ts) does not exist: Houdini passes the session to your routes through this file's load function, so without it the session is silently dropped. Create the file (it can be empty) to fix this. For more information: https://houdinigraphql.com/svelte/guides/authentication",
			relHooks,
		))
	}

	// +layout.svelte keeps the client-side session up to date
	layoutSveltePath := filepath.Join(projectRoot, "src", "routes", "+layout.svelte")
	if exists, _ := afero.Exists(fs, layoutSveltePath); !exists {
		warnings = append(warnings, fmt.Sprintf(
			"%s calls setSession but src/routes/+layout.svelte does not exist: Houdini keeps the client-side session up to date through this component, so client-side fetches and mutations will not include your session. Create the file to fix this. For more information: https://houdinigraphql.com/svelte/guides/authentication",
			relHooks,
		))
	}

	return warnings
}

// sessionLayoutWarnings resolves the plugin's config and filesystem and delegates to
// SessionLayoutWarnings
func (p *HoudiniSvelte) sessionLayoutWarnings(ctx context.Context) ([]string, error) {
	// load the plugin config straight from the database: DB.PluginConfig panics when
	// the plugin row is missing (which happens in test harnesses), so read the row
	// ourselves and skip the check when there isn't one
	conn, err := p.DB.Take(ctx)
	if err != nil {
		return nil, err
	}
	defer p.DB.Put(conn)

	stmt, err := conn.Prepare(`SELECT config FROM plugins WHERE name = ?1`)
	if err != nil {
		return nil, err
	}
	defer stmt.Finalize()
	stmt.BindText(1, p.Name())

	hasRow, err := stmt.Step()
	if err != nil {
		return nil, err
	}
	if !hasRow {
		return nil, nil
	}

	pluginConfig := config.PluginConfig{}
	if err := json.Unmarshal([]byte(stmt.GetText("config")), &pluginConfig); err != nil {
		return nil, err
	}

	projectConfig, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return nil, err
	}

	return SessionLayoutWarnings(p.Fs, projectConfig.ProjectRoot, pluginConfig), nil
}
