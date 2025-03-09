package plugin

import "context"

func (p *HoudiniSvelte) Schema(ctx context.Context) error {
	// grab a connection to the database for this
	conn, err := p.DB.Take(ctx)
	if err != nil {
		return err
	}
	defer p.DB.Put(conn)

	// we have a few directives to add
	directives := map[string]string{
		"load":             "@load is used to enable automatic fetch on inline queries.",
		"blocking":         "@blocking is used to always await the fetch.",
		"blocking_disable": `@blocking_disable is used to not always await the fetch (in CSR for example). Note that "throwOnError" will not throw in this case.`,
	}

	insertDirective, err := conn.Prepare(`
		insert into directives (name, description, internal) values ($name, $description, true)
	`)
	if err != nil {
		return err
	}
	defer insertDirective.Finalize()

	insertDirectiveLocation, err := conn.Prepare(`
		insert into directive_locations (directive, location) values ($directive, 'QUERY')
	`)
	if err != nil {
		return err
	}
	defer insertDirectiveLocation.Finalize()

	for name, description := range directives {
		// insert the directive
		err := p.DB.ExecStatement(insertDirective, map[string]interface{}{
			"name":        name,
			"description": description,
		})
		if err != nil {
			return err
		}

		// insert the directive
		err = p.DB.ExecStatement(insertDirectiveLocation, map[string]interface{}{
			"directive": conn.LastInsertRowID(),
		})
		if err != nil {
			return err
		}
	}

	return nil
}
