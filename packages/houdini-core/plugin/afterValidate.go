package plugin

import (
	"context"
)

func (p *HoudiniCore) AfterValidate(ctx context.Context) error {
	// if we got this far, we're done
	return nil
}
