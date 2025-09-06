package schema

import (
	"context"

	"github.com/spf13/afero"
	"zombiezen.com/go/sqlite"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins"
)

func GenerateDefinitionFiles(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	fs afero.Fs,
	sortKeys bool,
) error {
	// a query to look for enums that are defined
	enumSearch := `
    SELECT * FROM enum_values ON types where enum_values.parent = types.name
  `

	// collect all of the results
	type CollectedEnum struct {
		Name     string
		Internal bool
		Values   []string
	}

	err := db.StepQuery(ctx, enumSearch, map[string]any{}, func(q *sqlite.Stmt) {
	})
	if err != nil {
		return err
	}

	// we're done
	return nil
}
