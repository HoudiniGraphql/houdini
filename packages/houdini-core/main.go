package main

import (
	"code.houdinigraphql.com/plugins"
)

func main() {
	plugins.Run(HoudiniCore{})
}

type HoudiniCore struct{}

func (p HoudiniCore) Name() string {
	return "houdini-core"
}
