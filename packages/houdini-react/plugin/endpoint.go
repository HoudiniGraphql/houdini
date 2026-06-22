package plugin

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	houdiniSchema "code.houdinigraphql.com/packages/houdini-core/plugin/schema"
	"code.houdinigraphql.com/plugins"
)

// endpointDirective marks a mutation so the compiler generates a server endpoint that
// accepts a native (form-encoded) POST and redirects per the PRG pattern — the no-JS
// half of a progressively-enhanced form. It currently lives in houdini-react because
// only the React router consumes it, but nothing about the directive or its validation
// is React-specific; it is expected to move to the shared layer once the router does.
const endpointDirective = "endpoint"

// Schema registers the directives this plugin owns. We reuse the core schema-insert
// statements so the directive lands in the same tables every other internal directive
// uses; the inserts are idempotent upserts, so running this alongside the core schema
// hook is safe.
func (p *HoudiniReact) Schema(ctx context.Context) error {
	conn, err := p.DB.Take(ctx)
	if err != nil {
		return err
	}
	defer p.DB.Put(conn)

	statements, finalize := houdiniSchema.PrepareSchemaInsertStatements(conn)
	defer finalize()

	closeTx := p.DB.Transaction(conn)
	commit := func(err error) error {
		closeTx(&err)
		return err
	}

	// @endpoint(redirect: String, id: String) on MUTATION
	err = p.DB.ExecStatement(statements.InsertInternalDirective, map[string]any{
		"name":        endpointDirective,
		"description": "@endpoint generates a server endpoint for a mutation that accepts a native form POST and redirects, enabling progressively-enhanced forms.",
		"visible":     true,
	})
	if err != nil {
		return commit(err)
	}
	err = p.DB.ExecStatement(statements.InsertDirectiveLocation, map[string]any{
		"directive": endpointDirective,
		"location":  "MUTATION",
	})
	if err != nil {
		return commit(err)
	}
	err = p.DB.ExecStatement(statements.InsertDirectiveArgument, map[string]any{
		"directive": endpointDirective,
		"name":      "redirect",
		"type":      "String",
	})
	if err != nil {
		return commit(err)
	}
	err = p.DB.ExecStatement(statements.InsertDirectiveArgument, map[string]any{
		"directive": endpointDirective,
		"name":      "id",
		"type":      "String",
	})
	if err != nil {
		return commit(err)
	}

	return commit(nil)
}

// redirectInterpolation matches a `{ path.to.field }` template segment in a
// @endpoint(redirect:) value, capturing the dotted path between the braces.
var redirectInterpolation = regexp.MustCompile(`\{\s*([^}]*?)\s*\}`)

// endpoint collects everything we need to validate a single @endpoint usage.
type endpoint struct {
	documentID  int
	docKind     string
	docName     string
	filepath    string
	row         int
	column      int
	redirect    string
	hasRedirect bool
}

// validateEndpoint enforces the build-time guarantees for @endpoint:
//   - it only sits on mutation documents
//   - its redirect (when present) is a relative path, which is what closes
//     open-redirect at build time
//   - every redirect interpolation path resolves to a leaf scalar in the
//     mutation's selection set, so we can never emit /users/undefined
func (p *HoudiniReact) validateEndpoint(ctx context.Context, errs *plugins.ErrorList) {
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
		WHERE dd.directive = $mutation_form_directive
			AND (rd.current_task = $task_id OR $task_id IS NULL)
	`

	forms := []endpoint{}
	err := p.DB.StepQuery(ctx, query, map[string]any{
		"mutation_form_directive": endpointDirective,
	}, func(row plugins.Row) {
		f := endpoint{
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
			f.hasRedirect = true
			f.redirect = row.ColumnText(7)
		}
		forms = append(forms, f)
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}

	for _, form := range forms {
		location := []*plugins.ErrorLocation{{
			Filepath: form.filepath,
			Line:     form.row,
			Column:   form.column,
		}}

		// @endpoint describes a form that runs a mutation; it is meaningless on a
		// query or fragment. flag it and move on — the redirect checks below assume a
		// mutation selection set.
		if form.docKind != "mutation" {
			errs.Append(&plugins.Error{
				Message: fmt.Sprintf(
					"@%s can only be used on a mutation, but %q is a %s",
					endpointDirective, form.docName, form.docKind,
				),
				Kind:      plugins.ErrorKindValidation,
				Locations: location,
			})
			continue
		}

		if !form.hasRedirect {
			continue
		}

		// the redirect has to be a relative path. rejecting anything with a scheme or a
		// protocol-relative prefix is what closes open-redirect at build time.
		if !isRelativePath(form.redirect) {
			errs.Append(&plugins.Error{
				Message: fmt.Sprintf(
					"@%s redirect %q must be a relative path (start with a single '/', no scheme or '//')",
					endpointDirective, form.redirect,
				),
				Kind:      plugins.ErrorKindValidation,
				Locations: location,
			})
			// keep going — the interpolation paths are still worth validating
		}

		// every { path } in the redirect must resolve to a leaf scalar in the
		// mutation's selection set so the runtime/server can interpolate it.
		paths := redirectInterpolationPaths(form.redirect)
		if len(paths) == 0 {
			continue
		}
		p.validateRedirectPaths(ctx, form, paths, location, errs)
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

// redirectInterpolationPaths extracts the dotted paths from a redirect template,
// e.g. "/users/{ createUser.id }" → [["createUser", "id"]]. Empty interpolations are
// skipped.
func redirectInterpolationPaths(redirect string) [][]string {
	matches := redirectInterpolation.FindAllStringSubmatch(redirect, -1)
	paths := make([][]string, 0, len(matches))
	for _, match := range matches {
		raw := strings.TrimSpace(match[1])
		if raw == "" {
			continue
		}
		segments := strings.Split(raw, ".")
		for i := range segments {
			segments[i] = strings.TrimSpace(segments[i])
		}
		paths = append(paths, segments)
	}
	return paths
}

// selectionNode is a field in a document's selection set, indexed by the name it
// appears under in the response (its alias, or field name when unaliased).
type selectionNode struct {
	id       int
	typeKind string // OBJECT / INTERFACE / UNION / SCALAR / ENUM ...
}

// validateRedirectPaths walks each interpolation path through the mutation's selection
// tree and reports any segment that doesn't exist or doesn't resolve to a leaf scalar.
func (p *HoudiniReact) validateRedirectPaths(
	ctx context.Context,
	form endpoint,
	paths [][]string,
	location []*plugins.ErrorLocation,
	errs *plugins.ErrorList,
) {
	// load the document's field selections, indexed by parent selection id (0 = root).
	// only fields can be referenced by a redirect path; fragment spreads are out of
	// scope for v1 forms.
	children := map[int]map[string]selectionNode{}
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
	err := p.DB.StepQuery(ctx, query, map[string]any{
		"document_id": form.documentID,
	}, func(row plugins.Row) {
		parent := int(row.ColumnInt(0))
		name := row.ColumnText(2)
		if children[parent] == nil {
			children[parent] = map[string]selectionNode{}
		}
		children[parent][name] = selectionNode{
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
		var node selectionNode
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
					endpointDirective, display, form.docName,
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
					endpointDirective, display, form.docName, node.typeKind,
				),
				Kind:      plugins.ErrorKindValidation,
				Locations: location,
			})
		}
	}
}
