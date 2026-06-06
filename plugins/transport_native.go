//go:build !wasip1

package plugins

// transportMode defaults to "websocket" on native builds. run.go overrides
// this to "stdio" when the --transport=stdio flag is passed. Defaulting to
// "websocket" means tests (which never parse flags) use the DB-query path
// instead of StdioInvoke, so TriggerHook* returns immediately when no
// plugins are registered.
var transportMode = "websocket"

// pluginKey is set by --plugin-key on native builds; empty on wasip1.
var pluginKey = ""

// cmp returns a if non-empty, otherwise b.
func cmp(a, b string) string {
	if a != "" {
		return a
	}
	return b
}
