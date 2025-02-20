package schema

import (
	"fmt"
	"regexp"

	"code.houdinigraphql.com/plugins"
	"github.com/vektah/gqlparser/v2/ast"
)

func WriteProjectSchema[PluginConfig any](schemaPath string, db plugins.DatabasePool[PluginConfig], schema *ast.Schema, statements SchemaInsertStatements, errors *plugins.ErrorList) {
	// in a single pass over all types, insert the type and any associated details.
	// the type references are deferrable foreign keys, so we can insert them in any order
	for _, typ := range schema.Types {
		// Determine the kind string
		var kind string
		switch typ.Kind {
		case ast.Scalar:
			kind = "SCALAR"
		case ast.Enum:
			kind = "ENUM"
		case ast.Object:
			kind = "OBJECT"
		case ast.Interface:
			kind = "INTERFACE"
		case ast.Union:
			kind = "UNION"
		case ast.InputObject:
			kind = "INPUT"
		default:
			continue
		}

		// insert the type row
		err := db.ExecStatement(statements.InsertType, typ.Name, kind)
		if err != nil {
			errors.Append(&plugins.Error{
				Message: fmt.Sprintf("could not register type %s", typ.Name),
				Detail:  err.Error(),
				Locations: []*plugins.ErrorLocation{
					{
						Filepath: schemaPath,
						Line:     typ.Position.Line,
						Column:   typ.Position.Column,
					},
				},
			})
			continue
		}

		// insert additional details based on type kind
		switch typ.Kind {
		case ast.Enum:
			// insert enum values
			for _, value := range typ.EnumValues {
				err = db.ExecStatement(statements.InsertEnumValue, typ.Name, value.Name)
				if err != nil {
					errors.Append(&plugins.Error{
						Message: fmt.Sprintf("error inserting enum value %s for %s", value.Name, typ.Name),
						Detail:  err.Error(),
						Locations: []*plugins.ErrorLocation{
							{
								Filepath: schemaPath,
								Line:     typ.Position.Line,
								Column:   typ.Position.Column,
							},
						},
					})
					continue
				}
			}

		case ast.Object:
			// insert fields and their arguments
			for _, field := range typ.Fields {
				fieldTypeName, fieldTypeModifiers := ParseFieldType(field.Type.String())

				fieldID := fmt.Sprintf("%s.%s", typ.Name, field.Name)
				err = db.ExecStatement(statements.InsertTypeField, fieldID, typ.Name, field.Name, fieldTypeName, fieldTypeModifiers, "", field.Description)
				if err != nil {
					errors.Append(&plugins.Error{
						Message: fmt.Sprintf("error registering field %s for object %s", field.Name, typ.Name),
						Detail:  err.Error(),
						Locations: []*plugins.ErrorLocation{
							{
								Filepath: schemaPath,
								Line:     field.Position.Line,
								Column:   field.Position.Column,
							},
						},
					})
					continue
				}
				for _, arg := range field.Arguments {

					variableType, typeModifiers := ParseFieldType(arg.Type.String())
					err = db.ExecStatement(statements.InsertFieldArgument, fieldID, arg.Name, variableType, "", typeModifiers)
					if err != nil {
						errors.Append(&plugins.Error{
							Message: fmt.Sprintf("error inserting field argument %s for %s", arg.Name, fieldID),
							Detail:  err.Error(),
							Locations: []*plugins.ErrorLocation{
								{
									Filepath: schemaPath,
									Line:     arg.Position.Line,
									Column:   arg.Position.Column,
								},
							},
						})
						continue
					}
				}
			}

		case ast.InputObject:
			// insert input object fields
			for _, field := range typ.Fields {
				fieldTypeName, fieldTypeModifiers := ParseFieldType(field.Type.String())
				fieldID := fmt.Sprintf("%s.%s", typ.Name, field.Name)
				err = db.ExecStatement(statements.InsertTypeField, fieldID, typ.Name, field.Name, fieldTypeName, fieldTypeModifiers, field.DefaultValue.String(), field.Description)
				if err != nil {
					errors.Append(&plugins.Error{
						Message: fmt.Sprintf("error inserting input field %s for %s", field.Name, typ.Name),
						Detail:  err.Error(),
						Locations: []*plugins.ErrorLocation{
							{
								Filepath: schemaPath,
								Line:     field.Position.Line,
								Column:   field.Position.Column,
							},
						},
					})
					continue
				}
			}

		case ast.Interface:
			// insert interface fields
			for _, field := range typ.Fields {
				fieldTypeName, fieldTypeModifiers := ParseFieldType(field.Type.String())
				fieldID := fmt.Sprintf("%s.%s", typ.Name, field.Name)
				err = db.ExecStatement(statements.InsertTypeField, fieldID, typ.Name, field.Name, fieldTypeName, fieldTypeModifiers, "", field.Description)
				if err != nil {
					errors.Append(&plugins.Error{
						Message: fmt.Sprintf("error inserting interface field %s for %s", field.Name, typ.Name),
						Detail:  err.Error(),
						Locations: []*plugins.ErrorLocation{
							{
								Filepath: schemaPath,
								Line:     field.Position.Line,
								Column:   field.Position.Column,
							},
						},
					})
					continue
				}
			}

			// add the interface implementors
			for _, impl := range schema.GetPossibleTypes(typ) {
				err = db.ExecStatement(statements.InsertPossibelType, typ.Name, impl.Name)
				if err != nil {
					errors.Append(&plugins.Error{
						Message: fmt.Sprintf("error linking interface %s with implementor %s", typ.Name, impl.Name),
						Detail:  err.Error(),
						Locations: []*plugins.ErrorLocation{
							{
								Filepath: schemaPath,
								Line:     impl.Position.Line,
								Column:   impl.Position.Column,
							},
						},
					})
					continue
				}
			}

		case ast.Union:
			// implement the union members in a deferred pass
			for _, member := range schema.GetPossibleTypes(typ) {
				err = db.ExecStatement(statements.InsertPossibelType, typ.Name, member.Name)
				if err != nil {
					errors.Append(&plugins.Error{
						Message: fmt.Sprintf("error linking union %s with member %s", typ.Name, member.Name),
						Detail:  err.Error(),
						Locations: []*plugins.ErrorLocation{
							{
								Filepath: schemaPath,
								Line:     member.Position.Line,
								Column:   member.Position.Column,
							},
						},
					})
					continue
				}
			}
		}
	}

	// process directives
	for _, directive := range schema.Directives {
		err := db.ExecStatement(statements.InsertDirective, directive.Name, directive.IsRepeatable)
		if err != nil {
			errors.Append(&plugins.Error{
				Message: fmt.Sprintf("error inserting directive %s", directive.Name),
				Detail:  err.Error(),
				Locations: []*plugins.ErrorLocation{
					{
						Filepath: schemaPath,
						Line:     directive.Position.Line,
						Column:   directive.Position.Column,
					},
				},
			})
			continue
		}
		for _, location := range directive.Locations {
			err = db.ExecStatement(statements.InsertDirectiveLocation, directive.Name, string(location))
			if err != nil {
				errors.Append(&plugins.Error{
					Message: fmt.Sprintf("error inserting directive location %s for %s", location, directive.Name),
					Detail:  err.Error(),
					Locations: []*plugins.ErrorLocation{
						{
							Filepath: schemaPath,
							Line:     directive.Position.Line,
							Column:   directive.Position.Column,
						},
					},
				})
				continue
			}
		}
		for _, arg := range directive.Arguments {
			err = db.ExecStatement(statements.InsertDirectiveArgument, directive.Name, arg.Name, arg.Type.String(), "")
			if err != nil {
				errors.Append(&plugins.Error{
					Message: fmt.Sprintf("error inserting directive argument %s for %s", arg.Name, directive.Name),
					Detail:  err.Error(),
					Locations: []*plugins.ErrorLocation{
						{
							Filepath: schemaPath,
							Line:     arg.Position.Line,
							Column:   arg.Position.Column,
						},
					},
				})
				continue
			}
		}
	}

	// we're done
	return
}

