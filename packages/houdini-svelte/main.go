package main

import (
	"fmt"
	"os"

	"code.houdinigraphql.com/packages/houdini-svelte/plugin"
	"code.houdinigraphql.com/plugins"

	"github.com/spf13/afero"
)

func main() {
	// set up the plugin
	svelte := &plugin.HoudiniSvelte{}
	svelte.SetFilesystem(afero.NewOsFs())

	// run the plugin
	err := plugins.Run(svelte)
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
