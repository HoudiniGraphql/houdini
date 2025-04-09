package artifacts

import (
	"context"
	"fmt"
)

func FlattenSelection(
	cts context.Context,
	collectedDocuments map[string]*CollectedDocument,
	name string,
) (*CollectedDocument, error) {
	// we need to flatten the selection of the document with the matching name
	_, ok := collectedDocuments[name]
	if !ok {
		return nil, fmt.Errorf("document not found: %s", name)
	}

	// we're done
	return collectedDocuments[name], nil
}
