package main

import (
	"fmt"
	"os"

	"code.houdinigraphql.com/packages/houdini-core/plugin"
	"code.houdinigraphql.com/plugins"

	"github.com/spf13/afero"
)

func main() {
	// run the plugin
	core := &plugin.HoudiniCore{}
	core.SetFilesystem(afero.NewOsFs())
	err := plugins.Run(core)
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
