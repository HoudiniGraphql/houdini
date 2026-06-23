package artifacts

import (
	"fmt"
	"strconv"

	"code.houdinigraphql.com/packages/houdini-core/plugin/documents/collected"
	"code.houdinigraphql.com/plugins/graphql"
)

// buildAuthArtifact returns the top-level `"sessionPath": "...",` entry for a document's
// compiled artifact when the mutation carries @auth, or "" otherwise. It is independent of
// @endpoint: the path is the static marker the runtime hook and the server's session-mint
// plugin / form handler use to find the subtree of the result that becomes App.Session.
func buildAuthArtifact(doc *collected.Document) string {
	var directive *collected.Directive
	for _, d := range doc.Directives {
		if d.Name == graphql.AuthDirective {
			directive = d
			break
		}
	}
	if directive == nil {
		return ""
	}

	path := ""
	for _, arg := range directive.Arguments {
		if arg.Value != nil && arg.Name == "sessionPath" {
			path = arg.Value.Raw
		}
	}
	if path == "" {
		return ""
	}

	return fmt.Sprintf(`

    "sessionPath": %s,`, strconv.Quote(path))
}
