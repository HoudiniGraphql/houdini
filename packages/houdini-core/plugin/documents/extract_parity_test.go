package documents_test

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"

	"code.houdinigraphql.com/packages/houdini-core/plugin/documents"
)

// The language server re-implements this package's extraction in TypeScript so it
// can extract from unsaved editor buffers (packages/houdini-lsp/src/extract.ts).
// Both implementations run the shared corpus and must produce the same golden —
// if this test and the vitest parity suite disagree, the two extractors have
// drifted and inline-document positions in the editor are wrong.
func TestExtractParityGolden(t *testing.T) {
	ch := make(chan documents.DiscoveredDocument, 100)
	err := documents.ProcessFile(afero.NewOsFs(), "testdata/extract-parity/corpus.txt", ch)
	require.Nil(t, err)
	close(ch)

	type doc struct {
		Content string `json:"content"`
		Row     int    `json:"row"`
		Column  int    `json:"column"`
		Prop    string `json:"prop"`
	}
	got := []doc{}
	for d := range ch {
		got = append(got, doc{Content: d.Content, Row: d.OffsetRow, Column: d.OffsetColumn, Prop: d.Prop})
	}

	expected, readErr := os.ReadFile("testdata/extract-parity/expected.json")
	require.NoError(t, readErr)
	gotJSON, marshalErr := json.MarshalIndent(got, "", "    ")
	require.NoError(t, marshalErr)
	require.JSONEq(t, string(expected), string(gotJSON))
}
