package documents

import (
	"fmt"
	"io"
	"regexp"
	"strings"

	"github.com/spf13/afero"

	"code.houdinigraphql.com/plugins"
)

// ProcessFile reads the file (using the provided afero.Fs) and sends each discovered
// GraphQL document on ch. Comments are stripped before scanning so commented-out
// graphql() calls are never extracted.
func ProcessFile(fs afero.Fs, fp string, ch chan DiscoveredDocument) *plugins.Error {
	f, err := fs.Open(fp)
	if err != nil {
		return plugins.WrapError(fmt.Errorf("failed to open file: %w", err))
	}
	defer f.Close()

	raw, err := io.ReadAll(f)
	if err != nil {
		return plugins.WrapError(fmt.Errorf("failed to read file: %w", err))
	}

	// For .graphql/.gql files, send the whole file as a single document.
	if strings.HasSuffix(fp, ".graphql") || strings.HasSuffix(fp, ".gql") {
		ch <- DiscoveredDocument{
			FilePath:     fp,
			Content:      string(raw),
			OffsetRow:    0,
			OffsetColumn: 0,
		}
		return nil
	}

	original := string(raw)

	// Precompute newline positions so getLineAndColumn is O(log n).
	newlinePositions := make([]int, 0)
	for i := 0; i < len(raw); i++ {
		if raw[i] == '\n' {
			newlinePositions = append(newlinePositions, i)
		}
	}

	getLineAndColumn := func(absPos int) (line, col int) {
		lo, hi := 0, len(newlinePositions)
		for lo < hi {
			mid := (lo + hi) / 2
			if newlinePositions[mid] < absPos {
				lo = mid + 1
			} else {
				hi = mid
			}
		}
		line = lo
		if lo == 0 {
			col = absPos
		} else {
			col = absPos - newlinePositions[lo-1] - 1
		}
		return
	}

	// Strip comments before running the regexes. stripComments preserves all byte
	// positions (replacing comment content with spaces), so indices found in stripped
	// are valid in original.
	stripped := stripComments(original)

	for _, m := range graphqlRegex.FindAllStringSubmatchIndex(stripped, -1) {
		if len(m) < 4 {
			continue
		}
		extracted := strings.ReplaceAll(original[m[2]:m[3]], "\\`", "`")
		row, col := getLineAndColumn(m[2])
		ch <- DiscoveredDocument{
			FilePath:     fp,
			Content:      extracted,
			OffsetRow:    row,
			OffsetColumn: col,
		}
	}

	for _, m := range componentFieldRegex.FindAllStringSubmatchIndex(stripped, -1) {
		if len(m) < 6 {
			continue
		}
		prop := original[m[2]:m[3]]
		extracted := strings.ReplaceAll(original[m[4]:m[5]], "\\`", "`")
		row, col := getLineAndColumn(m[4])
		ch <- DiscoveredDocument{
			FilePath:     fp,
			Content:      extracted,
			Prop:         prop,
			OffsetRow:    row,
			OffsetColumn: col,
		}
	}

	return nil
}

// stripComments replaces JS/TS comment content with spaces, preserving all byte
// positions. Newlines inside block comments are kept so line numbers stay correct.
// String and template literals are skipped so comment-like sequences inside them
// are left intact.
func stripComments(src string) string {
	b := []byte(src)
	i := 0
	for i < len(b) {
		switch {
		case b[i] == '/' && i+1 < len(b) && b[i+1] == '/':
			for i < len(b) && b[i] != '\n' {
				b[i] = ' '
				i++
			}
		case b[i] == '/' && i+1 < len(b) && b[i+1] == '*':
			b[i] = ' '
			b[i+1] = ' '
			i += 2
			for i < len(b) {
				if b[i] == '*' && i+1 < len(b) && b[i+1] == '/' {
					b[i] = ' '
					b[i+1] = ' '
					i += 2
					break
				}
				if b[i] != '\n' {
					b[i] = ' '
				}
				i++
			}
		case b[i] == '\'' || b[i] == '"':
			q := b[i]
			i++
			for i < len(b) {
				if b[i] == '\\' {
					i += 2
					continue
				}
				if b[i] == q {
					i++
					break
				}
				i++
			}
		case b[i] == '`':
			i++
			for i < len(b) {
				if b[i] == '\\' {
					i += 2
					continue
				}
				if b[i] == '`' {
					i++
					break
				}
				i++
			}
		default:
			i++
		}
	}
	return string(b)
}

// There are two separate regexes we are concerned about:
// - The first is just an invocation of the graphql() function that contains the string inside ie graphql(`query MyQuery { user }`).
// - The second is a component field as a prop definition in a typescript field definition ie "user: GraphQL<`query MyQuery { user }`>"
// in order to make this easier to maintain we're going to define 3 patterns that we can use to build the final regexes

// Define the subpattern that matches documents within backticks.
var queryRegex = "\\s*`((?:(?:\\\\`)|[^`])*?)`\\s*"

// Create a regex to match the entire GraphQL block, using queryRegex's pattern.
var graphqlRegex = regexp.MustCompile(fmt.Sprintf("(?s)graphql\\(%s\\)", queryRegex))

// Create a regex to capture the property name (e.g. "user") and the GraphQL content.
var componentFieldRegex = regexp.MustCompile(
	fmt.Sprintf(`(?s)(\w+)\s*:\s*GraphQL<\s*%s\s*>`, queryRegex),
)

// DiscoveredDocument holds the file path and the extracted GraphQL query.
type DiscoveredDocument struct {
	FilePath string
	Content  string
	// if we run into a component field we need to record the prop during extraction
	Prop         string
	OffsetColumn int
	OffsetRow    int
}
