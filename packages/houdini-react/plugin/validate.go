package plugin

import (
	"context"
	"fmt"

	"code.houdinigraphql.com/plugins"
)

// Validate enforces routing-specific invariants that the core GraphQL validation
// cannot know about.
//
// The router can only populate a route query's variables from the URL: required
// (non-null) variables must come from a route segment, while nullable variables may
// also be supplied via URLSearchParams (issue #1210) and are therefore allowed to be
// absent. A required variable that is neither a route segment nor defaulted can never
// be satisfied by navigation, so the query would fail at request time. We catch that
// here instead, mirroring the build-time guarantee users get for route params.
func (p *HoudiniReact) Validate(ctx context.Context) error {
	errs := &plugins.ErrorList{}

	// type_modifiers is stored inner→outer, so the outermost wrapper is the final
	// character: a trailing "!" means the variable is non-null (required). We also
	// skip variables with a default value since those are satisfiable without input.
	query := `
		SELECT
			d.name,
			rd.filepath,
			rd.offset_line,
			rd.offset_column,
			dv.name
		FROM documents d
			JOIN raw_documents rd ON rd.id = d.raw_document
			JOIN document_variables dv ON dv.document = d.id
		WHERE d.kind = 'query'
			AND (rd.filepath LIKE '%+page.gql' OR rd.filepath LIKE '%+layout.gql')
			AND dv.type_modifiers LIKE '%!'
			AND dv.default_value IS NULL
		ORDER BY d.name, dv.name
	`

	err := p.DB.StepQuery(ctx, query, nil, func(row plugins.Row) {
		docName := row.ColumnText(0)
		filepath := row.ColumnText(1)
		line := row.ColumnInt(2)
		column := row.ColumnInt(3)
		varName := row.ColumnText(4)

		// satisfied by a route segment — nothing to flag
		if routeParamSet(filepath)[varName] {
			return
		}

		errs.Append(&plugins.Error{
			Message: fmt.Sprintf(
				"required variable $%s on %q can't be provided by the router: "+
					"add a [%s] route segment, give it a default value, or make it nullable "+
					"so it can be supplied via search params",
				varName, docName, varName,
			),
			Kind: plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{{
				Filepath: filepath,
				Line:     line,
				Column:   column,
			}},
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}

	if errs.Len() > 0 {
		return errs
	}
	return nil
}
