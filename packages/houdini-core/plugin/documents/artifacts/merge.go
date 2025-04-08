package artifacts

import "context"

func FlattenSelection(
	cts context.Context,
	collectedDocuments map[string]*CollectedDocument,
	name string,
) (*CollectedDocument, error) {
	// we're done
	return collectedDocuments[name], nil
}
