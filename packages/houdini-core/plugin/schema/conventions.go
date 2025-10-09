package schema

// Re-export all constants from the plugins/schema package for backwards compatibility
import "code.houdinigraphql.com/plugins/schema"

// Re-export the function
var ComponentFieldFragmentName = schema.ComponentFieldFragmentName

// Re-export all constants
const ComponentScalar = schema.ComponentScalar
const ListDirective = schema.ListDirective
const PaginationDirective = schema.PaginationDirective
const PrependDirective = schema.PrependDirective
const AppendDirective = schema.AppendDirective
const DedupeDirective = schema.DedupeDirective
const OptimisticKeyDirective = schema.OptimisticKeyDirective
const AllListsDirective = schema.AllListsDirective
const ParentIDDirective = schema.ParentIDDirective
const WhenDirective = schema.WhenDirective
const WhenNotDirective = schema.WhenNotDirective
const ArgumentsDirective = schema.ArgumentsDirective
const WithDirective = schema.WithDirective
const CacheDirective = schema.CacheDirective
const EnableMaskDirective = schema.EnableMaskDirective
const DisableMaskDirective = schema.DisableMaskDirective
const LoadingDirective = schema.LoadingDirective
const RequiredDirective = schema.RequiredDirective
const ComponentFieldDirective = schema.ComponentFieldDirective
const RuntimeScalarDirective = schema.RuntimeScalarDirective
const ListOperationSuffixInsert = schema.ListOperationSuffixInsert
const ListOperationSuffixRemove = schema.ListOperationSuffixRemove
const ListOperationSuffixToggle = schema.ListOperationSuffixToggle
const ListOperationSuffixDelete = schema.ListOperationSuffixDelete
const PaginationModeInfinite = schema.PaginationModeInfinite
const PaginationModeSinglePage = schema.PaginationModeSinglePage

// Re-export the function
var FragmentPaginationQueryName = schema.FragmentPaginationQueryName
