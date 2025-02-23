package runtimeScalars

import (
	"context"
	"fmt"

	"code.houdinigraphql.com/packages/houdini-core/plugin/schema"
	"code.houdinigraphql.com/plugins"
	"zombiezen.com/go/sqlite"
	"zombiezen.com/go/sqlite/sqlitex"
)

// we need to replace runtime scalars with their static equivalents and add the runtime scalar directive
func TransformVariables[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], conn *sqlite.Conn, errs *plugins.ErrorList) {
	// load the project configuration
	projectConfig, err := db.ProjectConfig(ctx)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}

	// wrap the operations in a transaction
	close := sqlitex.Transaction(conn)
	commit := func(err error) error {
		close(&err)
		return err
	}

	// we need a list of all the runtime scalars
	runtimeScalars := ""
	for scalar := range projectConfig.RuntimeScalars {
		runtimeScalars += `'` + scalar + `',`
	}
	if runtimeScalars == "" {
		runtimeScalars = ","
	}

	// we need to look at every operation variable that has a runtime scalar for its type
	search, err := conn.Prepare(fmt.Sprintf(`
		SELECT
			id,
			type,
			row,
			column
		FROM document_variables WHERE type in (%s)
	`, runtimeScalars[:len(runtimeScalars)-1]))
	if err != nil {
		errs.Append(plugins.WrapError(err))
		commit(err)
		return
	}
	defer search.Finalize()

	// and a query to update the type of the variable
	updateType, err := conn.Prepare(`
		UPDATE document_variables SET type = $type WHERE id = $document
	`)
	if err != nil {
		errs.Append(plugins.WrapError(err))
		commit(err)
		return
	}
	defer updateType.Finalize()

	// and some statements to insert the runtime scalar directives
	insertDocumentVariableDirective, err := conn.Prepare("INSERT INTO document_variable_directives (parent, directive, row, column) VALUES ($parent, $directive, $row, $column)")
	if err != nil {
		errs.Append(plugins.WrapError(err))
		commit(err)
		return
	}
	defer insertDocumentVariableDirective.Finalize()
	// and scalar directive arguments
	insertDocumentVariableDirectiveArgument, err := conn.Prepare("INSERT INTO document_variable_directive_arguments (parent, name, value) VALUES ($parent, $name, $value)")
	if err != nil {
		errs.Append(plugins.WrapError(err))
		commit(err)
		return
	}
	defer insertDocumentVariableDirectiveArgument.Finalize()

	for {
		hasData, err := search.Step()
		if err != nil {
			errs.Append(plugins.WrapError(err))
			commit(err)
			return
		}
		if !hasData {
			break
		}

		// pull the query results out
		variablesID := search.ColumnInt(0)
		variableType := search.ColumnText(1)
		row := search.ColumnInt(2)
		column := search.ColumnInt(3)

		// we need to update the type of the variable
		err = db.ExecStatement(updateType, map[string]interface{}{
			"type":     projectConfig.RuntimeScalars[variableType],
			"document": variablesID,
		})
		if err != nil {
			errs.Append(plugins.WrapError(err))
			commit(err)
			return
		}

		// we also need to add a directive to the variable
		err = db.ExecStatement(insertDocumentVariableDirective, map[string]interface{}{
			"parent":    variablesID,
			"directive": schema.RuntimeScalarDirective,
			"row":       row,
			"column":    column,
		})
		if err != nil {
			errs.Append(plugins.WrapError(err))
			commit(err)
			return
		}
		directiveID := conn.LastInsertRowID()

		// and the arguments to the directive
		err = db.ExecStatement(insertDocumentVariableDirectiveArgument, map[string]interface{}{
			"parent": directiveID,
			"name":   "type",
			"value":  variableType,
		})
		if err != nil {
			errs.Append(plugins.WrapError(err))
			commit(err)
			return
		}
	}

	// we're done (commit the transaction)
	commit(nil)
}
