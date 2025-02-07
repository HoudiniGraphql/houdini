package glob

import (
	"context"
	"fmt"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"

	"github.com/spf13/afero"
)

// Walker holds an include pattern tree and an exclude pattern tree.
// these trees are used to determine if a file path should be processed.
type Walker struct {
	includeTree *patternTree
	excludeTree *patternTree
}

// NewWalker creates a new walker with empty include and exclude pattern trees.
func NewWalker() *Walker {
	return &Walker{
		includeTree: newPatternTree(),
		excludeTree: newPatternTree(),
	}
}

// AddInclude expands braces in the given pattern and adds each expanded pattern
// to the include tree.
func (w *Walker) AddInclude(pattern string) error {
	expanded := expandBraces(pattern)
	for _, pat := range expanded {
		if err := addPattern(w.includeTree, pat); err != nil {
			return err
		}
	}
	return nil
}

// AddExclude expands braces in the given pattern and adds each expanded pattern
// to the exclude tree.
func (w *Walker) AddExclude(pattern string) error {
	expanded := expandBraces(pattern)
	for _, pat := range expanded {
		if err := addPattern(w.excludeTree, pat); err != nil {
			return err
		}
	}
	return nil
}

// WalkAfero traverses the filesystem using afero.Walk starting at root.
// for each file, it splits the relative path into tokens and
// calls onFile if the path matches the include tree and does not match the exclude tree.
// if a directory matches the exclude tree, its subtree is skipped.
func (w *Walker) WalkAfero(ctx context.Context, fs afero.Fs, root string, onFile func(string) error) error {
	// create a cancellable context to cancel processing on error
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	// workCh carries directory paths to process
	workCh := make(chan string, 100)

	// taskWG tracks the number of directories pending processing
	var taskWG sync.WaitGroup

	// workerWG tracks the number of worker goroutines
	var workerWG sync.WaitGroup

	// finalErr holds the first encountered error
	var finalErr error
	var errOnce sync.Once

	// setErr records an error and cancels further processing
	setErr := func(e error) {
		errOnce.Do(func() {
			finalErr = e
			cancel()
		})
	}

	// worker is run by each goroutine; it processes directories from workCh.
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
				// use afero.ReadDir to list directory entries
				entries, err := afero.ReadDir(fs, dir)
				if err != nil {
					setErr(err)
					taskWG.Done()
					continue
				}
				for _, entry := range entries {
					fullPath := filepath.Join(dir, entry.Name())
					rel, err := filepath.Rel(root, fullPath)
					if err != nil {
						setErr(err)
						continue
					}
					if rel == "." {
						rel = ""
					}
					// normalize path to use forward slashes and split into tokens
					rel = filepath.ToSlash(rel)
					tokens := strings.Split(rel, "/")
					// for directories: if the exclude tree matches, skip this directory;
					// otherwise, enqueue it for further processing.
					if entry.IsDir() {
						if matchHelper(w.excludeTree, tokens) {
							continue
						}
						taskWG.Add(1)
						select {
						case workCh <- fullPath:
							// Successfully enqueued, nothing more to do.
						case <-ctx.Done():
							// The context was canceled, so we need to balance the Add(1)
							taskWG.Done()
						}
					} else {
						// for files: if the exclude tree matches, skip;
						// if the include tree matches, call onFile.
						if matchHelper(w.excludeTree, tokens) {
							continue
						}
						if matchHelper(w.includeTree, tokens) {
							if err := onFile(rel); err != nil {
								setErr(err)
							}
						}
					}
				}
				taskWG.Done()
			}
		}
	}

	// start a worker pool with a number of workers equal to the number of CPUs
	numWorkers := runtime.NumCPU()
	for i := 0; i < numWorkers; i++ {
		workerWG.Add(1)
		go worker()
	}

	// add the root directory as the first task
	taskWG.Add(1)
	go func() {
		select {
		case workCh <- root:
		case <-ctx.Done():
		}
	}()

	// close workCh once all directory tasks are done
	go func() {
		taskWG.Wait()
		close(workCh)
	}()

	// wait for all workers to finish
	workerWG.Wait()
	return finalErr
}

// WalkAfero traverses the filesystem starting at root.
// for each file, it splits the relative path into tokens and
// calls onFile if the path matches the include tree and does not match the exclude tree.
// if a directory matches the exclude tree, its subtree is skipped.
func (w *Walker) Walk(ctx context.Context, root string, onFile func(string) error) error {
	return w.WalkAfero(ctx, afero.NewOsFs(), root, onFile)
}

// -----------------------------------------------------------------------------
// tokenMatcher interface and its implementations
// -----------------------------------------------------------------------------

// tokenMatcher is an interface for matching a single path token.
type tokenMatcher interface {
	// match returns true if the given token satisfies the matcher.
	Match(token string) bool
	// string returns a string representation of the matcher.
	String() string
}

