package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"regexp"
	"runtime"
	"strings"
	"sync"

	"code.houdinigraphql.com/packages/houdini-core/glob"
	"code.houdinigraphql.com/plugins"
	"github.com/spf13/afero"
	"golang.org/x/sync/errgroup"
	"zombiezen.com/go/sqlite"
	"zombiezen.com/go/sqlite/sqlitex"
)

func (p HoudiniCore) ExtractDocuments() error {
	// load the include, exclude, and project root from the config
	var include, exclude []string
	var projectRoot string
	err := sqlitex.Execute(p.DB.Conn, "SELECT include, exclude, project_root FROM config ", &sqlitex.ExecOptions{
		ResultFunc: func(stmt *sqlite.Stmt) error {
			err := json.Unmarshal([]byte(stmt.ColumnText(0)), &include)
			if err != nil {
				return err
			}
			err = json.Unmarshal([]byte(stmt.ColumnText(1)), &exclude)
			if err != nil {
				return err
			}
			projectRoot = stmt.ColumnText(2)

			// nothing went wrong
			return nil
		},
	})
	if err != nil {
		return err
	}

	// build a glob walker that we can use to find all of the files
	walker := glob.NewWalker()
	for _, pattern := range include {
		walker.AddInclude(pattern)
	}
	for _, pattern := range exclude {
		walker.AddExclude(pattern)
	}

	// channels for file paths and discovered documents
	filePathsCh := make(chan string, 100)
	resultsCh := make(chan DiscoveredDocument, 100)

	// create a cancellable context and an errgroup
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// we have a few goroutines that will be running to process the files so we'll
	// wrap them in an errgroup to make sure we can cancel them all if something goes wrong
	g, ctx := errgroup.WithContext(ctx)

	// file walker goroutine
	g.Go(func() error {
		// start the walk; each file path found is sent into filePathsCh.
		err := walker.Walk(ctx, projectRoot, func(fp string) error {
			// in case the context is canceled, stop early.
			select {
			case filePathsCh <- fp:
				return nil
			case <-ctx.Done():
				return ctx.Err()
			}
		})
		// whether or not there was an error, close the channel
		// to signal that no more file paths will be sent.
		close(filePathsCh)
		return err
	})

	// file processing workers
	var procWG sync.WaitGroup
	for i := 0; i < runtime.NumCPU(); i++ {
		procWG.Add(1)
		go func() {
			defer procWG.Done()
			// read from filePathsCh until it is closed.
			for {
				select {
				case fp, ok := <-filePathsCh:
					if !ok {
						return // channel closed
					}
					// process the file
					if err := processFile(afero.NewOsFs(), fp, resultsCh); err != nil {
						// if there's an error, just log it and continue with the next file.
						log.Printf("failed to process file %s: %v", fp, err)
					}
				case <-ctx.Done():
					return
				}
			}
		}()
	}

	// database writer goroutine
	g.Go(func() error {
		// build a connection to the database.
		conn, err := plugins.ConnectDB()
		if err != nil {
			return fmt.Errorf("failed to connect to db: %w", err)
		}
		defer conn.Close()

		// prepare the insert statement.
		statement, err := conn.Prepare("INSERT INTO raw_documents (filepath, content) VALUES (?, ?)")
		if err != nil {
			return fmt.Errorf("failed to prepare statement: %w", err)
		}
		defer statement.Finalize()

		// consume discovered documents from resultsCh and write them to the database.
		for doc := range resultsCh {
			// reset the statement before reuse.
			if err := statement.Reset(); err != nil {
				return fmt.Errorf("failed to reset statement: %w", err)
			}

			// bind the parameters.
			statement.BindText(1, doc.FilePath)
			statement.BindText(2, doc.Content)

			// execute the statement.
			if _, err := statement.Step(); err != nil {
				return fmt.Errorf("failed to execute insert: %w", err)
			}
		}
		return nil
	})

	// once all file-processing workers are done, close the results channel. this will signal the gourotine above to finish
	go func() {
		procWG.Wait()
		close(resultsCh)
	}()

	// wait for the error group's goroutines (walker and writer) to finish.
	// any error returned will be propagated here.
	if err := g.Wait(); err != nil {
		return err
	}

	// if we got here, everything completed successfully.
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

	// if the file is a graphql file we can just use the contents directly
	if strings.HasSuffix(fp, ".graphql") || strings.HasSuffix(fp, ".gql") {
		// read the full file
		content, err := io.ReadAll(f)
		if err != nil {
			return err
		}

		// write the content to the channel
		ch <- DiscoveredDocument{
			FilePath: fp,
			Content:  string(content),
		}

		// we're done
		return nil
	}

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

// graphqlRegex holds the compiled regex. It matches: the literal "graphql", optional whitespace, an opening parenthesis,
// optional whitespace, a backtick, then captures everything until the next unescaped backtick,
// then optional whitespace and a closing parenthesis.
var graphqlRegex = regexp.MustCompile("(?s)graphql\\(\\s*`((?:(?:\\\\`)|[^`])*?)`\\s*\\)")

// DiscoveredDocument holds the file path and the extracted GraphQL query.
type DiscoveredDocument struct {
	FilePath string
	Content  string
}
