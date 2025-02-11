package main

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log"
	"regexp"
	"runtime"
	"strings"
	"sync"

	"code.houdinigraphql.com/packages/houdini-core/glob"
	"github.com/spf13/afero"
	"golang.org/x/sync/errgroup"
)

// ExtractDocuments is responsible for walking down the project directory structure and
// extracting the raw graphql documents from the files. These files will be parsed in a
// later step to allow for other plugins to find additional documents we don't know about
func (p *HoudiniCore) ExtractDocuments(ctx context.Context) error {
	// load the project config
	config, err := p.DB.ProjectConfig()
	if err != nil {
		return err
	}

	// build a glob walker that we can use to find all of the files
	walker := glob.NewWalker()
	for _, pattern := range config.Include {
		walker.AddInclude(pattern)
	}
	for _, pattern := range config.Exclude {
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
		err := walker.Walk(ctx, p.fs, config.ProjectRoot, func(fp string) error {
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
					if err := processFile(p.fs, fp, resultsCh); err != nil {
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
		conn, err := p.ConnectDB()
		if err != nil {
			return fmt.Errorf("failed to connect to db: %w", err)
		}
		defer conn.Close()

		// prepare the insert statements.
		insertRawStatement, err := conn.Prepare("INSERT INTO raw_documents (filepath, content) VALUES (?, ?)")
		if err != nil {
			return fmt.Errorf("failed to prepare statement: %w", err)
		}
		defer insertRawStatement.Finalize()
		insertComponentField, err := conn.Prepare("INSERT INTO component_fields (document, prop, inline) VALUES (?, ?, true)")
		if err != nil {
			return fmt.Errorf("failed to prepare statement: %w", err)
		}
		defer insertComponentField.Finalize()

		// consume discovered documents from resultsCh and write them to the database.
		for doc := range resultsCh {
			err := conn.ExecStatement(insertRawStatement, doc.FilePath, doc.Content)
			if err != nil {
				return fmt.Errorf("failed to insert raw document: %v", err)
			}
			documentID := conn.LastInsertRowID()

			// if the document has a component field prop, let's register it now as well.
			if doc.Prop != "" {
				err = conn.ExecStatement(insertComponentField, documentID, doc.Prop)
				if err != nil {
					return fmt.Errorf("failed to insert component field: %v", err)
				}
			}
		}

		// we're done
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

	// If the file is a .graphql/.gql file, read it entirely.
	if strings.HasSuffix(fp, ".graphql") || strings.HasSuffix(fp, ".gql") {
		content, err := io.ReadAll(f)
		if err != nil {
			return err
		}
		ch <- DiscoveredDocument{
			FilePath: fp,
			Content:  string(content),
		}
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
			lastCompleteMatchEnd := 0

			// Look for matches of graphql( ... )
			matches := graphqlRegex.FindAllStringSubmatchIndex(text, -1)
			for _, m := range matches {
				// Only process matches that are complete (i.e. the match ends before the end of our current text).
				if m[1] < len(text) {
					if len(m) >= 4 {
						extracted := text[m[2]:m[3]]
						// Replace any escaped backticks with literal backticks.
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

			// Look for component field matches: e.g. "user: GraphQL<` ... `>"
			compMatches := componentFieldRegex.FindAllStringSubmatchIndex(text, -1)
			for _, m := range compMatches {
				if m[1] < len(text) {
					// Expecting at least 3 captured groups:
					// m[0]: full match, m[2]/m[3]: property name, m[4]/m[5]: GraphQL content.
					if len(m) >= 6 {
						prop := text[m[2]:m[3]]
						extracted := text[m[4]:m[5]]
						extracted = strings.ReplaceAll(extracted, "\\`", "`")
						ch <- DiscoveredDocument{
							FilePath: fp,
							Content:  extracted,
							Prop:     prop,
						}
					}
					if m[1] > lastCompleteMatchEnd {
						lastCompleteMatchEnd = m[1]
					}
				}
			}

			// Trim the buffer:
			// If we found a complete match, drop everything up to its end.
			// Otherwise, if there is a partial match (a starting keyword), keep from there.
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
				compMatches := componentFieldRegex.FindAllStringSubmatchIndex(text, -1)
				for _, m := range compMatches {
					if len(m) >= 6 {
						prop := text[m[2]:m[3]]
						extracted := text[m[4]:m[5]]
						extracted = strings.ReplaceAll(extracted, "\\`", "`")
						ch <- DiscoveredDocument{
							FilePath: fp,
							Content:  extracted,
							Prop:     prop,
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
	Prop string
}
