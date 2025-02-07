package main

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"code.houdinigraphql.com/packages/houdini-core/glob"
	"code.houdinigraphql.com/plugins"
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

	// walk down the project directory and find all of the files that we care about
	err = matcher.Walk(context.Background(), result.Config.ProjectRoot, func(filepath string) error {
		fmt.Println(filepath)
		return nil
	})
	if err != nil {
		return err
	}

	// we're done
	return nil
}

// extractGraphQLStrings searches for all instances of a call to `graphql(` ... `)`
// and returns a slice containing the captured GraphQL query/mutation strings.
// It also unescapes any embedded backticks (i.e. replaces "\`" with "`").
func extractGraphQLStrings(content string) ([]string, error) {
	matches := graphqlRegex.FindAllStringSubmatch(content, -1)
	var result []string
	for _, m := range matches {
		// m[0] is the full match, m[1] is the captured GraphQL string.
		if len(m) > 1 {
			extracted := m[1]
			// Unescape any embedded backticks.
			extracted = strings.ReplaceAll(extracted, "\\`", "`")
			result = append(result, extracted)
		}
	}
	return result, nil
}

// graphqlRegex is a package-level variable that holds the compiled regex.
var graphqlRegex *regexp.Regexp

// init compiles the regex pattern once when the package is initialized.
func init() {
	pattern := "(?s)graphql\\s*\\(\\s*`((?:\\\\`|[^`])*)`\\s*\\)"
	var err error
	graphqlRegex, err = regexp.Compile(pattern)
	if err != nil {
		panic("Failed to compile graphql regex: " + err.Error())
	}
}