// literalMatcher performs an exact string comparison.
type literalMatcher string

func (l literalMatcher) Match(token string) bool { return string(l) == token }
func (l literalMatcher) String() string          { return string(l) }

// regexMatcher uses a compiled regular expression to match a token.
type regexMatcher struct {
	pattern string
	re      *regexp.Regexp
}

func (r regexMatcher) Match(token string) bool { return r.re.MatchString(token) }
func (r regexMatcher) String() string          { return r.pattern }

// negationMatcher implements extglob negation matching.
// it supports tokens of the form "!(foo,bar)<suffix>".
// the token matches if it ends with the given suffix and the prefix is not exactly any forbidden alternative.
type negationMatcher struct {
	forbidden []string     // forbidden alternatives (as literals)
	suffix    tokenMatcher // matcher for the suffix part
	full      string       // original token (for debugging)
}

func (n negationMatcher) Match(token string) bool {
	suffixStr := n.suffix.String()
	if !strings.HasSuffix(token, suffixStr) {
		return false
	}
	prefix := token[:len(token)-len(suffixStr)]
	for _, forb := range n.forbidden {
		if prefix == forb {
			return false
		}
	}
	return true
}

func (n negationMatcher) String() string { return n.full }

// globToRegex converts a simple glob (without extglob operators) to a regex string.
func globToRegex(glob string) string {
	var re strings.Builder
	for i := 0; i < len(glob); i++ {
		c := glob[i]
		switch c {
		case '*':
			re.WriteString(".*")
		case '?':
			re.WriteString(".")
		case '[':
			j := i + 1
			for ; j < len(glob) && glob[j] != ']'; j++ {
			}
			if j < len(glob) {
				re.WriteString(glob[i : j+1])
				i = j
			} else {
				re.WriteString("\\[")
			}
		case '.', '(', ')', '+', '|', '^', '$', '{', '}', '\\':
			re.WriteByte('\\')
			re.WriteByte(c)
		default:
			re.WriteByte(c)
		}
	}
	return re.String()
}

// compilePicomatchToRegex converts a picomatch token (with extglob operators except negation)
// into a regex string. it supports *, ?, character classes, and extglobs like ?(…), +(…), *(…), @(…).
func compilePicomatchToRegex(pattern string) (string, error) {
	var regex strings.Builder
	for i := 0; i < len(pattern); i++ {
		c := pattern[i]
		// check for extglob operator (except negation)
		if (c == '?' || c == '+' || c == '*' || c == '@') &&
			i+1 < len(pattern) && pattern[i+1] == '(' {
			op := pattern[i]
			i += 2 // skip operator and '('
			groupContent, newPos, err := parseExtglobGroup(pattern, i)
			if err != nil {
				return "", err
			}
			i = newPos
			alternatives := strings.ReplaceAll(groupContent, ",", "|")
			switch op {
			case '?':
				regex.WriteString("(?:")
				regex.WriteString(alternatives)
				regex.WriteString(")?")
			case '+':
				regex.WriteString("(?:")
				regex.WriteString(alternatives)
				regex.WriteString(")+")
			case '*':
				regex.WriteString("(?:")
				regex.WriteString(alternatives)
				regex.WriteString(")*")
			case '@':
				regex.WriteString("(?:")
				regex.WriteString(alternatives)
				regex.WriteString(")")
			}
			continue
		}
		switch c {
		case '*':
			regex.WriteString(".*")
		case '?':
			regex.WriteString(".")
		case '[':
			j := i + 1
			for ; j < len(pattern) && pattern[j] != ']'; j++ {
			}
			if j < len(pattern) {
				regex.WriteString(pattern[i : j+1])
				i = j
			} else {
				regex.WriteString("\\[")
			}
		case '.', '(', ')', '+', '|', '^', '$', '{', '}', '\\':
			regex.WriteByte('\\')
			regex.WriteByte(c)
		default:
			regex.WriteByte(c)
		}
	}
	return regex.String(), nil
}

// parseExtglobGroup parses an extglob group starting at index start and
// returns the content of the group, the index of the closing ')' and an error if any.
func parseExtglobGroup(pattern string, start int) (string, int, error) {
	var sb strings.Builder
	depth := 1
	i := start
	for i < len(pattern) {
		c := pattern[i]
		if c == '(' {
			depth++
		} else if c == ')' {
			depth--
			if depth == 0 {
				return sb.String(), i, nil
			}
		}
		sb.WriteByte(c)
		i++
	}
	return "", i, fmt.Errorf("unmatched parenthesis in extglob group: %q", pattern[start:])
}

