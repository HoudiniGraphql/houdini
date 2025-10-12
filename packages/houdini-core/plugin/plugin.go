package plugin

import (
	"fmt"
	"maps"

	"github.com/joho/godotenv"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins"
)

type HoudiniCore struct {
	plugins.Plugin[config.PluginConfig]
}

func (p *HoudiniCore) Name() string {
	return "houdini-core"
}

func (p *HoudiniCore) Order() plugins.PluginOrder {
	return plugins.PluginOrderCore
}

func (p *HoudiniCore) Environment(mode string) (map[string]string, error) {
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
		maps.Copy(result, env)
	}

	// we're done
	return result, nil
}
