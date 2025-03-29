package selection

import (
	"context"

	"zombiezen.com/go/sqlite"
)

func EnsureDocumentsPrinted(
	ctx context.Context,
	conn *sqlite.Conn,
	collectedDocuments map[string]*CollectedDocument,
) error {
	return nil
}
