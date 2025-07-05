package componentFields

import (
	"context"
	"encoding/json"

	"code.houdinigraphql.com/packages/houdini-core/plugin/schema"
	"code.houdinigraphql.com/plugins"
)

func TransformFields[PluginConfig any](
	ctx context.Context,
	db plugins.DatabasePool[PluginConfig],
) error {
	// grab a connection to prepare some statements
	conn, err := db.Take(ctx)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer db.Put(conn)

	// an update to convert the selection to a fragment spread
	convertToSpread, err := conn.Prepare(`
    UPDATE selections 
    SET kind = 'fragment', field_name = $fragment, alias = null, type = null
    WHERE id = $id
  `)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer convertToSpread.Finalize()

	// a query to insert selection directives
	insertSelectionDirective, err := conn.Prepare(`
    INSERT INTO selection_directives (selection_id, directive, row, column)
    VALUES ($selection_id, $directive,  0, 0)
  `)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer insertSelectionDirective.Finalize()

	// as a query to insert directive arguments
	insertDirectiveArgument, err := conn.Prepare(`
    insert into selection_directive_arguments (parent, name, value, document)
    values ($parent, $name, $value, $document)
  `)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer insertDirectiveArgument.Finalize()

	// and a query to delete the hanging selection arguments so we don't confuse ourselves later
	deleteArguments, err := conn.Prepare(`
    DELETE FROM selection_arguments WHERE selection_id = $selection_id
  `)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer deleteArguments.Finalize()

	errs := &plugins.ErrorList{}

	// in order to hook up component fields into a query we
	// need to replace any selections that reference component fields with
	// a fragment spread of the appropriate document and add @with for any args
	selectionSearch, err := conn.Prepare(`
    SELECT 
      selections.id,
      CASE 
        WHEN selection_arguments.selection_id IS NOT NULL 
        THEN json_group_array(
          json_object(
            'arg', selection_arguments."name",
            'value', selection_arguments."value"
          )
        )
      END,
      component_fields.type,
      component_fields.field,
      documents.id as document_id,
      component_fields.fragment
    FROM component_fields
      JOIN selections ON selections."type" = component_fields.type_field
      JOIN selection_refs ON selection_refs.child_id = selections.id 
      JOIN documents on selection_refs."document" = documents.id
      JOIN raw_documents ON raw_documents.id = documents.raw_document
      LEFT JOIN selection_arguments ON selection_arguments.selection_id = selections.id AND selection_arguments.document = documents.id
      WHERE (raw_documents.current_task = $task_id OR $task_id IS NULL)
    GROUP BY selections.id
  `)
	if err != nil {
		return plugins.WrapError(err)
	}
	defer selectionSearch.Finalize()

	// walk through the results
	err = db.StepStatement(ctx, selectionSearch, func() {
		selectionID := selectionSearch.ColumnInt(0)
		argStr := selectionSearch.ColumnText(1)
		fragmentName := selectionSearch.GetText("fragment")
		documentID := selectionSearch.GetInt64("document_id")

		// parse the arguments into something we can work with
		args := []struct {
			Arg   string `json:"arg"`
			Value int    `json:"value"`
		}{}
		if argStr != "" {
			err := json.Unmarshal([]byte(argStr), &args)
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
		}
		// convert the selection to a fragment spread
		err = db.ExecStatement(convertToSpread, map[string]any{
			"id":       selectionID,
			"fragment": fragmentName,
		})
		if err != nil {
			errs.Append(plugins.WrapError(err))
			return
		}

		// if there are no args, we're done
		if len(args) == 0 {
			return
		}

		// clean up any arguments that are hanging around
		err = db.ExecStatement(deleteArguments, map[string]any{
			"selection_id": selectionID,
		})
		if err != nil {
			errs.Append(plugins.WrapError(err))
			return
		}

		// insert the @with directive
		err = db.ExecStatement(insertSelectionDirective, map[string]any{
			"selection_id": selectionID,
			"directive":    schema.WithDirective,
		})
		if err != nil {
			errs.Append(plugins.WrapError(err))
			return
		}
		withID := conn.LastInsertRowID()

		// insert each argument
		for _, arg := range args {
			err = db.ExecStatement(insertDirectiveArgument, map[string]any{
				"parent":   withID,
				"name":     arg.Arg,
				"value":    arg.Value,
				"document": documentID,
			})
			if err != nil {
				errs.Append(plugins.WrapError(err))
				return
			}
		}
	})
	if err != nil {
		return plugins.WrapError(err)
	}
	if errs.Len() > 0 {
		return errs
	}

	return nil
}
