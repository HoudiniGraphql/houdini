package main

import (
	"code.houdinigraphql.com/plugins"

	"github.com/joho/godotenv"
)

func main() {
	plugins.Run(HoudiniCore{})
}

type HoudiniCore struct{}

func (p HoudiniCore) Name() string {
	return "houdini-core"
}

func (p HoudiniCore) Order() plugins.PluginOrder {
	return plugins.PluginOrderCore
}

func (p HoudiniCore) Environment() (map[string]string, error) {
	// we're going to emulate the vite rules laid out here: https://vite.dev/guide/env-and-mode
	env, _ := godotenv.Read(
		".env",
		".env.local",
	)
	if env == nil {
		env = make(map[string]string)
	}

	return env, nil
}
