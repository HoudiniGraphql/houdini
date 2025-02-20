package extract

import (
	"bufio"
	"fmt"
	"io"
	"regexp"
	"strings"

	"code.houdinigraphql.com/plugins"
	"github.com/spf13/afero"
)

// processFile reads the file (using the provided afero.Fs) in fixed-size chunks to avoid holding
// onto the full file in memory whenever possible. If a complete match is found, it sends the
// extracted document on the provided channel.
func ProcessFile(fs afero.Fs, fp string, ch chan DiscoveredDocument) *plugins.Error {
	f, err := fs.Open(fp)
	if err != nil {
		pluginError := plugins.WrapError(fmt.Errorf("failed to open file: %w", err))
		return &pluginError
	}
	defer f.Close()

	// For .graphql/.gql files, read it entirely.
	if strings.HasSuffix(fp, ".graphql") || strings.HasSuffix(fp, ".gql") {
		content, err := io.ReadAll(f)
		if err != nil {
			pluginError := plugins.WrapError(fmt.Errorf("failed to read file: %w", err))
			return &pluginError
		}
		ch <- DiscoveredDocument{
			FilePath:     fp,
			Content:      string(content),
			OffsetRow:    0,
			OffsetColumn: 0,
		}
		return nil
	}

	const chunkSize = 4096
	var buffer []byte
	reader := bufio.NewReader(f)

	// absoluteOffset tracks the total bytes read so far.
	absoluteOffset := 0
	// newlinePositions stores the absolute positions of each '\n' encountered.
	var newlinePositions []int

	// Use an incremental pointer to avoid scanning the entire newlinePositions slice every time.
	// Since file reading and regex matching produce offsets in increasing order, we can maintain:
	// - lastNewlineIndex: the index in newlinePositions that was used for the previous match.
	// - currentLine: the number of newlines encountered up to that index.
	lastNewlineIndex := 0
	currentLine := 0

	// getLineAndColumn computes the 0-indexed line and column for an absolute byte offset.
	// It increments from the last position instead of performing a full binary search.
	getLineAndColumn := func(absPos int) (line, col int) {
		// Process any new newlines that occur before absPos.
		for lastNewlineIndex < len(newlinePositions) && newlinePositions[lastNewlineIndex] < absPos {
			currentLine++
			lastNewlineIndex++
		}
		if lastNewlineIndex == 0 {
			// No newline has been seen before absPos.
			return 0, absPos
		}
		// The column is the difference between absPos and the last newline.
		return currentLine, absPos - newlinePositions[lastNewlineIndex-1] - 1
	}

	for {
		chunk := make([]byte, chunkSize)
		n, err := reader.Read(chunk)
		if n > 0 {
			// Update newlinePositions for this chunk.
			for i := 0; i < n; i++ {
				if chunk[i] == '\n' {
					newlinePositions = append(newlinePositions, absoluteOffset+i)
				}
			}
			absoluteOffset += n

			// Append the newly read data.
			buffer = append(buffer, chunk[:n]...)
			text := string(buffer)
			lastCompleteMatchEnd := 0

			// Look for matches of graphql( ... )
			matches := graphqlRegex.FindAllStringSubmatchIndex(text, -1)
			for _, m := range matches {
				// Process only complete matches.
				if m[1] < len(text) {
					if len(m) >= 4 {
						extracted := text[m[2]:m[3]]
						// Replace escaped backticks.
						extracted = strings.ReplaceAll(extracted, "\\`", "`")
						// Compute absolute offset for the start of the GraphQL content.
						absPos := (absoluteOffset - len(buffer)) + m[2]
						row, col := getLineAndColumn(absPos)
						ch <- DiscoveredDocument{
							FilePath:     fp,
							Content:      extracted,
							OffsetRow:    row,
							OffsetColumn: col,
						}
					}
					if m[1] > lastCompleteMatchEnd {
						lastCompleteMatchEnd = m[1]
					}
				}
			}

			// Look for component field matches: e.g. "user: GraphQL<` ... `>"
			compMatches := componentFieldRegex.FindAllStringSubmatchIndex(text, -1)
			for _, m := range compMatches {
				if m[1] < len(text) {
					if len(m) >= 6 {
						prop := text[m[2]:m[3]]
						extracted := text[m[4]:m[5]]
						extracted = strings.ReplaceAll(extracted, "\\`", "`")
						absPos := (absoluteOffset - len(buffer)) + m[4]
						row, col := getLineAndColumn(absPos)
						ch <- DiscoveredDocument{
							FilePath:     fp,
							Content:      extracted,
							Prop:         prop,
							OffsetRow:    row,
							OffsetColumn: col,
						}
					}
					if m[1] > lastCompleteMatchEnd {
						lastCompleteMatchEnd = m[1]
					}
				}
			}

			// Trim the buffer: remove data that has already been processed.
			if lastCompleteMatchEnd > 0 {
				buffer = buffer[lastCompleteMatchEnd:]
			} else {
				idx1 := strings.LastIndex(text, "graphql(")
				idx2 := strings.LastIndex(text, "GraphQL<")
				if idx1 == -1 && idx2 == -1 {
					buffer = nil
				} else {
					idx := idx1
					if idx2 > idx {
						idx = idx2
					}
					buffer = buffer[idx:]
				}
			}
		}

		if err != nil {
			if err != io.EOF {
				pluginError := plugins.WrapError(fmt.Errorf("failed to read file: %w", err))
				return &pluginError
			}
			// Process any remaining text at the end of the file.
			text := string(buffer)
			matches := graphqlRegex.FindAllStringSubmatchIndex(text, -1)
			for _, m := range matches {
				if len(m) >= 4 {
					extracted := text[m[2]:m[3]]
					extracted = strings.ReplaceAll(extracted, "\\`", "`")
					absPos := (absoluteOffset - len(buffer)) + m[2]
					row, col := getLineAndColumn(absPos)
					ch <- DiscoveredDocument{
						FilePath:     fp,
						Content:      extracted,
						OffsetRow:    row,
						OffsetColumn: col,
					}
				}
			}
			compMatches := componentFieldRegex.FindAllStringSubmatchIndex(text, -1)
			for _, m := range compMatches {
				if len(m) >= 6 {
					prop := text[m[2]:m[3]]
					extracted := text[m[4]:m[5]]
					extracted = strings.ReplaceAll(extracted, "\\`", "`")
					absPos := (absoluteOffset - len(buffer)) + m[4]
					row, col := getLineAndColumn(absPos)
					ch <- DiscoveredDocument{
						FilePath:     fp,
						Content:      extracted,
						Prop:         prop,
						OffsetRow:    row,
						OffsetColumn: col,
					}
				}
			}
			break
		}
	}

	return nil
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
var componentFieldRegex = regexp.MustCompile(fmt.Sprintf(`(?s)(\w+)\s*:\s*GraphQL<\s*%s\s*>`, queryRegex))

// DiscoveredDocument holds the file path and the extracted GraphQL query.
type DiscoveredDocument struct {
	FilePath string
	Content  string
	// if we run into a component field we need to record the prop during extraction
	Prop         string
	OffsetColumn int
	OffsetRow    int
}
