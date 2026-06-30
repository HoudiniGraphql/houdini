package documents

import (
	"context"
	"fmt"
	"strings"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins"
	"code.houdinigraphql.com/plugins/graphql"
)

// sessionUsage collects what we need to validate a single @session usage.
type sessionUsage struct {
	documentID  int
	docKind     string
	docName     string
	filepath    string
	row         int
	column      int
	sessionPath string
	hasPath     bool
}

// ValidateSessionDirective enforces the build-time guarantees for @session, the directive
// that writes the session from a mutation result (orthogonal to @endpoint's form story):
//   - it only sits on mutation documents
//   - it carries a `path`, which must resolve to an object in the mutation's selection set —
//     that object's fields become App.Session
func ValidateSessionDirective(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	errs *plugins.ErrorList,
) {
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
			LEFT JOIN document_directive_arguments dda ON dda.parent = dd.id AND dda.name = 'path'
			LEFT JOIN argument_values av ON av.id = dda.value
		WHERE dd.directive = $session_directive
			AND (rd.current_task = $task_id OR $task_id IS NULL)
	`

	usages := []sessionUsage{}
	err := db.StepQuery(ctx, query, map[string]any{
		"session_directive": graphql.SessionDirective,
	}, func(row plugins.Row) {
		usage := sessionUsage{
			documentID: int(row.ColumnInt(0)),
			docKind:    row.ColumnText(1),
			docName:    row.ColumnText(2),
			filepath:   row.ColumnText(3),
			row:        int(row.ColumnInt(4)),
			column:     int(row.ColumnInt(5)),
		}
		if row.ColumnText(6) == "String" {
			usage.hasPath = true
			usage.sessionPath = row.ColumnText(7)
		}
		usages = append(usages, usage)
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}

	// bulk-load the field selections of every @session document in one pass, indexed by
	// document then parent selection id (0 = root) — the same shape the endpoint validator uses.
	selectionsByDocument := map[int]map[int]map[string]endpointSelectionNode{}
	err = db.StepQuery(ctx, `
		SELECT
			sr.document,
			COALESCE(sr.parent_id, 0) AS parent,
			s.id,
			COALESCE(s.alias, s.field_name) AS name,
			t.kind AS type_kind
		FROM selection_refs sr
			JOIN selections s ON s.id = sr.child_id
			JOIN document_directives dd ON dd.document = sr.document AND dd.directive = $session_directive
			LEFT JOIN type_fields tf ON s.type = tf.id
			LEFT JOIN types t ON tf.type = t.name
		WHERE s.kind = 'field'
	`, map[string]any{"session_directive": graphql.SessionDirective}, func(row plugins.Row) {
		document := int(row.ColumnInt(0))
		parent := int(row.ColumnInt(1))
		name := row.ColumnText(3)
		if selectionsByDocument[document] == nil {
			selectionsByDocument[document] = map[int]map[string]endpointSelectionNode{}
		}
		if selectionsByDocument[document][parent] == nil {
			selectionsByDocument[document][parent] = map[string]endpointSelectionNode{}
		}
		selectionsByDocument[document][parent][name] = endpointSelectionNode{
			id:       int(row.ColumnInt(2)),
			typeKind: row.ColumnText(4),
		}
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

		// @session writes the session from a mutation result; it is meaningless elsewhere.
		if usage.docKind != "mutation" {
			errs.Append(&plugins.Error{
				Message: fmt.Sprintf(
					"@%s can only be used on a mutation, but %q is a %s",
					graphql.SessionDirective, usage.docName, usage.docKind,
				),
				Kind:      plugins.ErrorKindValidation,
				Locations: location,
			})
			continue
		}

		// path is what makes @session meaningful — without it nothing becomes the session.
		if !usage.hasPath {
			errs.Append(&plugins.Error{
				Message: fmt.Sprintf(
					"@%s on %q requires a path naming the result field to write to the session",
					graphql.SessionDirective, usage.docName,
				),
				Kind:      plugins.ErrorKindValidation,
				Locations: location,
			})
			continue
		}

		validateSessionPath(usage, selectionsByDocument[usage.documentID], location, errs)
	}
}

// validateSessionPath walks the dotted @session path through the mutation's selection tree
// and reports if it doesn't exist or doesn't resolve to an object — its fields become the
// session, so (unlike a redirect path) it must NOT be a leaf scalar.
func validateSessionPath(
	usage sessionUsage,
	children map[int]map[string]endpointSelectionNode,
	location []*plugins.ErrorLocation,
	errs *plugins.ErrorList,
) {
	segments := strings.Split(usage.sessionPath, ".")
	parent := 0
	ok := true
	var node endpointSelectionNode
	for _, segment := range segments {
		segment = strings.TrimSpace(segment)
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
				"@%s path %q does not exist in the selection set of %q",
				graphql.SessionDirective, display, usage.docName,
			),
			Kind:      plugins.ErrorKindValidation,
			Locations: location,
		})
		return
	}

	if node.typeKind != "OBJECT" && node.typeKind != "INTERFACE" && node.typeKind != "UNION" {
		errs.Append(&plugins.Error{
			Message: fmt.Sprintf(
				"@%s path %q in %q must resolve to an object whose fields become the session, but it is a %s",
				graphql.SessionDirective, display, usage.docName, node.typeKind,
			),
			Kind:      plugins.ErrorKindValidation,
			Locations: location,
		})
	}
}
