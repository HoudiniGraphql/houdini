package main

import (
	"fmt"
	"os"

	"github.com/spf13/afero"

	"code.houdinigraphql.com/packages/houdini-react/plugin"
	"code.houdinigraphql.com/plugins"
)

func main() {
	fs := afero.NewOsFs()
	p := &plugin.HoudiniReact{}
	p.SetFilesystem(fs)
	err := plugins.Run(p)
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
