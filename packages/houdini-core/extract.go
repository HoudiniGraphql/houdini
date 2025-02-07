package main

import (
	"bufio"
	"context"
	"io"
	"regexp"
	"runtime"
	"strings"
	"sync"

	"code.houdinigraphql.com/packages/houdini-core/glob"
	"code.houdinigraphql.com/plugins"
	"github.com/spf13/afero"
)

func (p HoudiniCore) ExtractDocuments() error {
	// load the config we care about
	result, err := plugins.QueryConfigServer[struct {
		Config struct {
			Include     []string `json:"include"`
			Exclude     []string `json:"exclude"`
			ProjectRoot string   `json:"projectRoot"`
		} `json:"config"`
	}](`{
		config {
			include
			exclude
			projectRoot
		}
	}`, nil)
	if err != nil {
		return err
	}

	// build a glob matcher that we can use to find all of the files
	matcher := glob.NewWalker()

	// add the include patterns
	for _, include := range result.Config.Include {
		matcher.AddInclude(include)
	}

	// and the exclude patterns
	for _, exclude := range result.Config.Exclude {
		matcher.AddExclude(exclude)
	}

	// set up a channel to receive discovered file paths.
	filePathsCh := make(chan string, 100) // buffered channel to reduce blocking

	// start the file walk in a goroutine.
	go func() {
		// walk blocks until it finishes.
		err := matcher.Walk(context.Background(), result.Config.ProjectRoot, func(fp string) error {
			// send the file path on the channel.
			filePathsCh <- fp
			return nil
		})
		if err != nil {
			// TODO: handle error
		}
		close(filePathsCh) // signal that no more file paths will be sent.
	}()

	// now we can consume the file paths and extract the documents using a pool of goroutines.

	// we'll send the results over this channel
	resultsCh := make(chan DiscoveredDocument, 100)

	// start the goroutine pool to process the files.
	var parseWG sync.WaitGroup
	for i := 0; i < runtime.NumCPU(); i++ {
		parseWG.Add(1)
		go func() {
			defer parseWG.Done()
			for fp := range filePathsCh {
				// Open the file, parse it, run regex, etc.
				err := processFile(afero.NewOsFs(), fp, resultsCh)
				if err != nil {
					// Handle error (or log and continue)
					continue
				}
			}
		}()
	}

	// we're done
	return nil
}

// processFile reads the file (using the provided afero.Fs) in fixed-size chunks to avoid holding
// onto the full file in memory whenever possible. If a complete match is found, it sends the
// extracted document on the provided channel.
func processFile(fs afero.Fs, fp string, ch chan DiscoveredDocument) error {
	f, err := fs.Open(fp)
	if err != nil {
		return err
	}
	defer f.Close()

	const chunkSize = 4096
	var buffer []byte
	reader := bufio.NewReader(f)

	for {
		chunk := make([]byte, chunkSize)
		n, err := reader.Read(chunk)
		if n > 0 {
			// Append the newly read data.
			buffer = append(buffer, chunk[:n]...)
			text := string(buffer)

			// Find all matches.
			matches := graphqlRegex.FindAllStringSubmatchIndex(text, -1)
			lastCompleteMatchEnd := 0

			// Process each match if it is complete.
			for _, m := range matches {
				// m[0] and m[1] are the overall match bounds.
				// m[2] and m[3] are the bounds for the capture group.
				// Only process matches that are complete.
				if m[1] < len(text) {
					if len(m) >= 4 {
						extracted := text[m[2]:m[3]]
						// Replace any escaped backticks with a literal backtick.
						extracted = strings.ReplaceAll(extracted, "\\`", "`")
						ch <- DiscoveredDocument{
							FilePath: fp,
							Content:  extracted,
						}
					}
					if m[1] > lastCompleteMatchEnd {
						lastCompleteMatchEnd = m[1]
					}
				}
			}

			// trim the buffer. if there is a complete match, we can discard everything the end of the last match
			if lastCompleteMatchEnd > 0 {
				buffer = buffer[lastCompleteMatchEnd:]
			} else {
				// no complete match found; look if there is a partial to start the next chunk
				idx := strings.LastIndex(text, "graphql(")
				if idx != -1 {
					buffer = buffer[idx:]
				} else {
					// there is no partial match, no reason to keep the buffer
					buffer = nil
				}
			}
		}

		if err != nil {
			if err == io.EOF {
				// Process any remaining text.
				text := string(buffer)
				matches := graphqlRegex.FindAllStringSubmatchIndex(text, -1)
				for _, m := range matches {
					if len(m) >= 4 {
						extracted := text[m[2]:m[3]]
						extracted = strings.ReplaceAll(extracted, "\\`", "`")
						ch <- DiscoveredDocument{
							FilePath: fp,
							Content:  extracted,
						}
					}
				}
				break
			}
			return err
		}
	}

	return nil
}

// graphqlRegex is a package-level variable that holds the compiled regex.
// It matches: the literal "graphql", optional whitespace, an opening parenthesis,
// optional whitespace, a backtick, then captures everything until the next unescaped backtick,
// then optional whitespace and a closing parenthesis.
var graphqlRegex = regexp.MustCompile("(?s)graphql\\(\\s*`((?:(?:\\\\`)|[^`])*?)`\\s*\\)")

// DiscoveredDocument holds the file path and the extracted GraphQL query.
type DiscoveredDocument struct {
	FilePath string
	Content  string
}
