package main

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
)

type glob struct {
	root        string
	pattern     string
	regexStr    string
	regex       *regexp.Regexp
	braceExpand bool
	// Add cache for compiled patterns
	patternCache sync.Map
}

// newGlob creates a new Glob instance with the given pattern
func newGlob(pattern string, root string) (*glob, error) {
	g := &glob{
		root:        root,
		pattern:     pattern,
		braceExpand: true,
	}
	if err := g.compile(); err != nil {
		return nil, err
	}
	return g, nil
}

func Glob(pattern string, root string) ([]string, error) {
	g, err := newGlob(pattern, root)
	if err != nil {
		return nil, err
	}
	return g.Find()
}

// compile converts the glob pattern to a regular expression
func (g *glob) compile() error {
	// Check cache first
	if cached, ok := g.patternCache.Load(g.pattern); ok {
		g.regex = cached.(*regexp.Regexp)
		return nil
	}

	pattern := g.pattern

	// Pre-allocate buffer for regex string
	var regexBuilder strings.Builder
	regexBuilder.Grow(len(pattern) * 2) // Estimate capacity

	// Handle brace expansion if enabled
	if g.braceExpand {
		expanded, err := g.expandBraces(pattern)
		if err != nil {
			return err
		}
		pattern = expanded
	}

	// Convert glob pattern to regex
	regexBuilder.WriteString("^")
	for i := 0; i < len(pattern); i++ {
		switch pattern[i] {
		case '*':
			if i+1 < len(pattern) && pattern[i+1] == '*' {
				// Handle **
				if i+2 < len(pattern) && pattern[i+2] == '/' {
					regexBuilder.WriteString("(?:.*?/)?")
					i += 2
				} else {
					regexBuilder.WriteString(".*?")
					i++
				}
			} else {
				regexBuilder.WriteString("[^/]*?")
			}
		case '?':
			regexBuilder.WriteString("[^/]")
		case '.':
			regexBuilder.WriteString("\\.")
		case '/':
			regexBuilder.WriteString("/")
		case '[':
			j := i + 1
			if j < len(pattern) && pattern[j] == '!' {
				j++
				regexBuilder.WriteString("[^")
			} else {
				regexBuilder.WriteString("[")
			}
			for ; j < len(pattern) && pattern[j] != ']'; j++ {
				if pattern[j] == '\\' {
					j++
					if j < len(pattern) {
						regexBuilder.WriteString(regexp.QuoteMeta(string(pattern[j])))
					}
				} else {
					regexBuilder.WriteByte(pattern[j])
				}
			}
			if j < len(pattern) {
				regexBuilder.WriteString("]")
				i = j
			}
		default:
			regexBuilder.WriteString(regexp.QuoteMeta(string(pattern[i])))
		}
	}
	regexBuilder.WriteString("$")

	regex, err := regexp.Compile(regexBuilder.String())
	if err != nil {
		return fmt.Errorf("invalid pattern: %s", err)
	}

	g.regex = regex
	// Store in cache
	g.patternCache.Store(g.pattern, regex)
	return nil
}

// Match checks if the given path matches the glob pattern
func (g *glob) Match(path string) bool {
	return g.regex.MatchString(path)
}

// Find returns all files that match the glob pattern
func (g *glob) Find() ([]string, error) {
	matches := make([]string, 0, 100) // Pre-allocate with reasonable capacity
	root := "."

	// If pattern starts with a specific directory, use it as root
	if idx := strings.Index(g.pattern, "/*"); idx > 0 {
		root = g.pattern[:idx]
	}

	// Use a buffer pool for path normalization
	bufferPool := sync.Pool{
		New: func() interface{} {
			return new(strings.Builder)
		},
	}

	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip directories early
		if info.IsDir() {
			return nil
		}

		// Get a buffer from the pool
		builder := bufferPool.Get().(*strings.Builder)
		builder.Reset()

		// Normalize path separators more efficiently
		for _, c := range path {
			if c == '\\' {
				builder.WriteRune('/')
			} else {
				builder.WriteRune(c)
			}
		}
		normalizedPath := builder.String()

		// Return buffer to pool
		bufferPool.Put(builder)

		if normalizedPath == "." {
			return nil
		}

		if g.Match(normalizedPath) {
			matches = append(matches, normalizedPath)
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	return matches, nil
}

// expandBraces handles brace expansion (e.g., {js,jsx,ts,tsx})
func (g *glob) expandBraces(pattern string) (string, error) {
	if !strings.Contains(pattern, "{") {
		return pattern, nil
	}

	// Use pre-allocated buffer for building alternatives
	var builder strings.Builder
	builder.Grow(len(pattern) * 2)

	start := strings.Index(pattern, "{")
	if start == -1 {
		return pattern, nil
	}

	end := g.findClosingBrace(pattern, start)
	if end == -1 {
		return "", fmt.Errorf("unclosed brace in pattern")
	}

	prefix := pattern[:start]
	suffix := pattern[end+1:]
	options := strings.Split(pattern[start+1:end], ",")

	builder.WriteString("(?:")
	for i, opt := range options {
		if i > 0 {
			builder.WriteString("|")
		}
		// Recursively expand nested braces
		expanded, err := g.expandBraces(prefix + opt + suffix)
		if err != nil {
			return "", err
		}
		builder.WriteString(expanded)
	}
	builder.WriteString(")")

	return builder.String(), nil
}

// findClosingBrace finds the matching closing brace
func (g *glob) findClosingBrace(pattern string, start int) int {
	depth := 1
	for i := start + 1; i < len(pattern); i++ {
		switch pattern[i] {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return i
			}
		}
	}
	return -1
}
