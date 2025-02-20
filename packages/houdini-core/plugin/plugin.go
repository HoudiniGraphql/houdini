package plugin

import (
	"fmt"

	"code.houdinigraphql.com/plugins"
	"github.com/joho/godotenv"
	"github.com/spf13/afero"
)

type HoudiniCore struct {
	plugins.Plugin[PluginConfig]
	Fs afero.Fs
}

type PluginConfig = any

func (p *HoudiniCore) Name() string {
	return "houdini-core"
}

func (p *HoudiniCore) SetFs(fs afero.Fs) {
	p.Fs = fs
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
		for k, v := range env {
			result[k] = v
		}
	}

	// we're done
	return result, nil
}
