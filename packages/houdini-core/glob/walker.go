package glob

import (
	"context"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	"github.com/spf13/afero"
)

// Walker holds two pattern trees: one for include patterns and one for exclude patterns.
type Walker struct {
	includeTree *patternTree
	excludeTree *patternTree
}

// NewWalker creates a new Walker with empty include and exclude trees.
func NewWalker() *Walker {
	return &Walker{
		includeTree: newPatternTree(),
		excludeTree: newPatternTree(),
	}
}

// AddInclude adds an include glob pattern.
func (w *Walker) AddInclude(pattern string) {
	addPattern(w.includeTree, pattern)
}

// AddExclude adds an exclude glob pattern.
func (w *Walker) AddExclude(pattern string) {
	addPattern(w.excludeTree, pattern)
}

// Walk traverses the filesystem (using the provided afero.Fs) starting at root in parallel.
// It walks directories concurrently using a worker pool of size equal to runtime.NumCPU().
// For each file (non-directory) whose relative path (normalized to forward slashes)
// matches the include patterns (and does not match the exclude patterns), onFile is called.
// If onFile returns an error or if any error occurs during directory reading, the walk stops.
func (w *Walker) Walk(fs afero.Fs, root string, onFile func(string) error) error {
	// Use a cancellable context so that if an error occurs, we stop processing.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// taskWG tracks how many directories remain to be processed.
	var taskWG sync.WaitGroup
	// workerWG tracks the number of worker goroutines.
	var workerWG sync.WaitGroup

	workCh := make(chan string)

	// errOnce and finalErr let us record the first error we encounter.
	var errOnce sync.Once
	var finalErr error
	setErr := func(e error) {
		errOnce.Do(func() {
			finalErr = e
			cancel()
		})
	}

	worker := func() {
		defer workerWG.Done()
		for {
			select {
			case <-ctx.Done():
				return
			case dir, ok := <-workCh:
				if !ok {
					return
				}
				// Process the current directory.
				entries, err := afero.ReadDir(fs, dir)
				if err != nil {
					setErr(err)
					// Mark this directory as done.
					taskWG.Done()
					continue
				}
				for _, entry := range entries {
					fullPath := filepath.Join(dir, entry.Name())
					// Compute the relative path from root.
					rel, err := filepath.Rel(root, fullPath)
					if err != nil {
						setErr(err)
						continue
					}
					rel = filepath.ToSlash(rel)
					tokens := strings.Split(rel, "/")

					// If the entry matches an exclude pattern, skip it entirely.
					if matchHelper(w.excludeTree, tokens) {
						continue
					}

					if entry.IsDir() {
						// For directories, add a new task and enqueue the directory.
						taskWG.Add(1)
						select {
						case workCh <- fullPath:
						case <-ctx.Done():
						}
					} else {
						// For files, if they match the include patterns, call onFile.
						if matchHelper(w.includeTree, tokens) {
							if err := onFile(fullPath); err != nil {
								setErr(err)
							}
						}
					}
				}
				// Mark this directory as processed.
				taskWG.Done()
			}
		}
	}

	// Start a worker pool with size equal to the number of CPUs.
	numWorkers := runtime.NumCPU()
	for i := 0; i < numWorkers; i++ {
		workerWG.Add(1)
		go worker()
	}

	// Start processing with the root directory.
	taskWG.Add(1)
	go func() {
		select {
		case workCh <- root:
		case <-ctx.Done():
		}
	}()

	// Close workCh once all directory tasks have been processed.
	go func() {
		taskWG.Wait()
		close(workCh)
	}()

	// Wait for all workers to finish.
	workerWG.Wait()
	return finalErr
}

// patternTree is our internal representation for a glob pattern.
// Each node holds a set of children (keyed by the token) and a terminal flag
// indicating that a complete pattern ends at that node.
type patternTree struct {
	children map[string]*patternTree
	terminal bool
}

func newPatternTree() *patternTree {
	return &patternTree{children: make(map[string]*patternTree)}
}

// addPattern adds a single (possibly brace‑expanded) pattern to tree.
// It splits the pattern on "/" and walks/creates nodes accordingly.
func addPattern(tree *patternTree, pattern string) {
	// Expand any brace expressions (e.g. turning "src/**/*.{ts,tsx}" into two patterns).
	for _, pat := range expandBraces(pattern) {
		parts := strings.Split(pat, "/")
		current := tree
		for _, part := range parts {
			if current.children == nil {
				current.children = make(map[string]*patternTree)
			}
			child, ok := current.children[part]
			if !ok {
				child = newPatternTree()
				current.children[part] = child
			}
			current = child
		}
		current.terminal = true
	}
}

// matchHelper recursively attempts to match the list of tokens against the pattern tree.
// It returns true only if all tokens are consumed and the current node is terminal.
func matchHelper(tree *patternTree, tokens []string) bool {
	// If no tokens remain, return true only if the current node is terminal.
	if len(tokens) == 0 {
		return tree.terminal
	}

	// Iterate over every child in the current tree.
	for pat, child := range tree.children {
		if pat == "**" {
			// For "**", try matching zero tokens.
			if matchHelper(child, tokens) {
				return true
			}
			// Or try matching one or more tokens.
			for i := 1; i <= len(tokens); i++ {
				if matchHelper(child, tokens[i:]) {
					return true
				}
			}
		} else {
			// For other tokens, simply use filepath.Match.
			if ok, err := filepath.Match(pat, tokens[0]); err == nil && ok {
				if matchHelper(child, tokens[1:]) {
					return true
				}
			}
		}
	}
	return false
}

// expandBraces performs a simple recursive brace expansion.
// For example, "src/**/*.{ts,tsx}" expands to:
//
//	[]string{"src/**/*.ts", "src/**/*.tsx"}
func expandBraces(pattern string) []string {
	start := strings.Index(pattern, "{")
	if start == -1 {
		return []string{pattern}
	}
	end := strings.Index(pattern[start:], "}")
	if end == -1 {
		// No matching closing brace; return pattern as-is.
		return []string{pattern}
	}
	end += start
	prefix := pattern[:start]
	suffix := pattern[end+1:]
	options := pattern[start+1 : end]
	var results []string
	for _, opt := range strings.Split(options, ",") {
		expanded := prefix + opt + suffix
		results = append(results, expandBraces(expanded)...)
	}
	return results
}
