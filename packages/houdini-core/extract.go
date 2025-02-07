package main

import (
	"fmt"

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

	// walk down the project directory and find all of the files that we care about
	err = matcher.Walk(afero.NewOsFs(), result.Config.ProjectRoot, func(filepath string) error {
		fmt.Println(filepath)
		return nil
	})
	if err != nil {
		return err
	}

	// we're done
	return nil
}
