package config

import (
	"strings"

	"code.houdinigraphql.com/plugins"
)

type PluginFramework = string

const (
	PluginFrameworkSvelte = "svelte"
	PluginFrameworkKit    = "kit"
)

type StorePaginationType = string

const (
	StorePaginationTypeNone   = ""
	StorePaginationTypeCursor = "cursor"
	StorePaginationTypeOffset = "offset"
)

type PluginConfig struct {
	Framework    PluginFramework        `json:"framework"`
	ClientPath   string                 `json:"client"`
	CustomStores PluginConfigStorePaths `json:"customStores"`
}

type PluginConfigStorePaths struct {
	Query          string `json:"query"`
	Mutation       string `json:"mutation"`
	Fragment       string `json:"fragment"`
	Subscription   string `json:"subscription"`
	QueryCursor    string `json:"queryCursor"`
	QueryOffset    string `json:"queryOffset"`
	FragmentCursor string `json:"fragmentCursor"`
	FragmentOffset string `json:"fragmentOffset"`
}

type Import struct {
	Name   string
	Module string
}

func (c PluginConfig) StoreBaseClassImport(
	documentType string,
	paginated StorePaginationType,
) (Import, error) {
	// the import specification is defined in the plugin config as <module>.<name>
	var importString string
	switch documentType {
	case "mutation":
		importString = c.CustomStores.Mutation
	case "subscription":
		importString = c.CustomStores.Subscription
	case "fragment":
		switch paginated {
		case StorePaginationTypeNone:
			importString = c.CustomStores.Fragment
		case StorePaginationTypeCursor:
			importString = c.CustomStores.FragmentCursor
		case StorePaginationTypeOffset:
			importString = c.CustomStores.FragmentOffset
		}
	case "query":
		switch paginated {
		case StorePaginationTypeNone:
			importString = c.CustomStores.Query
		case StorePaginationTypeCursor:
			importString = c.CustomStores.QueryCursor
		case StorePaginationTypeOffset:
			importString = c.CustomStores.QueryOffset
		}
	}

	parts := strings.Split(importString, "#")
	if len(parts) != 2 {
		return Import{}, plugins.Error{
			Message: "invalid store import specification: " + importString,
		}
	}

	return Import{
		Module: parts[0],
		Name:   parts[1],
	}, nil
}
