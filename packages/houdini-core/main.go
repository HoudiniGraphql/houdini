package main

import (
	"fmt"
	"log"

	"code.houdinigraphql.com/plugins"

	"github.com/joho/godotenv"
)

func main() {
	db, err := plugins.ConnectDB()
	if err != nil {
		log.Fatal(err.Error())
	}
	defer db.Close()

	plugins.Run(HoudiniCore{DB: db})
}

type HoudiniCore struct {
	DB plugins.Database
}

func (p HoudiniCore) Name() string {
	return "houdini-core"
}

func (p HoudiniCore) Order() plugins.PluginOrder {
	return plugins.PluginOrderCore
}

func (p HoudiniCore) Environment(mode string) (map[string]string, error) {
	// build up the environment variables using the vite rules laid out here: https://vite.dev/guide/env-and-mode
	result := map[string]string{}

	// process each file and add the variables to the result
	for _, file := range []string{
		".env",
		".env.local",
		fmt.Sprintf(".env.%s", mode),
		fmt.Sprintf(".env.%s.local", mode),
	} {
		env, err := godotenv.Read(file)
		// if the file doesn't exist then we keep to keep going
		if err != nil {
			continue
		}

		// assign the variables to the result
		for k, v := range env {
			result[k] = v
		}
	}

	// we're done
	return result, nil
}

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

	matches := []string{}

	for _, include := range result.Config.Include {
		globMatches, err := Glob(include, result.Config.ProjectRoot)
		if err != nil {
			return err
		}

		for _, match := range globMatches {
			// if we were given an exclude then we need to check if the match is in the exclude list
			if len(result.Config.Exclude) > 0 {
				for _, exclude := range result.Config.Exclude {
					// use the glob package to check if the match is in the exclude list
					glob, err := newGlob(exclude, result.Config.ProjectRoot)
					if err != nil {
						return nil
					}
					if glob.Match(match) {
						continue
					}
				}
			}

			// we got passed the exclude filters, add it
			matches = append(matches, match)
		}
	}

	// now that we have all of the files, we need to parse them and extract the documents
	fmt.Println(matches)

	return nil
}
