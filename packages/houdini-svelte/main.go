package main

import (
	"fmt"
	"os"

	"code.houdinigraphql.com/packages/houdini-svelte/plugin"
	"code.houdinigraphql.com/plugins"

	"github.com/spf13/afero"
)

func main() {
	// run the plugin
	err := plugins.Run(&plugin.HoudiniSvelte{
		Fs: afero.NewOsFs(),
	})
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
