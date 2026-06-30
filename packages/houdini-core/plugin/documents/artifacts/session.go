package artifacts

import (
	"fmt"
	"strconv"

	"code.houdinigraphql.com/packages/houdini-core/plugin/documents/collected"
	"code.houdinigraphql.com/plugins/graphql"
)

// buildSessionArtifact returns the top-level `"sessionPath"` (and `"sessionMerge"` when set)
// entry for a document's compiled artifact when the mutation carries @session, or "" otherwise.
// Independent of @endpoint: the path is the static marker the runtime hook and the server's
// session-mint plugin / form handler use to find the subtree of the result that writes the
// session; merge distinguishes a replace from an upsert.
func buildSessionArtifact(doc *collected.Document) string {
	var directive *collected.Directive
	for _, d := range doc.Directives {
		if d.Name == graphql.SessionDirective {
			directive = d
			break
		}
	}
	if directive == nil {
		return ""
	}

	path := ""
	merge := false
	for _, arg := range directive.Arguments {
		if arg.Value == nil {
			continue
		}
		switch arg.Name {
		case "path":
			path = arg.Value.Raw
		case "merge":
			merge = arg.Value.Raw == "true"
		}
	}
	if path == "" {
		return ""
	}

	out := fmt.Sprintf(`

    "sessionPath": %s,`, strconv.Quote(path))
	if merge {
		out += `
    "sessionMerge": true,`
	}
	return out
}