// write the houdini internal schema bits
func WriteInternalSchema[PluginConfig any](db plugins.DatabasePool[PluginConfig], statements SchemaInsertStatements) error {
	var err error

	// Add the ComponentFields scalar
	err = db.ExecStatement(statements.InsertInternalType, ComponentScalar, "SCALAR")
	if err != nil {
		return err
	}

	// @list(name: String!) on FIELD_DEFINITION
	err = db.ExecStatement(statements.InsertInternalDirective, ListDirective, "@list is used to mark a field for "+
		"the runtime as a place to add or remove entities in mutations")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, ListDirective, "FIELD_DEFINITION")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, ListDirective, "name", "String!", nil)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, ListDirective, "connection", "Boolean", nil)
	if err != nil {
		return err
	}

	// PaginateMode scalar
	err = db.ExecStatement(statements.InsertInternalType, "PaginateMode", "ENUM")
	if err != nil {
		return err
	}
	for _, value := range []string{"Infinite", "SinglePage"} {
		err = db.ExecStatement(statements.InsertEnumValue, "PaginateMode", value)
		if err != nil {
			return err
		}
	}

	// @paginate(name: String!, mode: PaginateMode) on FIELD
	err = db.ExecStatement(statements.InsertInternalDirective, PaginationDirective, "@paginate is used to to mark a field for pagination.", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, PaginationDirective, "FIELD")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, PaginationDirective, "name", "String!", nil)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, PaginationDirective, "mode", "PaginateMode", nil)
	if err != nil {
		return err
	}

	// @prepend on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, PrependDirective, "@prepend is used to tell the runtime to add the result to the end of the list", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, PrependDirective, "FRAGMENT_SPREAD")
	if err != nil {
		return err
	}

	// @append on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, AppendDirective, "@append is used to tell the runtime to add the result to the start of the list", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, AppendDirective, "FRAGMENT_SPREAD")
	if err != nil {
		return err
	}

	// DedupeMatchMode scalar
	err = db.ExecStatement(statements.InsertInternalType, "DedupeMatchMode", "ENUM")
	if err != nil {
		return err
	}
	for _, value := range []string{"Variables", "Operation", "None"} {
		err = db.ExecStatement(statements.InsertEnumValue, "DedupeMatchMode", value)
		if err != nil {
			return err
		}
	}

	// @dedupe(cancelFirst: Boolean, match: DedupeMatchMode) on QUERY and MUTATION
	err = db.ExecStatement(statements.InsertInternalDirective, DedupeDirective, `@dedupe is used to prevent an operation from running more than once at the same time. true
	If the cancelFirst arg is set to true, the response already in flight will be canceled instead of the second one.
	If match is set to Operation, then a request will be deduplicated any time there is a request with the same operation.
	If it's set to Variables then the request will only be deduplicated if the variables match. If match is set to None,
	then the request will never be deduplicated.`)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, DedupeDirective, "QUERY")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, DedupeDirective, "MUTATION")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, DedupeDirective, "cancelFirst", "Boolean", nil)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, DedupeDirective, "match", "DedupeMatchMode", nil)
	if err != nil {
		return err
	}

	// @optimisticKey on FIELD
	err = db.ExecStatement(statements.InsertInternalDirective, OptimisticKeyDirective, "@optimisticKey is used to tell the runtime to use the value of the field as the key for optimistic updates.", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, OptimisticKeyDirective, "FIELD")
	if err != nil {
		return err
	}

	// @allLists on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, AllListsDirective, "@allLists is used to tell the runtime to add the result to all lists in the cache.", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, AllListsDirective, "FRAGMENT_SPREAD")

	// @parentID(value: ID!) on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, ParentIDDirective, "@parentID is used to provide a parentID without specifying position or in situations where it doesn't make sense (eg when deleting a node.)", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, ParentIDDirective, "FRAGMENT_SPREAD")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, ParentIDDirective, "value", "ID!", nil)
	if err != nil {
		return err
	}

	// @when on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, WhenDirective, "@when is used to provide a conditional or in situations where it doesn't make sense (eg when removing or deleting a node.)", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, WhenDirective, "FRAGMENT_SPREAD")

	// @when_not on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, WhenNotDirective, "@when_not is used to provide a conditional or in situations where it doesn't make sense (eg when removing or deleting a node.)", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, WhenNotDirective, "FRAGMENT_SPREAD")

	// @arguments on FRAGMENT_DEFINITION
	err = db.ExecStatement(statements.InsertInternalDirective, ArgumentsDirective, "@arguments is used to define the arguments of a fragment.", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, ArgumentsDirective, "FRAGMENT_DEFINITION")
	if err != nil {
		return err
	}

	// @with on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, WithDirective, "@with  is used to provide arguments to fragments that have been marked with @arguments", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, WithDirective, "FRAGMENT_SPREAD")
	if err != nil {
		return err
	}

	// CachePolicy enum
	err = db.ExecStatement(statements.InsertInternalType, "CachePolicy", "ENUM")
	if err != nil {
		return err
	}
	for _, value := range []string{"CacheAndNetwork", "CacheOnly", "CacheOrNetwork", "NetworkOnly", "NoCache"} {
		err = db.ExecStatement(statements.InsertEnumValue, "CachePolicy", value)
		if err != nil {
			return err
		}
	}

	// @cache(policy: CachePolicy, partial: Boolean) on QUERY
	err = db.ExecStatement(statements.InsertInternalDirective, CacheDirective, "@cache is is used to specify cache rules for a query", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, CacheDirective, "QUERY")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, CacheDirective, "policy", "CachePolicy", nil)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, CacheDirective, "partial", "Boolean", nil)
	if err != nil {
		return err
	}

	// @mask_enable on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, EnableMaskDirective, "@mask_enable is used to to enable masking on fragment (overwriting the global conf)", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, EnableMaskDirective, "FRAGMENT_SPREAD")
	if err != nil {
		return err
	}

	// @mask_disable on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, DisableMaskDirective, "@mask_disable is used to to disable masking on fragment (overwriting the global conf)", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, DisableMaskDirective, "FRAGMENT_SPREAD")
	if err != nil {
		return err
	}

	// @loading(count: Int, cascade: Boolean) on QUERY | FIELD | FRAGMENT_DEFINITION | FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, LoadingDirective, "@loading is used to shape the value of your documents while they are loading", true)
	if err != nil {
		return err
	}
	for _, loc := range []string{"FRAGMENT_SPREAD", "QUERY", "FIELD", "FRAGMENT_DEFINITION"} {
		err = db.ExecStatement(statements.InsertDirectiveLocation, LoadingDirective, loc)
		if err != nil {
			return err
		}
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, LoadingDirective, "count", "Int", nil)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, LoadingDirective, "cascade", "Boolean", nil)
	if err != nil {
		return err
	}

	// @required on FIELD
	err = db.ExecStatement(statements.InsertInternalDirective, RequiredDirective, "@required makes a nullable field always non-null by making the parent null when the field is", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, RequiredDirective, "FIELD")
	if err != nil {
		return err
	}

	// @componentField(prop: String, field: String) on FRAGMENT_DEFINITION | INLINE_FRAGMENT | FIELD_DEFINITION
	err = db.ExecStatement(statements.InsertInternalDirective, ComponentFieldDirective, "@componentField is used to mark a field as a component field", true)
	if err != nil {
		return err
	}
	for _, loc := range []string{"FRAGMENT_DEFINITION", "INLINE_FRAGMENT", "FIELD_DEFINITION"} {
		err = db.ExecStatement(statements.InsertDirectiveLocation, ComponentFieldDirective, loc)
		if err != nil {
			return err
		}
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, ComponentFieldDirective, "prop", "String", nil)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, ComponentFieldDirective, "field", "String", nil)
	if err != nil {
		return err
	}

	// we need a directive to register runtime scalars but it shouldn't end up in the generated schema
	// @runtimeScalar(name: String!) on QUERY
	err = db.ExecStatement(statements.InsertInternalDirective, RuntimeScalarDirective, "@runtimeScalar is used to register a scalar with the runtime", false)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, RuntimeScalarDirective, "QUERY")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, RuntimeScalarDirective, "type", "String!", nil)
	if err != nil {
		return err
	}

	// we're done
	return nil
}

// ParseFieldType parses a GraphQL type string into a base type
// and a “modifier” string. It assumes that the base type is a run
// of word characters (letters, digits, underscore) and that everything
// following the base type is the “wrapper” (for example, for list and non‑null markers).
//
// Examples:
//
//	"User"         -> ("User", "")
//	"User!"        -> ("User", "!")
//	"[User]"       -> ("User", "]")
//	"[User]!"      -> ("User", "]!")
//	"[User!]!"     -> ("User", "!]!")
//	"[[User]]"     -> ("User", "]]")
func ParseFieldType(s string) (base, modifier string) {
	// This regex skips any leading [, ], or ! characters, then captures
	// the first run of word characters (the base type), and then captures
	// everything that follows as the modifier.
	re := regexp.MustCompile(`^(?:[\[\]!]*)(\w+)(.*)$`)
	matches := re.FindStringSubmatch(s)
	if len(matches) < 3 {
		// If no match is found, return the input as the base with an empty modifier.
		return s, ""
	}
	return matches[1], matches[2]
}
