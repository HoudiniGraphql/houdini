package main

import "fmt"

// componentFieldFragmentName returns the name of the fragment that holds the component field information
func componentFieldFragmentName(typ string, field string) string {
	return fmt.Sprintf("__componentField__%s_%s", typ, field)
}

const componentScalar = "Component"

const listDirective = "list"

const paginationDirective = "paginate"

const prependDirective = "prepend"

const appendDirective = "append"

const dedupeDirective = "dedupe"

const optimisticKeyDirective = "optimisticKey"

const allListsDirective = "allLists"

const parentIDDirective = "parentID"

const whenDirective = "when"

const whenNotDirective = "when_not"

const argumentsDirective = "arguments"

const withDirective = "with"

const cacheDirective = "cache"

const enableMaskDirective = "mask_enable"

const disableMaskDirective = "mask_disable"

const loadingDirective = "loading"

const requiredDirective = "required"

const componentFieldDirective = "componentField"

const runtimeScalarDirective = "__houdini__runtimeScalar"
