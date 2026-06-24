package graphql

import (
	"regexp"
	"strings"
)

// redirectInterpolation matches a `{ path.to.field }` template segment in an
// @endpoint(redirect:) value, capturing the dotted path between the braces.
var redirectInterpolation = regexp.MustCompile(`\{\s*([^}]*?)\s*\}`)

// RedirectPart is one segment of a parsed @endpoint redirect template: either a
// literal string (Path == nil) or an interpolation path into the mutation result.
type RedirectPart struct {
	Literal string
	Path    []string
}

// ParseRedirectTemplate splits a redirect template into its literal and interpolation
// parts, e.g. "/users/{ createUser.id }" → [{Literal:"/users/"}, {Path:["createUser","id"]}].
// A degenerate empty interpolation (`{}` / `{ }`) is kept verbatim as a literal. This is
// the single source of truth shared by validation and artifact emission.
func ParseRedirectTemplate(template string) []RedirectPart {
	parts := []RedirectPart{}
	last := 0
	for _, m := range redirectInterpolation.FindAllStringSubmatchIndex(template, -1) {
		// m[0:1] is the full match, m[2:3] the captured path
		if m[0] > last {
			parts = append(parts, RedirectPart{Literal: template[last:m[0]]})
		}
		inner := strings.TrimSpace(template[m[2]:m[3]])
		if inner == "" {
			// nonsensical empty interpolation — preserve the raw braces as a literal
			parts = append(parts, RedirectPart{Literal: template[m[0]:m[1]]})
		} else {
			segments := strings.Split(inner, ".")
			for i := range segments {
				segments[i] = strings.TrimSpace(segments[i])
			}
			parts = append(parts, RedirectPart{Path: segments})
		}
		last = m[1]
	}
	if last < len(template) {
		parts = append(parts, RedirectPart{Literal: template[last:]})
	}
	return parts
}

// RedirectInterpolationPaths returns just the interpolation paths from a redirect
// template (the dotted field paths that must resolve against the mutation selection set).
func RedirectInterpolationPaths(template string) [][]string {
	parts := ParseRedirectTemplate(template)
	paths := make([][]string, 0, len(parts))
	for _, part := range parts {
		if part.Path != nil {
			paths = append(paths, part.Path)
		}
	}
	return paths
}
