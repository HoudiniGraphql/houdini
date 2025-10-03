package main

import (
	"fmt"
	"os"

	"github.com/spf13/afero"

	"code.houdinigraphql.com/packages/houdini-react/plugin"
	"code.houdinigraphql.com/plugins"
)

func main() {
	// run the plugin
	err := plugins.Run(&plugin.HoudiniReact{
		Fs: afero.NewOsFs(),
	})
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
