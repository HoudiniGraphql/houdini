package schema

import "fmt"

// componentFieldFragmentName returns the name of the fragment that holds the component field information
func ComponentFieldFragmentName(typ string, field string) string {
	return fmt.Sprintf("__componentField__%s_%s", typ, field)
}

const ComponentScalar = "Component"

const ListDirective = "list"

const PaginationDirective = "paginate"

const PrependDirective = "prepend"

const AppendDirective = "append"

const DedupeDirective = "dedupe"

const OptimisticKeyDirective = "optimisticKey"

const AllListsDirective = "allLists"

const ParentIDDirective = "parentID"

const WhenDirective = "when"

const WhenNotDirective = "when_not"

const ArgumentsDirective = "arguments"

const WithDirective = "with"

const CacheDirective = "cache"

const EnableMaskDirective = "mask_enable"

const DisableMaskDirective = "mask_disable"

const LoadingDirective = "loading"

const RequiredDirective = "required"

const ComponentFieldDirective = "componentField"

const RuntimeScalarDirective = "__houdini__runtimeScalar"
