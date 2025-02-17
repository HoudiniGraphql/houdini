package main

import (
	"context"
	"fmt"
	"io"
	"path"
	"regexp"

	"code.houdinigraphql.com/plugins"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"zombiezen.com/go/sqlite/sqlitex"
)

// The core plugin is responsible for parsing the users schrma file and loading it into the database
func (p *HoudiniCore) Schema(ctx context.Context) error {
	// the first thing we have to do is import the schema from the database
	config, err := p.DB.ProjectConfig(ctx)
	if err != nil {
		return err
	}

	// grab a connection to the database for this
	conn, err := p.DB.Take(ctx)
	if err != nil {
		return err
	}
	defer p.DB.Put(conn)

	// read the schema file
	schemaPath := path.Join(config.ProjectRoot, config.SchemaPath)
	file, err := p.fs.Open(schemaPath)
	if err != nil {
		return plugins.Error{
			Message: "could not open schema file",
			Detail:  err.Error(),
			Locations: []*plugins.ErrorLocation{
				{
					Filepath: schemaPath,
				},
			},
		}
	}
	defer file.Close()
	fileContents, err := io.ReadAll(file)
	if err != nil {
		return plugins.Error{
			Message: "could not read schema file",
			Detail:  err.Error(),
			Locations: []*plugins.ErrorLocation{
				{
					Filepath: schemaPath,
				},
			},
		}
	}

	// parse and validate the schema
	schema, err := gqlparser.LoadSchema(&ast.Source{
		Input: string(fileContents),
	})
	if err != nil {
		return plugins.Error{
			Message: "encountered error parsing schema file",
			Detail:  err.Error(),
			Locations: []*plugins.ErrorLocation{
				{
					Filepath: schemaPath,
				},
			},
		}
	}

	// all of the schema operations are done in a transaction
	close := sqlitex.Transaction(conn)
	commit := func(err error) error {
		close(&err)
		return err
	}

	// prepare the statements we'll use
	statements, finalize := p.prepareSchemaInsertStatements(conn)
	defer finalize()

	// import the user's schema into the database
	errors := &plugins.ErrorList{}
	writeProjectSchema(schemaPath, p.DB, schema, statements, errors)
	if errors.Len() > 0 {
		return commit(err)
	}

	// write the internal schema
	err = writeInternalSchema(p.DB, statements)
	if err != nil {
		err = plugins.Error{
			Message: "encountered error adding internal schema elements",
			Detail:  err.Error(),
		}
		return commit(err)
	}

	// we're done
	return commit(nil)
}

