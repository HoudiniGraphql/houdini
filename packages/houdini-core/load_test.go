package main

import (
	"fmt"
	"strings"
	"testing"

	"code.houdinigraphql.com/plugins"
	"zombiezen.com/go/sqlite"
	"zombiezen.com/go/sqlite/sqlitex"
)

func TestAfterExtract_loadsExtractedQueries(t *testing.T) {
	tests := []testCase{
		{
			name: "simple query with nested fields and variable",
			rawQuery: `
				query TestQuery($id: ID!) {
					user(id: $id) {
						id
						name
					}
				}
			`,
			expected: expectedDocument{
				Name:        "TestQuery",
				RawDocument: 1,
				Kind:        "query",
				// For fields that have no explicit alias, we expect nil (or adjust if your logic defaults to field name)
				TypeCondition: nil,
				Variables: []operationVariableRow{
					{
						Document:     "TestQuery",
						VarName:      "id",
						Type:         "ID!",
						DefaultValue: nil,
					},
				},
				Selections: []expectedSelection{
					{
						FieldName:  "user",
						Alias:      strPtr("user"),
						PathIndex:  0,
						Kind:       "field",
						Arguments:  nil, // since the argument is a variable, it’s not extracted as a literal
						Directives: nil,
						Children: []expectedSelection{
							{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
							{FieldName: "name", Alias: strPtr("name"), PathIndex: 1, Kind: "field"},
						},
					},
				},
			},
		},
		{
			name: "fragment definition with no variables",
			rawQuery: `
				fragment TestFragment on User {
					id
					email
				}
			`,
			expected: expectedDocument{
				Name:          "TestFragment",
				RawDocument:   1,
				Kind:          "fragment",
				TypeCondition: strPtr("User"),
				Variables:     nil,
				Selections: []expectedSelection{
					{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
					{FieldName: "email", Alias: strPtr("email"), PathIndex: 1, Kind: "field"},
				},
			},
		},
		{
			name: "query with field arguments",
			rawQuery: `
				query TestQueryArgs {
					user(id: "123", active: true) {
						id
						name
					}
				}
			`,
			expected: expectedDocument{
				Name:          "TestQueryArgs",
				RawDocument:   1,
				Kind:          "query",
				TypeCondition: nil,
				Variables:     nil,
				Selections: []expectedSelection{
					{
						FieldName: "user",
						Alias:     strPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []expectedArgument{
							{Name: "id", Value: "\"123\""},
							{Name: "active", Value: "true"},
						},
						Directives: nil,
						Children: []expectedSelection{
							{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
							{FieldName: "name", Alias: strPtr("name"), PathIndex: 1, Kind: "field"},
						},
					},
				},
			},
		},
		{
			name: "query with inline fragment",
			rawQuery: `
				query TestQueryInline {
					user(id: "123") {
						... on User {
							id
							email
						}
					}
				}
			`,
			expected: expectedDocument{
				Name:          "TestQueryInline",
				RawDocument:   1,
				Kind:          "query",
				TypeCondition: nil,
				Variables:     nil,
				Selections: []expectedSelection{
					{
						FieldName:  "user",
						Alias:      strPtr("user"),
						PathIndex:  0,
						Kind:       "field",
						Arguments:  nil,
						Directives: nil,
						Children: []expectedSelection{
							{
								// For inline fragments, your logic uses the type condition as the field name.
								FieldName:  "User",
								Alias:      nil,
								PathIndex:  0,
								Kind:       "inline_fragment",
								Arguments:  nil,
								Directives: nil,
								Children: []expectedSelection{
									{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
									{FieldName: "email", Alias: strPtr("email"), PathIndex: 1, Kind: "field"},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "query with directive",
			rawQuery: `
				query TestQueryDirective {
					user(id: "123") @include(if: true) {
						id
					}
				}
			`,
			expected: expectedDocument{
				Name:          "TestQueryDirective",
				RawDocument:   1,
				Kind:          "query",
				TypeCondition: nil,
				Variables:     nil,
				Selections: []expectedSelection{
					{
						FieldName: "user",
						Alias:     strPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []expectedArgument{
							{Name: "id", Value: "\"123\""},
						},
						Directives: []expectedDirective{
							{
								Name: "include",
								Arguments: []expectedDirectiveArgument{
									{Name: "if", Value: "true"},
								},
							},
						},
						Children: []expectedSelection{
							{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
						},
					},
				},
			},
		},

		{
			// Tests that explicit aliases are preserved.
			name: "query with alias fields",
			rawQuery: `
				query TestQueryAlias {
					u: userById(id: "123") {
						fn: name
						age
					}
				}
			`,
			expected: expectedDocument{
				Name:          "TestQueryAlias",
				RawDocument:   1,
				Kind:          "query",
				TypeCondition: nil,
				Variables:     nil,
				Selections: []expectedSelection{
					{
						// Even though the field in the query is "userById",
						// the alias "u" should be used.
						FieldName: "userById",
						Alias:     strPtr("u"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []expectedArgument{
							{Name: "id", Value: "\"123\""},
						},
						Directives: nil,
						Children: []expectedSelection{
							// For "name" an explicit alias "fn" is provided.
							{FieldName: "name", Alias: strPtr("fn"), PathIndex: 0, Kind: "field"},
							// For "age", no alias is given so we expect the same value as the field name.
							{FieldName: "age", Alias: strPtr("age"), PathIndex: 1, Kind: "field"},
						},
					},
				},
			},
		},
		{
			// Tests that variable default values are recorded.
			name: "query with variable default",
			rawQuery: `
				query TestQueryDefault($limit: Int = 10) {
					users(limit: $limit) {
						id
					}
				}
			`,
			expected: expectedDocument{
				Name:          "TestQueryDefault",
				RawDocument:   1,
				Kind:          "query",
				TypeCondition: nil,
				Variables: []operationVariableRow{
					{
						Document:     "TestQueryDefault",
						VarName:      "limit",
						Type:         "Int",
						DefaultValue: strPtr("10"),
					},
				},
				Selections: []expectedSelection{
					{
						FieldName: "users",
						Alias:     strPtr("users"),
						PathIndex: 0,
						Kind:      "field",
						// Depending on your extraction logic, arguments using variables
						// may not be extracted as literal values.
						Arguments:  nil,
						Directives: nil,
						Children: []expectedSelection{
							{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
						},
					},
				},
			},
		},
		{
			// Tests that multiple directives on the same field are handled.
			name: "query with multiple directives",
			rawQuery: `
				query TestQueryMultiDirective {
					user(id: "123") @include(if: true) @deprecated(reason: "old field") {
						id
					}
				}
			`,
			expected: expectedDocument{
				Name:          "TestQueryMultiDirective",
				RawDocument:   1,
				Kind:          "query",
				TypeCondition: nil,
				Variables:     nil,
				Selections: []expectedSelection{
					{
						FieldName: "user",
						Alias:     strPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []expectedArgument{
							{Name: "id", Value: "\"123\""},
						},
						Directives: []expectedDirective{
							{
								Name: "include",
								Arguments: []expectedDirectiveArgument{
									{Name: "if", Value: "true"},
								},
							},
							{
								Name: "deprecated",
								Arguments: []expectedDirectiveArgument{
									{Name: "reason", Value: "\"old field\""},
								},
							},
						},
						Children: []expectedSelection{
							{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
						},
					},
				},
			},
		},
		{
			// Tests a mutation operation.
			name: "mutation with field arguments",
			rawQuery: `
				mutation TestMutation {
					updateUser(id: "123", name: "NewName") {
						id
						name
					}
				}
			`,
			expected: expectedDocument{
				Name:          "TestMutation",
				RawDocument:   1,
				Kind:          "mutation",
				TypeCondition: nil,
				Variables:     nil,
				Selections: []expectedSelection{
					{
						FieldName: "updateUser",
						Alias:     strPtr("updateUser"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []expectedArgument{
							{Name: "id", Value: "\"123\""},
							{Name: "name", Value: "\"NewName\""},
						},
						Directives: nil,
						Children: []expectedSelection{
							{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
							{FieldName: "name", Alias: strPtr("name"), PathIndex: 1, Kind: "field"},
						},
					},
				},
			},
		},
		{
			// Tests a subscription operation.
			name: "subscription query",
			rawQuery: `
				subscription TestSubscription {
					userUpdated {
						id
						email
					}
				}
			`,
			expected: expectedDocument{
				Name:          "TestSubscription",
				RawDocument:   1,
				Kind:          "subscription",
				TypeCondition: nil,
				Variables:     nil,
				Selections: []expectedSelection{
					{
						FieldName:  "userUpdated",
						Alias:      strPtr("userUpdated"),
						PathIndex:  0,
						Kind:       "field",
						Arguments:  nil,
						Directives: nil,
						Children: []expectedSelection{
							{FieldName: "id", Alias: strPtr("id"), PathIndex: 0, Kind: "field"},
							{FieldName: "email", Alias: strPtr("email"), PathIndex: 1, Kind: "field"},
						},
					},
				},
			},
		},
		{
			// Tests deeply nested inline fragments with aliases.
			name: "query with deeply nested inline fragments",
			rawQuery: `
				query TestDeepInline {
					user(id: "123") {
						... on User {
							details: profile {
								bio
								... on Profile {
									picture
								}
							}
						}
					}
				}
			`,
			expected: expectedDocument{
				Name:          "TestDeepInline",
				RawDocument:   1,
				Kind:          "query",
				TypeCondition: nil,
				Variables:     nil,
				Selections: []expectedSelection{
					{
						FieldName: "user",
						Alias:     strPtr("user"),
						PathIndex: 0,
						Kind:      "field",
						Arguments: []expectedArgument{
							{Name: "id", Value: "\"123\""},
						},
						Directives: nil,
						Children: []expectedSelection{
							{
								FieldName:  "User", // inline fragment uses the type condition as field name
								Alias:      nil,
								PathIndex:  0,
								Kind:       "inline_fragment",
								Arguments:  nil,
								Directives: nil,
								Children: []expectedSelection{
									{
										FieldName:  "profile",
										Alias:      strPtr("details"),
										PathIndex:  0,
										Kind:       "field",
										Arguments:  nil,
										Directives: nil,
										Children: []expectedSelection{
											{FieldName: "bio", Alias: strPtr("bio"), PathIndex: 0, Kind: "field"},
											{
												FieldName:  "Profile", // inline fragment inside profile
												Alias:      nil,
												PathIndex:  1,
												Kind:       "inline_fragment",
												Arguments:  nil,
												Directives: nil,
												Children: []expectedSelection{
													{FieldName: "picture", Alias: strPtr("picture"), PathIndex: 0, Kind: "field"},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// create in-memory db
			db, err := plugins.InMemoryDB[PluginConfig]()
			defer db.Close()

			if err != nil {
				t.Fatalf("failed to create in-memory db: %v", err)
			}

			if err := executeSchema(db.Conn); err != nil {
				t.Fatalf("failed to create schema: %v", err)
			}

			// insert raw document (assume id becomes 1)
			insertRaw, err := db.Conn.Prepare("insert into raw_documents (content, filepath) values (?, 'foo')")
			if err != nil {
				t.Fatalf("failed to prepare raw_documents insert: %v", err)
			}
			defer insertRaw.Finalize()
			insertRaw.BindText(1, tc.rawQuery)
			if err := db.ExecStatement(insertRaw); err != nil {
				t.Fatalf("failed to insert raw document: %v", err)
			}

			// instantiate houdinicore and set database
			hc := &HoudiniCore{}
			hc.SetDatabase(db)

			// prepare insert statements
			statements, finalize := prepareInsertStatements(db)
			defer finalize()

			// create pending query (id 1 from raw_documents)
			pending := PendingQuery{
				Query: tc.rawQuery,
				ID:    1,
			}

			// call loadPendingQuery
			if err := hc.loadPendingQuery(pending, db, statements); err != nil {
				t.Fatalf("loadPendingQuery returned error: %v", err)
			}

			// verify documents table
			docs := fetchDocuments(t, db)
			if len(docs) != 1 {
				t.Errorf("expected 1 document, got %d", len(docs))
			} else {
				actual := docs[0]
				exp := tc.expected
				if actual.Name != exp.Name ||
					actual.RawDocument != exp.RawDocument ||
					actual.Kind != exp.Kind ||
					!strEqual(actual.TypeCondition, exp.TypeCondition) {
					t.Errorf("document mismatch: expected %+v, got %+v", exp, actual)
				}
			}

			// verify operation_variables table
			vars := fetchOperationVariables(t, db)
			if len(vars) != len(tc.expected.Variables) {
				t.Errorf("expected %d operation variables, got %d", len(tc.expected.Variables), len(vars))
			}
			for i, expectedVar := range tc.expected.Variables {
				if i >= len(vars) {
					break
				}
				actualVar := vars[i]
				if actualVar.Document != expectedVar.Document ||
					actualVar.VarName != expectedVar.VarName ||
					actualVar.Type != expectedVar.Type ||
					!strEqual(actualVar.DefaultValue, expectedVar.DefaultValue) {
					t.Errorf("operation variable row %d mismatch: expected %+v, got %+v", i, expectedVar, actualVar)
				}
			}

			// verify nested selection tree via selection_refs
			selectionsMap, rel, roots, err := buildSelectionTree(db, tc.expected.Name)
			if err != nil {
				t.Fatalf("failed to build selection tree: %v", err)
			}
			actualTree := buildExpectedFromDB(selectionsMap, rel, roots)
			if err := compareExpected(tc.expected.Selections, actualTree); err != nil {
				t.Errorf("selection tree mismatch: %v", err)
			}

			// additionally, verify field arguments and directives for selections that expect them
			dbSels := fetchSelections(t, db)
			verifySelectionTreeDirectives(tc.expected.Selections, dbSels, db, t)
		})
	}
}

func executeSchema(db *sqlite.Conn) error {
	statements := strings.Split(schema, ";")
	for _, stmt := range statements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}
		if err := sqlitex.ExecuteTransient(db, stmt, nil); err != nil {
			return err
		}
	}
	return nil
}

const schema = `
-- A table of original document contents (to be populated by plugins)
CREATE TABLE raw_documents (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	filepath TEXT NOT NULL,
	content TEXT NOT NULL
);

CREATE TABLE operation_variables (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	document TEXT NOT NULL,
	name TEXT NOT NULL,
	type TEXT NOT NULL,
	default_value TEXT,
	FOREIGN KEY (document) REFERENCES documents(name)
);

-- this is pulled out separately from operations and fragments so foreign keys can be used
CREATE TABLE documents (
	name TEXT NOT NULL PRIMARY KEY,
	kind TEXT NOT NULL CHECK (kind IN ('query', 'mutation', 'subscription', 'fragment')),
	raw_document INTEGER NOT NULL,
	type_condition TEXT,
	FOREIGN KEY (raw_document) REFERENCES raw_documents(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE selections (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	field_name TEXT NOT NULL,
	kind TEXT NOT NULL CHECK (kind IN ('field', 'fragment', 'inline_fragment')),
	alias TEXT,
	path_index INTEGER NOT NULL
);

CREATE TABLE selection_directives (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	selection_id INTEGER NOT NULL,
	directive TEXT NOT NULL,
	FOREIGN KEY (selection_id) REFERENCES selections(id) DEFERRABLE INITIALLY DEFERRED,
	FOREIGN KEY (directive) REFERENCES directives(name) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE selection_directive_arguments (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	parent INTEGER NOT NULL,
	name TEXT NOT NULL,
	value TEXT NOT NULL,
	FOREIGN KEY (parent) REFERENCES selection_directives(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE selection_refs (
	parent_id INTEGER,
	child_id INTEGER NOT NULL,
	document TEXT NOT NULL,
	FOREIGN KEY (parent_id) REFERENCES selections(id) DEFERRABLE INITIALLY DEFERRED,
	FOREIGN KEY (child_id) REFERENCES selections(id) DEFERRABLE INITIALLY DEFERRED,
	FOREIGN KEY (document) REFERENCES documents(name) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE selection_arguments (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	selection_id INTEGER NOT NULL,
	name TEXT NOT NULL,
	value TEXT NOT NULL,
	FOREIGN KEY (selection_id) REFERENCES selections(id) DEFERRABLE INITIALLY DEFERRED
);
`

// ---------------------
// helper types and functions
// ---------------------

// fetchSelectionArgumentsForSelection queries selection_arguments for a given selection id.
func fetchSelectionArgumentsForSelection(t *testing.T, db plugins.Database[PluginConfig], selectionID int) []expectedArgument {
	stmt, err := db.Conn.Prepare("select name, value from selection_arguments where selection_id = ? order by id")
	if err != nil {
		t.Fatalf("failed to prepare selection_arguments query: %v", err)
	}
	defer stmt.Finalize()

	stmt.BindInt64(1, int64(selectionID))
	var args []expectedArgument
	for {
		ok, err := stmt.Step()
		if err != nil {
			t.Fatalf("error stepping selection_arguments query: %v", err)
		}
		if !ok {
			break
		}
		args = append(args, expectedArgument{
			Name:  stmt.ColumnText(0),
			Value: stmt.ColumnText(1),
		})
	}
	return args
}

// fetchSelectionDirectivesForSelection queries selection_directives (and its arguments) for a given selection id.
func fetchSelectionDirectivesForSelection(t *testing.T, db plugins.Database[PluginConfig], selectionID int) []expectedDirective {
	stmt, err := db.Conn.Prepare("select id, directive from selection_directives where selection_id = ? order by id")
	if err != nil {
		t.Fatalf("failed to prepare selection_directives query: %v", err)
	}
	defer stmt.Finalize()

	stmt.BindInt64(1, int64(selectionID))
	var directives []expectedDirective
	for {
		ok, err := stmt.Step()
		if err != nil {
			t.Fatalf("error stepping selection_directives query: %v", err)
		}
		if !ok {
			break
		}
		dirID := int(stmt.ColumnInt(0))
		dirName := stmt.ColumnText(1)

		// now fetch directive arguments for this directive
		argStmt, err := db.Conn.Prepare("select name, value from selection_directive_arguments where parent = ? order by id")
		if err != nil {
			t.Fatalf("failed to prepare selection_directive_arguments query: %v", err)
		}
		argStmt.BindInt64(1, int64(dirID))
		var dirArgs []expectedDirectiveArgument
		for {
			ok, err := argStmt.Step()
			if err != nil {
				t.Fatalf("error stepping selection_directive_arguments query: %v", err)
			}
			if !ok {
				break
			}
			dirArgs = append(dirArgs, expectedDirectiveArgument{
				Name:  argStmt.ColumnText(0),
				Value: argStmt.ColumnText(1),
			})
		}
		argStmt.Finalize()

		directives = append(directives, expectedDirective{
			Name:      dirName,
			Arguments: dirArgs,
		})
	}
	return directives
}

// verifySelectionDetails checks that the field arguments and directives for a selection (by id)
// match the expected ones.
func verifySelectionDetails(t *testing.T, db plugins.Database[PluginConfig], selectionID int, expected expectedSelection) {
	actualArgs := fetchSelectionArgumentsForSelection(t, db, selectionID)
	if len(actualArgs) != len(expected.Arguments) {
		t.Errorf("for selection id %d, expected %d arguments, got %d", selectionID, len(expected.Arguments), len(actualArgs))
	} else {
		for i, expArg := range expected.Arguments {
			actArg := actualArgs[i]
			if actArg.Name != expArg.Name || actArg.Value != expArg.Value {
				t.Errorf("for selection id %d argument %d, expected %+v, got %+v", selectionID, i, expArg, actArg)
			}
		}
	}

	actualDirs := fetchSelectionDirectivesForSelection(t, db, selectionID)
	if len(actualDirs) != len(expected.Directives) {
		t.Errorf("for selection id %d, expected %d directives, got %d", selectionID, len(expected.Directives), len(actualDirs))
	} else {
		for i, expDir := range expected.Directives {
			actDir := actualDirs[i]
			if actDir.Name != expDir.Name {
				t.Errorf("for selection id %d directive %d, expected name %s, got %s", selectionID, i, expDir.Name, actDir.Name)
			}
			if len(actDir.Arguments) != len(expDir.Arguments) {
				t.Errorf("for selection id %d directive %s, expected %d arguments, got %d", selectionID, expDir.Name, len(expDir.Arguments), len(actDir.Arguments))
			} else {
				for j, expDArg := range expDir.Arguments {
					actDArg := actDir.Arguments[j]
					if actDArg.Name != expDArg.Name || actDArg.Value != expDArg.Value {
						t.Errorf("for selection id %d directive %s argument %d, expected %+v, got %+v", selectionID, expDir.Name, j, expDArg, actDArg)
					}
				}
			}
		}
	}
}

// helper function to find a dbSelection that matches an expectedSelection by field name, path index, kind and alias
func findDBSelection(expected expectedSelection, dbSelections []dbSelection) (dbSelection, bool) {
	for _, s := range dbSelections {
		if s.FieldName == expected.FieldName && s.PathIndex == expected.PathIndex && s.Kind == expected.Kind {
			if strEqual(s.Alias, expected.Alias) {
				return s, true
			}
		}
	}
	return dbSelection{}, false
}

// recursively verify selection details for every expected selection that has non-empty arguments or directives.
func verifySelectionTreeDirectives(expectedTree []expectedSelection, dbSelections []dbSelection, db plugins.Database[PluginConfig], t *testing.T) {
	for _, exp := range expectedTree {
		if len(exp.Arguments) > 0 || len(exp.Directives) > 0 {
			if sel, found := findDBSelection(exp, dbSelections); found {
				verifySelectionDetails(t, db, sel.ID, exp)
			} else {
				t.Errorf("could not find db selection matching expected %+v", exp)
			}
		}
		if len(exp.Children) > 0 {
			verifySelectionTreeDirectives(exp.Children, dbSelections, db, t)
		}
	}
}

//
// helper functions to verify merged structures (documents, variables, selection tree)
//

func strPtr(s string) *string {
	return &s
}

func strEqual(a, b *string) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil {
		return *b == ""
	}
	if b == nil {
		return *a == ""
	}
	return *a == *b
}

func fetchDocuments(t *testing.T, db plugins.Database[PluginConfig]) []documentRow {
	stmt, err := db.Conn.Prepare("select name, raw_document, kind, type_condition from documents order by name")
	if err != nil {
		t.Fatalf("failed to prepare documents query: %v", err)
	}
	defer stmt.Finalize()

	var rows []documentRow
	for {
		ok, err := stmt.Step()
		if err != nil {
			t.Fatalf("error stepping documents query: %v", err)
		}
		if !ok {
			break
		}
		var tc *string
		if stmt.ColumnType(3) == sqlite.TypeText {
			s := stmt.ColumnText(3)
			tc = &s
		}
		rows = append(rows, documentRow{
			Name:          stmt.ColumnText(0),
			RawDocument:   int(stmt.ColumnInt(1)),
			Kind:          stmt.ColumnText(2),
			TypeCondition: tc,
		})
	}
	return rows
}

func fetchOperationVariables(t *testing.T, db plugins.Database[PluginConfig]) []operationVariableRow {
	stmt, err := db.Conn.Prepare("select document, name, type, default_value from operation_variables order by name")
	if err != nil {
		t.Fatalf("failed to prepare operation_variables query: %v", err)
	}
	defer stmt.Finalize()

	var rows []operationVariableRow
	for {
		ok, err := stmt.Step()
		if err != nil {
			t.Fatalf("error stepping operation_variables query: %v", err)
		}
		if !ok {
			break
		}
		var dv *string
		if stmt.ColumnType(3) == sqlite.TypeText {
			s := stmt.ColumnText(3)
			dv = &s
		}
		rows = append(rows, operationVariableRow{
			Document:     stmt.ColumnText(0),
			VarName:      stmt.ColumnText(1),
			Type:         stmt.ColumnText(2),
			DefaultValue: dv,
		})
	}
	return rows
}

func fetchSelections(t *testing.T, db plugins.Database[PluginConfig]) []dbSelection {
	stmt, err := db.Conn.Prepare("select id, field_name, alias, path_index, kind from selections order by id")
	if err != nil {
		t.Fatalf("failed to prepare selections query: %v", err)
	}
	defer stmt.Finalize()

	var rows []dbSelection
	for {
		ok, err := stmt.Step()
		if err != nil {
			t.Fatalf("error stepping selections query: %v", err)
		}
		if !ok {
			break
		}
		var alias *string
		if stmt.ColumnType(2) == sqlite.TypeText {
			a := stmt.ColumnText(2)
			alias = &a
		}
		rows = append(rows, dbSelection{
			ID:        int(stmt.ColumnInt(0)),
			FieldName: stmt.ColumnText(1),
			Alias:     alias,
			PathIndex: int(stmt.ColumnInt(3)),
			Kind:      stmt.ColumnText(4),
		})
	}
	return rows
}

// buildSelectionTree reconstructs the selection tree for a given document by reading selections and selection_refs.
func buildSelectionTree(db plugins.Database[PluginConfig], document string) (map[int]dbSelection, map[int][]int, []int, error) {
	selections := make(map[int]dbSelection)
	stmt, err := db.Conn.Prepare("select id, field_name, alias, path_index, kind from selections order by id")
	if err != nil {
		return nil, nil, nil, err
	}
	for {
		ok, err := stmt.Step()
		if err != nil {
			stmt.Finalize()
			return nil, nil, nil, err
		}
		if !ok {
			break
		}
		id := int(stmt.ColumnInt(0))
		var alias *string
		if stmt.ColumnType(2) == sqlite.TypeText {
			a := stmt.ColumnText(2)
			alias = &a
		}
		selections[id] = dbSelection{
			ID:        id,
			FieldName: stmt.ColumnText(1),
			Alias:     alias,
			PathIndex: int(stmt.ColumnInt(3)),
			Kind:      stmt.ColumnText(4),
		}
	}
	stmt.Finalize()

	parentToChildren := make(map[int][]int)
	childIDs := make(map[int]struct{})
	stmt, err = db.Conn.Prepare("select parent_id, child_id from selection_refs where document = ?")
	if err != nil {
		return nil, nil, nil, err
	}
	stmt.BindText(1, document)
	for {
		ok, err := stmt.Step()
		if err != nil {
			stmt.Finalize()
			return nil, nil, nil, err
		}
		if !ok {
			break
		}
		parentID := int(stmt.ColumnInt(0))
		childID := int(stmt.ColumnInt(1))
		parentToChildren[parentID] = append(parentToChildren[parentID], childID)
		childIDs[childID] = struct{}{}
	}
	stmt.Finalize()

	var roots []int
	for id := range selections {
		if _, isChild := childIDs[id]; !isChild {
			roots = append(roots, id)
		}
	}

	return selections, parentToChildren, roots, nil
}

// buildExpectedFromDB converts the db selection tree into a nested expectedSelection structure.
// note: this reconstruction does not include field arguments or directives.
func buildExpectedFromDB(selections map[int]dbSelection, rel map[int][]int, rootIDs []int) []expectedSelection {
	var result []expectedSelection
	for _, id := range rootIDs {
		sel := selections[id]
		children := buildExpectedFromDB(selections, rel, rel[sel.ID])
		result = append(result, expectedSelection{
			FieldName:  sel.FieldName,
			Alias:      sel.Alias,
			PathIndex:  sel.PathIndex,
			Kind:       sel.Kind,
			Arguments:  nil,
			Directives: nil,
			Children:   children,
		})
	}
	return result
}

// compareExpected recursively compares two expectedSelection trees.
func compareExpected(expected, actual []expectedSelection) error {
	if len(expected) != len(actual) {
		return fmt.Errorf("expected %d selections, got %d", len(expected), len(actual))
	}
	for i := range expected {
		if expected[i].FieldName != actual[i].FieldName ||
			!strEqual(expected[i].Alias, actual[i].Alias) ||
			expected[i].PathIndex != actual[i].PathIndex ||
			expected[i].Kind != actual[i].Kind {
			return fmt.Errorf("mismatch at index %d: expected %+v, got %+v", i, expected[i], actual[i])
		}
		if err := compareExpected(expected[i].Children, actual[i].Children); err != nil {
			return err
		}
	}
	return nil
}

//
// expected types (merged)
//

type expectedDocument struct {
	Name          string
	RawDocument   int
	Kind          string
	TypeCondition *string
	Variables     []operationVariableRow
	Selections    []expectedSelection
}

type operationVariableRow struct {
	Document     string
	VarName      string
	Type         string
	DefaultValue *string
}

type expectedArgument struct {
	Name  string
	Value string
}

type expectedDirectiveArgument struct {
	Name  string
	Value string
}

type expectedDirective struct {
	Name      string
	Arguments []expectedDirectiveArgument
}

type expectedSelection struct {
	FieldName  string
	Alias      *string
	PathIndex  int
	Kind       string
	Arguments  []expectedArgument
	Directives []expectedDirective
	Children   []expectedSelection
}

//
// db helper types
//

type documentRow struct {
	Name          string
	RawDocument   int
	Kind          string
	TypeCondition *string
}

type dbSelection struct {
	ID        int
	FieldName string
	Alias     *string
	PathIndex int
	Kind      string
}

//
// test case struct
//

type testCase struct {
	name     string
	rawQuery string
	expected expectedDocument
}
