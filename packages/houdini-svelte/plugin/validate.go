package plugin

import (
	"context"
	"fmt"
	"strings"

	"code.houdinigraphql.com/plugins"
)

func (p *HoudiniSvelte) Validate(ctx context.Context) error {
	// check the project structure for files the session relies on. these are
	// warnings only: the session is silently dropped without them but the build
	// is still valid
	if warnings, err := p.sessionLayoutWarnings(ctx); err == nil && len(warnings) > 0 {
		if logger, err := p.DB.Logger(ctx); err == nil {
			for _, warning := range warnings {
				logger.Warn("[houdini-svelte] warning: %s", warning)
			}
		}
	}

	forbiddenNames := []string{
		"Query",
		"Mutation",
		"Subscription",
		"Fragment",
		"Base",
	}

	// we need to look for any documents that are using these names
	placeholders := []string{}
	for range forbiddenNames {
		placeholders = append(placeholders, "?")
	}

	// grab a connection from the pool
	conn, err := p.DB.Take(ctx)
	if err != nil {
		return err
	}
	defer p.DB.Put(conn)

	// look for any documents with these names
	query, err := conn.Prepare(fmt.Sprintf(`
		SELECT name, filepath 
		FROM documents 
			JOIN raw_documents ON documents.raw_document = raw_documents.id
		WHERE name IN (%s)
	`, strings.Join(placeholders, ",")))
	if err != nil {
		return err
	}
	defer query.Finalize()
	for i, name := range forbiddenNames {
		query.BindText(i+1, name)
	}

	errs := &plugins.ErrorList{}

	err = p.DB.StepStatement(ctx, query, func() {
		name := query.GetText("name")
		filepath := query.GetText("filepath")

		errs.Append(&plugins.Error{
			Message: fmt.Sprintf(
				`Operation name (%s) is forbidden since it conflicts with Houdini's runtime. Please rename the operation to something else`,
				name,
			),
			Kind: plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{
				{Filepath: filepath},
			},
		})
	})
	if err != nil {
		return err
	}

	if errs.Len() > 0 {
		return errs
	}

	// we"re done
	return nil
}
