package documents

import (
	"context"
	"fmt"
	"strings"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/graphql"
)

// endpointUsage collects everything we need to validate a single @endpoint usage.
type endpointUsage struct {
	documentID  int
	docKind     string
	docName     string
	filepath    string
	row         int
	column      int
	redirect    string
	hasRedirect bool
}

// ValidateEndpointDirective enforces the build-time guarantees for @endpoint:
//   - it only sits on mutation documents
//   - its redirect (when present) is a relative path, which is what closes
//     open-redirect at build time
//   - every redirect interpolation path resolves to a leaf scalar in the
//     mutation's selection set, so we can never emit /users/undefined
func ValidateEndpointDirective(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	errs *plugins.ErrorList,
) {
	// gather every @endpoint usage along with its document and redirect value.
	// the redirect arg is optional (no redirect → PRG back to the page), so we LEFT
	// JOIN it; av.kind is empty when the argument is absent.
	query := `
		SELECT
			d.id,
			d.kind,
			d.name,
			rd.filepath,
			dd.row,
			dd.column,
			av.kind,
			av.raw
		FROM document_directives dd
			JOIN documents d ON d.id = dd.document
			JOIN raw_documents rd ON rd.id = d.raw_document
			LEFT JOIN document_directive_arguments dda ON dda.parent = dd.id AND dda.name = 'redirect'
			LEFT JOIN argument_values av ON av.id = dda.value
		WHERE dd.directive = $endpoint_directive
			AND (rd.current_task = $task_id OR $task_id IS NULL)
	`

	usages := []endpointUsage{}
	err := db.StepQuery(ctx, query, map[string]any{
		"endpoint_directive": graphql.EndpointDirective,
	}, func(row plugins.Row) {
		usage := endpointUsage{
			documentID: int(row.ColumnInt(0)),
			docKind:    row.ColumnText(1),
			docName:    row.ColumnText(2),
			filepath:   row.ColumnText(3),
			row:        int(row.ColumnInt(4)),
			column:     int(row.ColumnInt(5)),
		}
		// only treat the redirect as present when it was supplied as a string literal.
		// a non-string value is a type error that core's argument validation reports.
		if row.ColumnText(6) == "String" {
			usage.hasRedirect = true
			usage.redirect = row.ColumnText(7)
		}
		usages = append(usages, usage)
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}

	for _, usage := range usages {
		location := []*plugins.ErrorLocation{{
			Filepath: usage.filepath,
			Line:     usage.row,
			Column:   usage.column,
		}}

		// @endpoint describes a form that runs a mutation; it is meaningless on a
		// query or fragment. flag it and move on — the redirect checks below assume a
		// mutation selection set.
		if usage.docKind != "mutation" {
			errs.Append(&plugins.Error{
				Message: fmt.Sprintf(
					"@%s can only be used on a mutation, but %q is a %s",
					graphql.EndpointDirective, usage.docName, usage.docKind,
				),
				Kind:      plugins.ErrorKindValidation,
				Locations: location,
			})
			continue
		}

		if !usage.hasRedirect {
			continue
		}

		// the redirect has to be a relative path. rejecting anything with a scheme or a
		// protocol-relative prefix is what closes open-redirect at build time.
		if !isRelativePath(usage.redirect) {
			errs.Append(&plugins.Error{
				Message: fmt.Sprintf(
					"@%s redirect %q must be a relative path (start with a single '/', no scheme or '//')",
					graphql.EndpointDirective, usage.redirect,
				),
				Kind:      plugins.ErrorKindValidation,
				Locations: location,
			})
			// keep going — the interpolation paths are still worth validating
		}

		// every { path } in the redirect must resolve to a leaf scalar in the
		// mutation's selection set so the runtime/server can interpolate it.
		paths := graphql.RedirectInterpolationPaths(usage.redirect)
		if len(paths) == 0 {
			continue
		}
		validateRedirectPaths(ctx, db, usage, paths, location, errs)
	}
}

// isRelativePath reports whether a redirect value is a safe relative path: a single
// leading slash, no protocol-relative "//" prefix, and no "scheme://".
func isRelativePath(value string) bool {
	if !strings.HasPrefix(value, "/") {
		return false
	}
	if strings.HasPrefix(value, "//") {
		return false
	}
	if strings.Contains(value, "://") {
		return false
	}
	return true
}

// endpointSelectionNode is a field in a document's selection set, indexed by the name it
// appears under in the response (its alias, or field name when unaliased).
type endpointSelectionNode struct {
	id       int
	typeKind string // OBJECT / INTERFACE / UNION / SCALAR / ENUM ...
}

// validateRedirectPaths walks each interpolation path through the mutation's selection
// tree and reports any segment that doesn't exist or doesn't resolve to a leaf scalar.
func validateRedirectPaths(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	usage endpointUsage,
	paths [][]string,
	location []*plugins.ErrorLocation,
	errs *plugins.ErrorList,
) {
	// load the document's field selections, indexed by parent selection id (0 = root).
	// only fields can be referenced by a redirect path; fragment spreads are out of
	// scope for v1 forms.
	children := map[int]map[string]endpointSelectionNode{}
	query := `
		SELECT
			COALESCE(sr.parent_id, 0) AS parent,
			s.id,
			COALESCE(s.alias, s.field_name) AS name,
			t.kind AS type_kind
		FROM selection_refs sr
			JOIN selections s ON s.id = sr.child_id
			LEFT JOIN type_fields tf ON s.type = tf.id
			LEFT JOIN types t ON tf.type = t.name
		WHERE sr.document = $document_id
			AND s.kind = 'field'
	`
	err := db.StepQuery(ctx, query, map[string]any{
		"document_id": usage.documentID,
	}, func(row plugins.Row) {
		parent := int(row.ColumnInt(0))
		name := row.ColumnText(2)
		if children[parent] == nil {
			children[parent] = map[string]endpointSelectionNode{}
		}
		children[parent][name] = endpointSelectionNode{
			id:       int(row.ColumnInt(1)),
			typeKind: row.ColumnText(3),
		}
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}

	for _, segments := range paths {
		parent := 0
		ok := true
		var node endpointSelectionNode
		for _, segment := range segments {
			next, found := children[parent][segment]
			if !found {
				ok = false
				break
			}
			node = next
			parent = next.id
		}

		display := strings.Join(segments, ".")
		if !ok {
			errs.Append(&plugins.Error{
				Message: fmt.Sprintf(
					"@%s redirect path { %s } does not exist in the selection set of %q",
					graphql.EndpointDirective, display, usage.docName,
				),
				Kind:      plugins.ErrorKindValidation,
				Locations: location,
			})
			continue
		}

		if node.typeKind != "SCALAR" && node.typeKind != "ENUM" {
			errs.Append(&plugins.Error{
				Message: fmt.Sprintf(
					"@%s redirect path { %s } in %q must resolve to a leaf scalar, but it is a %s",
					graphql.EndpointDirective, display, usage.docName, node.typeKind,
				),
				Kind:      plugins.ErrorKindValidation,
				Locations: location,
			})
		}
	}
}