// compileTokenMatcher compiles a single token (a segment of a glob pattern) into a tokenMatcher.
// it supports globstar, negation extglob (starting with "!("), and other extglob operators.
func compileTokenMatcher(token string) (tokenMatcher, error) {
	if token == "**" {
		return literalMatcher("**"), nil
	}
	if strings.HasPrefix(token, "!(") {
		// handle negation extglob; find the group content starting at index 2.
		groupContent, pos, err := parseExtglobGroup(token, 2)
		if err != nil {
			return nil, err
		}
		// forbidden alternatives are the comma-separated contents.
		forbiddenStrs := strings.Split(groupContent, ",")

		// the remainder of the token after the extglob group is the suffix.
		suffixPart := token[pos+1:]
		var suffixMatcher tokenMatcher
		if suffixPart == "" {
			suffixMatcher = literalMatcher("")
		} else {
			suffixMatcher = literalMatcher(suffixPart)
		}

		return negationMatcher{
			forbidden: forbiddenStrs,
			suffix:    suffixMatcher,
			full:      token,
		}, nil
	}

	// if token contains other extglob operators, compile using compilePicomatchToRegex.
	if strings.Contains(token, "?(") || strings.Contains(token, "*(") ||
		strings.Contains(token, "+(") || strings.Contains(token, "@(") {
		reStr, err := compilePicomatchToRegex(token)
		if err != nil {
			return nil, err
		}
		re, err := regexp.Compile("^" + reStr + "$")
		if err != nil {
			return nil, err
		}
		return regexMatcher{pattern: token, re: re}, nil
	}
	if strings.ContainsAny(token, "*?[") {
		reStr := "^" + globToRegex(token) + "$"
		re, err := regexp.Compile(reStr)
		if err != nil {
			return nil, err
		}
		return regexMatcher{pattern: token, re: re}, nil
	}
	return literalMatcher(token), nil
}

// -----------------------------------------------------------------------------
// pattern tree and tree-based matching
// -----------------------------------------------------------------------------

// childPattern represents an edge in the pattern tree.
type childPattern struct {
	matcher tokenMatcher
	node    *patternTree
}

// patternTree is the internal representation of a compiled glob pattern.
// it stores compiled token matchers and whether a complete pattern ends at the node.
type patternTree struct {
	children []childPattern
	terminal bool
}

// newPatternTree creates a new empty pattern tree.
func newPatternTree() *patternTree {
	return &patternTree{
		children: []childPattern{},
		terminal: false,
	}
}

// addPattern splits the given pattern on "/" and adds each token to the tree,
// compiling each token into a matcher.
func addPattern(tree *patternTree, pattern string) error {
	parts := strings.Split(pattern, "/")
	current := tree
	for _, part := range parts {
		matcher, err := compileTokenMatcher(part)
		if err != nil {
			return err
		}
		var child *patternTree
		found := false
		for i := range current.children {
			if current.children[i].matcher.String() == matcher.String() {
				child = current.children[i].node
				found = true
				break
			}
		}
		if !found {
			child = newPatternTree()
			current.children = append(current.children, childPattern{matcher: matcher, node: child})
		}
		current = child
	}
	current.terminal = true
	return nil
}

// matchHelper recursively matches a slice of tokens against the pattern tree.
// it returns true if the tokens completely match a pattern that ends at a terminal node.
func matchHelper(tree *patternTree, tokens []string) bool {
	if len(tokens) == 0 {
		return tree.terminal
	}
	for _, child := range tree.children {
		if child.matcher.String() == "**" {
			// globstar: try matching zero tokens.
			if matchHelper(child.node, tokens) {
				return true
			}
			// or try matching one or more tokens.
			for i := 1; i <= len(tokens); i++ {
				if matchHelper(child.node, tokens[i:]) {
					return true
				}
			}
		} else if child.matcher.Match(tokens[0]) {
			if matchHelper(child.node, tokens[1:]) {
				return true
			}
		}
	}
	return false
}

// -----------------------------------------------------------------------------
// brace expansion helper
// -----------------------------------------------------------------------------

// expandBraces expands brace expressions within a path pattern recursively.
// Example: "src/{components,routes}/**/*.{ts,tsx,gql}"
// Expands to: ["src/components/**/*.{ts,tsx,gql}", "src/routes/**/*.{ts,tsx,gql}"]
func expandBraces(pattern string) []string {
	start := strings.Index(pattern, "{")
	if start == -1 {
		return []string{pattern} // No braces, return as is
	}
	end := strings.Index(pattern[start:], "}")
	if end == -1 {
		return []string{pattern} // Unmatched brace, return as is
	}
	end += start

	prefix := pattern[:start] // Part before '{'
	suffix := pattern[end+1:] // Part after '}'
	options := pattern[start+1 : end]

	var results []string
	for _, opt := range strings.Split(options, ",") {
		expanded := prefix + opt + suffix
		results = append(results, expandBraces(expanded)...) // Recursively expand
	}
	return results
}
