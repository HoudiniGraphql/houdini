package validate

import (
	"context"

	"code.houdinigraphql.com/plugins"
	"zombiezen.com/go/sqlite"
)

// runValidationQuery wraps the common steps for executing a query.
// It obtains the connection, prepares the query, iterates over rows, and calls the rowHandler callback for each row.
func runValidationQuery[PluginConfig any](ctx context.Context, db plugins.DatabasePool[PluginConfig], queryStr, prepErrMsg string, errs *plugins.ErrorList, rowHandler func(q *sqlite.Stmt)) {
	conn, err := db.Take(ctx)
	if err != nil {
		errs.Append(plugins.Error{
			Message: "could not open connection to database",
			Detail:  err.Error(),
		})
		return
	}
	defer db.Put(conn)

	query, err := conn.Prepare(queryStr)
	if err != nil {
		errs.Append(plugins.Error{
			Message: prepErrMsg,
			Detail:  err.Error(),
		})
		return
	}
	defer query.Finalize()

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		hasData, err := query.Step()
		if err != nil {
			errs.Append(plugins.Error{
				Message: "query step error",
				Detail:  err.Error(),
			})
			break
		}
		if !hasData {
			break
		}
		rowHandler(query)
	}
}

func runValidationStatement(ctx context.Context, conn *sqlite.Conn, queryStatement *sqlite.Stmt, prepErrMsg string, errs *plugins.ErrorList, rowHandler func()) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		hasData, err := queryStatement.Step()
		if err != nil {
			errs.Append(plugins.Error{
				Message: "query step error",
				Detail:  err.Error(),
			})
			break
		}
		if !hasData {
			break
		}
		rowHandler()
	}
}
