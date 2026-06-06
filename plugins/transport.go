//go:build wasip1

package plugins

// wasip1 always uses stdio — no flag parsing occurs in the WASM runtime.
var transportMode = "stdio"

// pluginKey is unused on wasip1.
var pluginKey = ""

// cmp returns a if non-empty, otherwise b.
func cmp(a, b string) string {
	if a != "" {
		return a
	}
	return b
}
