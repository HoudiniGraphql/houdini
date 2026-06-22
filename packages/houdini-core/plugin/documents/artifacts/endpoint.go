package artifacts

import (
	"fmt"
	"strconv"
	"strings"

	"code.houdinigraphql.com/packages/houdini-core/plugin/documents/collected"
	"code.houdinigraphql.com/plugins/graphql"
)

// uploadScalars are the conventional GraphQL scalar names for file uploads — "File" is
// Houdini's convention, "Upload" the graphql-multipart-request spec's. A mutation with a
// variable of either type gets a multipart form so the browser POSTs files natively.
var uploadScalars = map[string]bool{"File": true, "Upload": true}

// buildEndpointArtifact returns the `"endpoint": { ... },` block for a document's
// compiled artifact, or "" when the document has no @endpoint directive. The presence
// of the block is the static-analysis marker that a mutation is form-submittable; the
// fields inside are what the runtime and server form handler consume:
//
//   - "redirect" — the parsed template as a compact mixed array (literals are strings,
//     interpolation paths are nested arrays), so both paths interpolate it identically.
//   - "multipart" — true when any variable is Upload-typed (so the form sets enctype).
//   - "id" — the explicit @endpoint(id:) form id, when given.
func buildEndpointArtifact(doc *collected.Document) string {
	var directive *collected.Directive
	for _, d := range doc.Directives {
		if d.Name == graphql.EndpointDirective {
			directive = d
			break
		}
	}
	if directive == nil {
		return ""
	}

	redirect := ""
	hasRedirect := false
	id := ""
	hasID := false
	for _, arg := range directive.Arguments {
		if arg.Value == nil {
			continue
		}
		switch arg.Name {
		case "redirect":
			redirect = arg.Value.Raw
			hasRedirect = true
		case "id":
			id = arg.Value.Raw
			hasID = true
		}
	}

	var fields strings.Builder
	if hasRedirect {
		fmt.Fprintf(&fields, `
        "redirect": %s,`, serializeRedirectTemplate(redirect))
	}
	if documentHasUpload(doc) {
		fields.WriteString(`
        "multipart": true,`)
	}
	if hasID {
		fmt.Fprintf(&fields, `
        "id": %s,`, strconv.Quote(id))
	}

	return fmt.Sprintf(`

    "endpoint": {%s
    },`, fields.String())
}

// documentHasUpload reports whether any of the document's variables is a file-upload
// scalar (regardless of list/non-null wrappers — variable.Type holds the base type name).
func documentHasUpload(doc *collected.Document) bool {
	for _, variable := range doc.Variables {
		if uploadScalars[variable.Type] {
			return true
		}
	}
	return false
}

// serializeRedirectTemplate renders a parsed redirect template as the compact mixed
// array used in the artifact: literal segments are quoted strings, interpolation paths
// are nested arrays of quoted segments. e.g. "/users/{ createUser.id }" →
// ["/users/", ["createUser", "id"]].
func serializeRedirectTemplate(template string) string {
	var b strings.Builder
	b.WriteString("[")
	for i, part := range graphql.ParseRedirectTemplate(template) {
		if i > 0 {
			b.WriteString(", ")
		}
		if part.Path != nil {
			b.WriteString("[")
			for j, segment := range part.Path {
				if j > 0 {
					b.WriteString(", ")
				}
				b.WriteString(strconv.Quote(segment))
			}
			b.WriteString("]")
		} else {
			b.WriteString(strconv.Quote(part.Literal))
		}
	}
	b.WriteString("]")
	return b.String()
}