func writeProjectSchema[PluginConfig any](schemaPath string, db plugins.DatabasePool[PluginConfig], schema *ast.Schema, statements SchemaInsertStatements, errors *plugins.ErrorList) {
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
			errors.Append(plugins.Error{
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
					errors.Append(plugins.Error{
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
				fieldTypeName, fieldTypeModifiers := parseFieldType(field.Type.String())

				fieldID := fmt.Sprintf("%s.%s", typ.Name, field.Name)
				err = db.ExecStatement(statements.InsertTypeField, fieldID, typ.Name, field.Name, fieldTypeName, fieldTypeModifiers, "", field.Description)
				if err != nil {
					errors.Append(plugins.Error{
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

					variableType, typeModifiers := parseFieldType(arg.Type.String())
					err = db.ExecStatement(statements.InsertFieldArgument, fieldID, arg.Name, variableType, "", typeModifiers)
					if err != nil {
						errors.Append(plugins.Error{
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
				fieldTypeName, fieldTypeModifiers := parseFieldType(field.Type.String())
				fieldID := fmt.Sprintf("%s.%s", typ.Name, field.Name)
				err = db.ExecStatement(statements.InsertTypeField, fieldID, typ.Name, field.Name, fieldTypeName, fieldTypeModifiers, field.DefaultValue.String(), field.Description)
				if err != nil {
					errors.Append(plugins.Error{
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
				fieldTypeName, fieldTypeModifiers := parseFieldType(field.Type.String())
				fieldID := fmt.Sprintf("%s.%s", typ.Name, field.Name)
				err = db.ExecStatement(statements.InsertTypeField, fieldID, typ.Name, field.Name, fieldTypeName, fieldTypeModifiers, "", field.Description)
				if err != nil {
					errors.Append(plugins.Error{
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
					errors.Append(plugins.Error{
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
					errors.Append(plugins.Error{
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
			errors.Append(plugins.Error{
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
				errors.Append(plugins.Error{
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
				errors.Append(plugins.Error{
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
func writeInternalSchema[PluginConfig any](db plugins.DatabasePool[PluginConfig], statements SchemaInsertStatements) error {
	var err error

	// Add the ComponentFields scalar
	err = db.ExecStatement(statements.InsertInternalType, componentScalar, "SCALAR")
	if err != nil {
		return err
	}

	// @list(name: String!) on FIELD_DEFINITION
	err = db.ExecStatement(statements.InsertInternalDirective, listDirective, "@list is used to mark a field for "+
		"the runtime as a place to add or remove entities in mutations")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, listDirective, "FIELD_DEFINITION")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, listDirective, "name", "String!", nil)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, listDirective, "connection", "Boolean", nil)
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
	err = db.ExecStatement(statements.InsertInternalDirective, paginationDirective, "@paginate is used to to mark a field for pagination.", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, paginationDirective, "FIELD")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, paginationDirective, "name", "String!", nil)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, paginationDirective, "mode", "PaginateMode", nil)
	if err != nil {
		return err
	}

	// @prepend on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, prependDirective, "@prepend is used to tell the runtime to add the result to the end of the list", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, prependDirective, "FRAGMENT_SPREAD")
	if err != nil {
		return err
	}

	// @append on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, appendDirective, "@append is used to tell the runtime to add the result to the start of the list", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, appendDirective, "FRAGMENT_SPREAD")
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
	err = db.ExecStatement(statements.InsertInternalDirective, dedupeDirective, `@dedupe is used to prevent an operation from running more than once at the same time. true
	If the cancelFirst arg is set to true, the response already in flight will be canceled instead of the second one.
	If match is set to Operation, then a request will be deduplicated any time there is a request with the same operation.
	If it's set to Variables then the request will only be deduplicated if the variables match. If match is set to None,
	then the request will never be deduplicated.`)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, dedupeDirective, "QUERY")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, dedupeDirective, "MUTATION")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, dedupeDirective, "cancelFirst", "Boolean", nil)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, dedupeDirective, "match", "DedupeMatchMode", nil)
	if err != nil {
		return err
	}

	// @optimisticKey on FIELD
	err = db.ExecStatement(statements.InsertInternalDirective, optimisticKeyDirective, "@optimisticKey is used to tell the runtime to use the value of the field as the key for optimistic updates.", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, optimisticKeyDirective, "FIELD")
	if err != nil {
		return err
	}

	// @allLists on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, allListsDirective, "@allLists is used to tell the runtime to add the result to all lists in the cache.", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, allListsDirective, "FRAGMENT_SPREAD")

	// @parentID(value: ID!) on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, parentIDDirective, "@parentID is used to provide a parentID without specifying position or in situations where it doesn't make sense (eg when deleting a node.)", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, parentIDDirective, "FRAGMENT_SPREAD")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, parentIDDirective, "value", "ID!", nil)
	if err != nil {
		return err
	}

	// @when on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, whenDirective, "@when is used to provide a conditional or in situations where it doesn't make sense (eg when removing or deleting a node.)", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, whenDirective, "FRAGMENT_SPREAD")

	// @when_not on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, whenNotDirective, "@when_not is used to provide a conditional or in situations where it doesn't make sense (eg when removing or deleting a node.)", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, whenNotDirective, "FRAGMENT_SPREAD")

	// @arguments on FRAGMENT_DEFINITION
	err = db.ExecStatement(statements.InsertInternalDirective, argumentsDirective, "@arguments is used to define the arguments of a fragment.", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, argumentsDirective, "FRAGMENT_DEFINITION")
	if err != nil {
		return err
	}

	// @with on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, withDirective, "@with  is used to provide arguments to fragments that have been marked with @arguments", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, withDirective, "FRAGMENT_SPREAD")
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
	err = db.ExecStatement(statements.InsertInternalDirective, cacheDirective, "@cache is is used to specify cache rules for a query", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, cacheDirective, "QUERY")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, cacheDirective, "policy", "CachePolicy", nil)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, cacheDirective, "partial", "Boolean", nil)
	if err != nil {
		return err
	}

	// @mask_enable on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, enableMaskDirective, "@mask_enable is used to to enable masking on fragment (overwriting the global conf)", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, enableMaskDirective, "FRAGMENT_SPREAD")
	if err != nil {
		return err
	}

	// @mask_disable on FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, disableMaskDirective, "@mask_disable is used to to disable masking on fragment (overwriting the global conf)", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, disableMaskDirective, "FRAGMENT_SPREAD")
	if err != nil {
		return err
	}

	// @loading(count: Int, cascade: Boolean) on QUERY | FIELD | FRAGMENT_DEFINITION | FRAGMENT_SPREAD
	err = db.ExecStatement(statements.InsertInternalDirective, loadingDirective, "@loading is used to shape the value of your documents while they are loading", true)
	if err != nil {
		return err
	}
	for _, loc := range []string{"FRAGMENT_SPREAD", "QUERY", "FIELD", "FRAGMENT_DEFINITION"} {
		err = db.ExecStatement(statements.InsertDirectiveLocation, loadingDirective, loc)
		if err != nil {
			return err
		}
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, loadingDirective, "count", "Int", nil)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, loadingDirective, "cascade", "Boolean", nil)
	if err != nil {
		return err
	}

	// @required on FIELD
	err = db.ExecStatement(statements.InsertInternalDirective, requiredDirective, "@required makes a nullable field always non-null by making the parent null when the field is", true)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, requiredDirective, "FIELD")
	if err != nil {
		return err
	}

	// @componentField on FRAGMENT_DEFINITION | INLINE_FRAGMENT | FIELD_DEFINITION
	err = db.ExecStatement(statements.InsertInternalDirective, componentFieldDirective, "@componentField is used to mark a field as a component field", true)
	if err != nil {
		return err
	}
	for _, loc := range []string{"FRAGMENT_DEFINITION", "INLINE_FRAGMENT", "FIELD_DEFINITION"} {
		err = db.ExecStatement(statements.InsertDirectiveLocation, componentFieldDirective, loc)
		if err != nil {
			return err
		}
	}

	// we need a directive to register runtime scalars but it shouldn't end up in the generated schema
	// @runtimeScalar(name: String!) on QUERY
	err = db.ExecStatement(statements.InsertInternalDirective, runtimeScalarDirective, "@runtimeScalar is used to register a scalar with the runtime", false)
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveLocation, runtimeScalarDirective, "QUERY")
	if err != nil {
		return err
	}
	err = db.ExecStatement(statements.InsertDirectiveArgument, runtimeScalarDirective, "type", "String!", nil)
	if err != nil {
		return err
	}

	// we're done
	return nil
}

// parseFieldType parses a GraphQL type string into a base type
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
//
// If you prefer that for list types the inner non‑null marker (the "!" immediately
// following the base) be dropped (so that "[User!]!" returns ("User", "!]!"))
// you could post‑process the modifier when the original string starts with "[".
// For example:
//
//	base, mod := parseFieldType(s)
//	if len(s) > 0 && s[0] == '[' && len(mod) > 0 && mod[0] == '!' {
//	    mod = mod[1:]
//	}
func parseFieldType(s string) (base, modifier string) {
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
