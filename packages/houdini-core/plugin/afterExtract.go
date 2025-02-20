package plugin

import (
	"context"

	afterextract "code.houdinigraphql.com/packages/houdini-core/plugin/afterExtract"
	"code.houdinigraphql.com/plugins"
)

// AfterExtract is called after all of the plugins have added their documents to the project.
// We'll use this plugin to parse each document and load it into the database.
func (p *HoudiniCore) AfterExtract(ctx context.Context) error {
	// sqlite only allows for one write at a time so there's no point in parallelizing this

	// the first thing we have to do is load the extracted queries
	err := afterextract.LoadDocuments(ctx, p.DB)
	if err != nil {
		return err
	}

	errs := &plugins.ErrorList{}

	conn, err := p.DB.Take(context.Background())
	if err != nil {
		return err
	}
	defer p.DB.Put(conn)

	// write component field information to the database
	afterextract.ComponentFields(p.DB, conn, errs)

	// and replace runtime scalars with their schema-valid equivalents
	afterextract.RuntimeScalars(ctx, p.DB, conn, errs)

	// if we have any errors collected, return them
	if errs.Len() > 0 {
		return errs
	}

	// we're done
	return nil
}
