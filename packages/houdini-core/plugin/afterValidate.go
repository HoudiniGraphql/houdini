package plugin

import (
	"context"
)

func (p *HoudiniCore) AfterValidate(ctx context.Context) error {
	// now that we've validated the documents we can start to process them

	// if we got this far, we're done
	return nil
}
