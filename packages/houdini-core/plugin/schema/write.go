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

		isOperation := false
		if schema.Query != nil && typ.Name == schema.Query.Name {
			isOperation = true
		} else if schema.Mutation != nil && typ.Name == schema.Mutation.Name {
			isOperation = true
		} else if schema.Subscription != nil && typ.Name == schema.Subscription.Name {
			isOperation = true
		}

		// insert the type row
		err := db.ExecStatement(statements.InsertType, map[string]interface{}{
			"name":      typ.Name,
			"kind":      kind,
			"operation": isOperation,
		})
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
				err = db.ExecStatement(statements.InsertEnumValue, map[string]interface{}{
					"parent": typ.Name,
					"value":  value.Name,
				})
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
				err = db.ExecStatement(statements.InsertTypeField, map[string]interface{}{
					"id":             fieldID,
					"parent":         typ.Name,
					"name":           field.Name,
					"type":           fieldTypeName,
					"type_modifiers": fieldTypeModifiers,
					"description":    field.Description,
				})
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
					err = db.ExecStatement(statements.InsertFieldArgument, map[string]interface{}{
						"id":             fmt.Sprintf("%s.%s", fieldID, arg.Name),
						"field":          fieldID,
						"name":           arg.Name,
						"type":           variableType,
						"type_modifiers": typeModifiers,
					})
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

			if !typ.BuiltIn {
				// make sure that we can always ask for the __typename of an object
				err = db.ExecStatement(statements.InsertTypeField, map[string]interface{}{
					"id":             fmt.Sprintf("%s.__typename", typ.Name),
					"parent":         typ.Name,
					"name":           "__typename",
					"type":           "String",
					"type_modifiers": "!",
					"description":    "",
				})
			}

		case ast.InputObject:
			// insert input object fields
			for _, field := range typ.Fields {
				fieldTypeName, fieldTypeModifiers := ParseFieldType(field.Type.String())
				fieldID := fmt.Sprintf("%s.%s", typ.Name, field.Name)
				err = db.ExecStatement(statements.InsertTypeField,
					map[string]interface{}{
						"id":             fieldID,
						"parent":         typ.Name,
						"name":           field.Name,
						"type":           fieldTypeName,
						"type_modifiers": fieldTypeModifiers,
						"default_value":  field.DefaultValue.String(),
						"description":    field.Description,
					})
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
				err = db.ExecStatement(statements.InsertTypeField,
					map[string]interface{}{
						"id":             fieldID,
						"parent":         typ.Name,
						"name":           field.Name,
						"type":           fieldTypeName,
						"type_modifiers": fieldTypeModifiers,
						"description":    field.Description,
					})
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
				err = db.ExecStatement(statements.InsertPossibleType, map[string]interface{}{
					"type":   typ.Name,
					"member": impl.Name,
				})
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

			if !typ.BuiltIn {
				// make sure that we can always ask for the __typename of an object
				err = db.ExecStatement(statements.InsertTypeField, map[string]interface{}{
					"id":             fmt.Sprintf("%s.__typename", typ.Name),
					"parent":         typ.Name,
					"name":           "__typename",
					"type":           "String",
					"type_modifiers": "!",
					"description":    "",
				})
			}

		case ast.Union:
			// implement the union members in a deferred pass
			for _, member := range schema.GetPossibleTypes(typ) {
				err = db.ExecStatement(statements.InsertPossibleType, map[string]interface{}{
					"type":   typ.Name,
					"member": member.Name,
				})
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

			if !typ.BuiltIn {
				// make sure that we can always ask for the __typename of an object
				err = db.ExecStatement(statements.InsertTypeField, map[string]interface{}{
					"id":             fmt.Sprintf("%s.__typename", typ.Name),
					"parent":         typ.Name,
					"name":           "__typename",
					"type":           "String",
					"type_modifiers": "!",
					"description":    "",
				})
			}

		}
	}

	// process directives
	for _, directive := range schema.Directives {
		err := db.ExecStatement(statements.InsertDirective, map[string]interface{}{
			"name":       directive.Name,
			"repeatable": directive.IsRepeatable,
		})
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
			err = db.ExecStatement(statements.InsertDirectiveLocation, map[string]interface{}{
				"directive": directive.Name,
				"location":  string(location),
			})
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
			argType, argTypeMOdifiers := ParseFieldType(arg.Type.String())
			err = db.ExecStatement(statements.InsertDirectiveArgument, map[string]interface{}{
				"directive":      directive.Name,
				"name":           arg.Name,
				"type":           argType,
				"type_modifiers": argTypeMOdifiers,
			})
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
	err = db.ExecStatement(statements.InsertInternalType, map[string]interface{}{
		"name": "ComponentFields",
		"kind": "SCALAR",
	})
	if err != nil {
		return err
	}

	// @list(name: String!) on FIELD_DEFINITION
	err = db.ExecStatement(statements.InsertInternalDirective, map[string]interface{}{
		"name":        ListDirective,
		"description": "@list is used to mark a field for the runtime as a place to add or remove entities in mutations",
		"visible":     false,
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, map[string]interface{}{
		"directive": ListDirective,
		"location":  "FIELD_DEFINITION",
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, map[string]interface{}{
		"directive":      ListDirective,
		"name":           "name",
		"type":           "String",
		"type_modifiers": "!",
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, map[string]interface{}{
		"directive": ListDirective,
		"name":      "connection",
		"type":      "Boolean",
	})
	if err != nil {
		return err
	}

	// PaginateMode scalar
	err = db.ExecStatement(statements.InsertInternalType, map[string]interface{}{
		"name": "PaginateMode",
		"kind": "ENUM",
	})
	if err != nil {
		return err
	}
	for _, value := range []string{"Infinite", "SinglePage"} {
		err = db.ExecStatement(statements.InsertEnumValue, map[string]interface{}{
			"parent": "PaginateMode",
			"value":  value,
		})
		if err != nil {
			return err
		}
	}

	// @paginate(name: String!, mode: PaginateMode) on FIELD
	err = db.ExecStatement(statements.InsertInternalDirective, map[string]interface{}{
		"name":        PaginationDirective,
		"description": "@paginate is used to to mark a field for pagination.",
		"visible":     true,
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, map[string]interface{}{
		"directive": PaginationDirective,
		"location":  "FIELD",
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, map[string]interface{}{
		"directive":      PaginationDirective,
		"name":           "name",
		"type":           "String",
		"type_modifiers": "!",
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, map[string]interface{}{
		"directive": PaginationDirective,
		"name":      "mode",
		"type":      "PaginateMode",
	})
	if err != nil {
		return err
	}

	// @prepend on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, map[string]interface{}{
		"name":        PrependDirective,
		"description": "@prepend is used to tell the runtime to add the result to the end of the list",
		"visible":     true,
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, map[string]interface{}{
		"directive": PrependDirective,
		"location":  "FRAGMENT_SPREAD",
	})
	if err != nil {
		return err
	}

	// @append on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, map[string]interface{}{
		"name":        AppendDirective,
		"description": "@append is used to tell the runtime to add the result to the start of the list",
		"visible":     true,
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, map[string]interface{}{
		"directive": AppendDirective,
		"location":  "FRAGMENT_SPREAD",
	})
	if err != nil {
		return err
	}

	// DedupeMatchMode scalar
	err = db.ExecStatement(statements.InsertInternalType, map[string]interface{}{
		"name": "DedupeMatchMode",
		"kind": "ENUM",
	})
	if err != nil {
		return err
	}
	for _, value := range []string{"Variables", "Operation", "None"} {
		err = db.ExecStatement(statements.InsertEnumValue, map[string]interface{}{
			"parent": "DedupeMatchMode",
			"value":  value,
		})
		if err != nil {
			return err
		}
	}

	// @dedupe(cancelFirst: Boolean, match: DedupeMatchMode) on QUERY and MUTATION
	err = db.ExecStatement(statements.InsertInternalDirective, map[string]interface{}{
		"name": DedupeDirective,
		"description": `@dedupe is used to prevent an operation from running more than once at the same time. true
If the cancelFirst arg is set to true, the response already in flight will be canceled instead of the second one.
If match is set to Operation, then a request will be deduplicated any time there is a request with the same operation.
If it's set to Variables then the request will only be deduplicated if the variables match. If match is set to None,
then the request will never be deduplicated.`,
		"visible": true,
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, map[string]interface{}{
		"directive": DedupeDirective,
		"location":  "QUERY",
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, map[string]interface{}{
		"directive": DedupeDirective,
		"location":  "MUTATION",
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, map[string]interface{}{
		"directive": DedupeDirective,
		"name":      "cancelFirst",
		"type":      "Boolean",
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, map[string]interface{}{
		"directive": DedupeDirective,
		"name":      "match",
		"type":      "DedupeMatchMode",
	})
	if err != nil {
		return err
	}

	// @optimisticKey on FIELD
	err = db.ExecStatement(statements.InsertInternalDirective, map[string]interface{}{
		"name":        OptimisticKeyDirective,
		"description": "@optimisticKey is used to tell the runtime to use the value of the field as the key for optimistic updates.",
		"visible":     true,
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, map[string]interface{}{
		"directive": OptimisticKeyDirective,
		"location":  "FIELD",
	})
	if err != nil {
		return err
	}

	// @allLists on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, map[string]interface{}{
		"name":        AllListsDirective,
		"description": "@allLists is used to tell the runtime to add the result to all lists in the cache.",
		"visible":     true,
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, map[string]interface{}{
		"directive": AllListsDirective,
		"location":  "FRAGMENT_SPREAD",
	})

	// @parentID(value: ID!) on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, map[string]interface{}{
		"name":        ParentIDDirective,
		"description": "@parentID is used to provide a parentID without specifying position or in situations where it doesn't make sense (eg when deleting a node.)",
		"visible":     true,
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, map[string]interface{}{
		"directive": ParentIDDirective,
		"location":  "FRAGMENT_SPREAD",
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, map[string]interface{}{
		"directive":      ParentIDDirective,
		"name":           "value",
		"type":           "ID",
		"type_modifiers": "!",
	})
	if err != nil {
		return err
	}

	// @when on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, map[string]interface{}{
		"name":        WhenDirective,
		"description": "@when is used to provide a conditional or in situations where it doesn't make sense (eg when removing or deleting a node.)",
		"visible":     true,
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, map[string]interface{}{
		"directive": WhenDirective,
		"location":  "FRAGMENT_SPREAD",
	})

	// @when_not on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, map[string]interface{}{
		"name":        WhenNotDirective,
		"description": "@when_not is used to provide a conditional or in situations where it doesn't make sense (eg when removing or deleting a node.)",
		"visible":     true,
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, map[string]interface{}{
		"directive": WhenNotDirective,
		"location":  "FRAGMENT_SPREAD",
	})

	// @arguments on FRAGMENT_DEFINITION
	err = db.ExecStatement(statements.InsertInternalDirective, map[string]interface{}{
		"name":        ArgumentsDirective,
		"description": "@arguments is used to define the arguments of a fragment.",
		"visible":     true,
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, map[string]interface{}{
		"directive": ArgumentsDirective,
		"location":  "FRAGMENT_DEFINITION",
	})
	if err != nil {
		return err
	}

	// @with on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, map[string]interface{}{
		"name":        WithDirective,
		"description": "@with  is used to provide arguments to fragments that have been marked with @arguments",
		"visible":     true,
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, map[string]interface{}{
		"directive": WithDirective,
		"location":  "FRAGMENT_SPREAD",
	})
	if err != nil {
		return err
	}

	// CachePolicy enum
	err = db.ExecStatement(statements.InsertInternalType, map[string]interface{}{
		"name": "CachePolicy",
		"kind": "ENUM",
	})
	if err != nil {
		return err
	}
	for _, value := range []string{"CacheAndNetwork", "CacheOnly", "CacheOrNetwork", "NetworkOnly", "NoCache"} {
		err = db.ExecStatement(statements.InsertEnumValue, map[string]interface{}{
			"parent": "CachePolicy",
			"value":  value,
		})
		if err != nil {
			return err
		}
	}

	// @cache(policy: CachePolicy, partial: Boolean) on QUERY
	err = db.ExecStatement(statements.InsertInternalDirective, map[string]interface{}{
		"name":        CacheDirective,
		"description": "@cache is is used to specify cache rules for a query",
		"visible":     true,
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, map[string]interface{}{
		"directive": CacheDirective,
		"location":  "QUERY",
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, map[string]interface{}{
		"directive": CacheDirective,
		"name":      "policy",
		"type":      "CachePolicy",
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, map[string]interface{}{
		"directive": CacheDirective,
		"name":      "partial",
		"type":      "Boolean",
	})
	if err != nil {
		return err
	}

	// @mask_enable on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, map[string]interface{}{
		"name":        EnableMaskDirective,
		"description": "@mask_enable is used to to enable masking on fragment (overwriting the global conf)",
		"visible":     true,
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, map[string]interface{}{
		"directive": EnableMaskDirective,
		"location":  "FRAGMENT_SPREAD",
	})
	if err != nil {
		return err
	}

	// @mask_disable on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, map[string]interface{}{
		"name":        DisableMaskDirective,
		"description": "@mask_disable is used to to disable masking on fragment (overwriting the global conf)",
		"visible":     true,
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, map[string]interface{}{
		"directive": DisableMaskDirective,
		"location":  "FRAGMENT_SPREAD",
	})
	if err != nil {
		return err
	}

	// @loading(count: Int, cascade: Boolean) on QUERY | FIELD | FRAGMENT_DEFINITION | FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, map[string]interface{}{
		"name":        LoadingDirective,
		"description": "@loading is used to shape the value of your documents while they are loading",
		"visible":     true,
	})
	if err != nil {
		return err
	}
	for _, loc := range []string{"FRAGMENT_SPREAD", "QUERY", "FIELD", "FRAGMENT_DEFINITION"} {
		err = db.ExecStatement(statements.InsertDirectiveLocation, map[string]interface{}{
			"directive": LoadingDirective,
			"location":  loc,
		})
		if err != nil {
			return err
		}
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, map[string]interface{}{
		"directive": LoadingDirective,
		"name":      "count",
		"type":      "Int",
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, map[string]interface{}{
		"directive": LoadingDirective,
		"name":      "cascade",
		"type":      "Boolean",
	})
	if err != nil {
		return err
	}

	// @required on FIELD
	err = db.ExecStatement(statements.InsertInternalDirective, map[string]interface{}{
		"name":        RequiredDirective,
		"description": "@required makes a nullable field always non-null by making the parent null when the field is",
		"visible":     true,
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, map[string]interface{}{
		"directive": RequiredDirective,
		"location":  "FIELD",
	})
	if err != nil {
		return err
	}

	// @componentField(prop: String, field: String) on FRAGMENT_DEFINITION | INLINE_FRAGMENT | FIELD_DEFINITION
	err = db.ExecStatement(statements.InsertInternalDirective, map[string]interface{}{
		"name":        ComponentFieldDirective,
		"description": "@componentField is used to mark a field as a component field",
		"visible":     true,
	})
	if err != nil {
		return err
	}
	for _, loc := range []string{"FRAGMENT_DEFINITION", "INLINE_FRAGMENT", "FIELD_DEFINITION"} {
		err = db.ExecStatement(statements.InsertDirectiveLocation, map[string]interface{}{
			"directive": ComponentFieldDirective,
			"location":  loc,
		})
		if err != nil {
			return err
		}
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, map[string]interface{}{
		"directive": ComponentFieldDirective,
		"name":      "prop",
		"type":      "String",
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, map[string]interface{}{
		"directive": ComponentFieldDirective,
		"name":      "field",
		"type":      "String",
	})
	if err != nil {
		return err
	}

	// we need a directive to register runtime scalars but it shouldn't end up in the generated schema
	// @runtimeScalar(name: String!) on QUERY
	err = db.ExecStatement(statements.InsertInternalDirective, map[string]interface{}{
		"name":        RuntimeScalarDirective,
		"description": "@runtimeScalar is used to register a scalar with the runtime",
		"visible":     false,
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, map[string]interface{}{
		"directive": RuntimeScalarDirective,
		"location":  "QUERY",
	})
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, map[string]interface{}{
		"directive":      RuntimeScalarDirective,
		"name":           "type",
		"type":           "String",
		"type_modifiers": "!",
	})
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
