package tests

import (
	"context"
	"fmt"
	"sort"
	"testing"

	"code.houdinigraphql.com/plugins"
	"github.com/stretchr/testify/require"
	"zombiezen.com/go/sqlite"
)

type DBSelection struct {
	ID        int
	FieldName string
	Alias     *string
	PathIndex int
	Kind      string
}

type DocumentRow struct {
	ID            int
	Name          string
	RawDocument   int
	Kind          string
	TypeCondition *string
}

func ValidateExpectedDocuments[PluginConfig any](t *testing.T, db plugins.DatabasePool[PluginConfig], expectedDocs []ExpectedDocument) {
	// fetch documents and compare with expectedDocs.
	documents := FetchDocuments(t, db)
	if len(documents) != len(expectedDocs) {
		t.Errorf("expected %d documents, got %d", len(expectedDocs), len(documents))
	}
	// we need to sort the docs so that they fall in the same order as the test
	docs := make([]DocumentRow, len(documents))
	for i, doc := range expectedDocs {
		found := false
		// look for the document with the expected name
		for _, actual := range documents {
			if actual.Name == doc.Name {
				docs[i] = actual
				found = true
				break
			}
		}

		if !found {
			t.Fatal("could not find document with name " + doc.Name)
		}
	}
	for _, expDoc := range expectedDocs {
		var found bool
		for _, actual := range docs {
			if actual.Name == expDoc.Name {
				found = true

				// Compare document metadata.
				if actual.Kind != expDoc.Kind ||
					!StrEqual(actual.TypeCondition, expDoc.TypeCondition) {
					t.Errorf("document kind mismatch for %s: expected %+v, got %+v", expDoc.Name, expDoc, actual)
				}

				vars := FindDocumentVariables(t, db)
				if len(vars) != len(expDoc.Variables) {
					t.Errorf("for document %s, expected %d operation variables, got %d", expDoc.Name, len(expDoc.Variables), len(vars))
				}
				for i, expectedVar := range expDoc.Variables {
					if i >= len(vars) {
						break
					}
					actualVar := vars[i]
					if actualVar.Document != expectedVar.Document ||
						actualVar.VarName != expectedVar.VarName ||
						actualVar.Type != expectedVar.Type ||
						!StrEqual(actualVar.DefaultValue, expectedVar.DefaultValue) {
						t.Errorf("for document %s, operation variable row %d mismatch: expected %+v, got %+v", expDoc.Name, i, expectedVar, actualVar)
					}
					// Check directives attached to the operation variable.
					if len(expectedVar.Directives) != len(actualVar.Directives) {
						t.Errorf("for document %s, operation variable %s expected %d directives, got %d", expDoc.Name, expectedVar.VarName, len(expectedVar.Directives), len(actualVar.Directives))
					} else {
						for j, expDir := range expectedVar.Directives {
							actDir := actualVar.Directives[j]
							if actDir.Name != expDir.Name {
								t.Errorf("for document %s, operation variable %s directive %d mismatch: expected %s, got %s", expDoc.Name, expectedVar.VarName, j, expDir.Name, actDir.Name)
							}
							if len(expDir.Arguments) != len(actDir.Arguments) {
								t.Errorf("for document %s, operation variable %s directive %s expected %d arguments, got %d", expDoc.Name, expectedVar.VarName, expDir.Name, len(expDir.Arguments), len(actDir.Arguments))
							} else {
								for k, expArg := range expDir.Arguments {
									actArg := actDir.Arguments[k]
									if actArg.Name != expArg.Name {
										t.Errorf("for document %s, operation variable %s directive %s argument %d mismatch: expected %+v, got %+v", expDoc.Name, expectedVar.VarName, expDir.Name, k, expArg, actArg)
									}

									validateArgumentValue(t, expArg.Value, actArg.Value)
								}
							}
						}
					}
				}

				// Build and compare the selection tree.
				selectionsMap, rel, roots, err := BuildSelectionTree(db, int64(actual.ID))
				if err != nil {
					t.Fatalf("failed to build selection tree for document %s: %v", expDoc.Name, err)
				}
				actualTree := BuildExpectedFromDB(selectionsMap, rel, roots)
				SortTree(actualTree)
				SortExpectedSelections(expDoc.Selections)
				if err := CompareExpected(expDoc.Selections, actualTree); err != nil {
					t.Errorf("selection tree mismatch for document %s: %v", expDoc.Name, err)
				}

				// Finally, verify that the document-level directives match.
				docDirectives := FetchDocumentDirectives(t, db, int64(actual.ID))
				if len(docDirectives) != len(expDoc.Directives) {
					t.Errorf("for document %s, expected %d document directives, got %d", expDoc.Name, len(expDoc.Directives), len(docDirectives))
				} else {
					for i, expDir := range expDoc.Directives {
						actDir := docDirectives[i]
						if actDir.Name != expDir.Name {
							t.Errorf("document %s, directive %d: expected %s, got %s", expDoc.Name, i, expDir.Name, actDir.Name)
						}
						if len(actDir.Arguments) != len(expDir.Arguments) {
							t.Errorf("document %s, directive %s: expected %d arguments, got %d", expDoc.Name, expDir.Name, len(expDir.Arguments), len(actDir.Arguments))
						} else {
							for j, expArg := range expDir.Arguments {
								actArg := actDir.Arguments[j]

								if actArg.Name != expArg.Name {
									t.Errorf("document %s, directive %s argument %d mismatch: expected %+v, got %+v", expDoc.Name, expDir.Name, j, expArg, actArg)
								}

								validateArgumentValue(t, expArg.Value, actArg.Value)
							}
						}
					}
				}
			}
		}
		if !found {
			t.Errorf("expected document %s not found", expDoc.Name)
		}
	}
}

// SortExpectedSelections recursively sorts the expected selection slice.
func SortExpectedSelections(sels []ExpectedSelection) {
	sort.Slice(sels, func(i, j int) bool {
		return sels[i].PathIndex < sels[j].PathIndex
	})
	for i := range sels {
		SortExpectedSelections(sels[i].Children)
	}
}

// SortTree sorts the expected selection tree.
func SortTree(tree []ExpectedSelection) {
	SortExpectedSelections(tree)
}

// BuildSelectionTree builds the selection tree for a given document.
// it returns a mapping of selection id to dbSelection, a parent-to-children map, and a slice of root selection ids.
func BuildSelectionTree[PluginConfig any](db plugins.DatabasePool[PluginConfig], document int64) (map[int]DBSelection, map[int][]int, []int, error) {
	conn, err := db.Take(context.Background())
	if err != nil {
		return nil, nil, nil, err
	}
	defer db.Put(conn)

	stmt, err := conn.Prepare("SELECT kind FROM documents WHERE id = ?")
	if err != nil {
		return nil, nil, nil, err
	}
	stmt.BindInt64(1, document)
	ok, err := stmt.Step()
	if err != nil {
		stmt.Finalize()
		return nil, nil, nil, err
	}
	if !ok {
		stmt.Finalize()
		return nil, nil, nil, fmt.Errorf("document %v not found", document)
	}
	stmt.Finalize()

	// step 1. restrict to only those selections that have a matching selection_refs row.
	query := `SELECT s.id, s.field_name, s.alias, sr.path_index, s.kind
FROM selections s
JOIN selection_refs sr ON s.id = sr.child_id
WHERE sr.document = ?
ORDER BY s.id`
	stmt, err = conn.Prepare(query)
	if err != nil {
		return nil, nil, nil, err
	}
	stmt.BindInt64(1, document)
	filteredSelections := make(map[int]DBSelection)
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
		// alias is at column index 2.
		if stmt.ColumnType(2) == sqlite.TypeText {
			a := stmt.ColumnText(2)
			alias = &a
		}
		kind := stmt.ColumnText(4)
		filteredSelections[id] = DBSelection{
			ID:        id,
			FieldName: stmt.ColumnText(1),
			Alias:     alias,
			PathIndex: int(stmt.ColumnInt(3)),
			Kind:      kind,
		}
	}
	stmt.Finalize()

	// step 2. build the parent-to-children mapping for the given document.
	parentToChildren := make(map[int][]int)
	childIDs := make(map[int]struct{})
	stmt, err = conn.Prepare("SELECT parent_id, child_id FROM selection_refs WHERE document = ?")
	if err != nil {
		return nil, nil, nil, err
	}
	stmt.BindInt64(1, document)
	for {
		ok, err := stmt.Step()
		if err != nil {
			stmt.Finalize()
			return nil, nil, nil, err
		}
		if !ok {
			break
		}
		// if parent_id is null then this row indicates a top-level selection; do not add mapping.
		if stmt.ColumnType(0) == sqlite.TypeNull {
			continue
		}
		parentID := int(stmt.ColumnInt(0))
		childID := int(stmt.ColumnInt(1))
		if _, ok := filteredSelections[childID]; ok {
			parentToChildren[parentID] = append(parentToChildren[parentID], childID)
			childIDs[childID] = struct{}{}
		}
	}
	stmt.Finalize()

	// step 3. determine the roots.
	roots := make([]int, 0)
	for id := range filteredSelections {
		if _, isChild := childIDs[id]; !isChild {
			roots = append(roots, id)
		}
	}

	return filteredSelections, parentToChildren, roots, nil
}

func FetchDocuments[PluginConfig any](t *testing.T, db plugins.DatabasePool[PluginConfig]) []DocumentRow {
	conn, err := db.Take(context.Background())
	if err != nil {
		return nil
	}
	defer db.Put(conn)

	stmt, err := conn.Prepare("select name, raw_document, kind, type_condition, id from documents order by name")
	if err != nil {
		t.Fatalf("failed to prepare documents query: %v", err)
	}
	defer stmt.Finalize()

	var rows []DocumentRow
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
		rows = append(rows, DocumentRow{
			ID:            int(stmt.ColumnInt(4)),
			Name:          stmt.ColumnText(0),
			RawDocument:   int(stmt.ColumnInt(1)),
			Kind:          stmt.ColumnText(2),
			TypeCondition: tc,
		})
	}
	return rows
}

// FindDocumentVariables returns all operation variables along with any attached directives.
func FindDocumentVariables[PluginConfig any](t *testing.T, db plugins.DatabasePool[PluginConfig]) []ExpectedOperationVariable {
	conn, err := db.Take(context.Background())
	if err != nil {
		return nil
	}
	defer db.Put(conn)

	// Note: we now select the id as well so that we can look up directives.
	stmt, err := conn.Prepare(`
		SELECT id, document, name, type, default_value, type_modifiers
		FROM document_variables
		ORDER BY name
	`)
	if err != nil {
		t.Fatalf("failed to prepare document_variables query: %v", err)
	}
	defer stmt.Finalize()

	var variables []ExpectedOperationVariable
	for {
		ok, err := stmt.Step()
		if err != nil {
			t.Fatalf("error stepping document_variables query: %v", err)
		}
		if !ok {
			break
		}

		// Read the default value (if any)
		var defaultValue *string
		if stmt.ColumnType(4) == sqlite.TypeText {
			s := stmt.ColumnText(4)
			defaultValue = &s
		}

		// Grab the id for later lookup of directives.
		varID := int(stmt.ColumnInt(0))
		opVar := ExpectedOperationVariable{
			Document:      stmt.ColumnInt(1),
			VarName:       stmt.ColumnText(2),
			Type:          stmt.ColumnText(3),
			TypeModifiers: stmt.ColumnText(4),
			DefaultValue:  defaultValue,
		}

		// Look up any directives attached to this variable.
		directives := findOperationVariableDirectives(t, db, varID)
		if err != nil {
			t.Fatalf("failed to lookup directives for variable %s: %v", opVar.VarName, err)
		}
		opVar.Directives = directives

		variables = append(variables, opVar)
	}
	return variables
}

// findOperationVariableDirectives looks up all directives for a given operation variable.
func findOperationVariableDirectives[PluginConfig any](t *testing.T, db plugins.DatabasePool[PluginConfig], variableID int) []ExpectedDirective {
	conn, err := db.Take(context.Background())
	if err != nil {
		return nil
	}
	defer db.Put(conn)

	stmt, err := conn.Prepare(`
		SELECT id, directive
		FROM document_variable_directives
		WHERE parent = ?
		ORDER BY id
	`)
	if err != nil {
		t.Fatalf("failed to prepare document_variable_directives query: %v", err)
	}
	defer stmt.Finalize()

	// Bind the operation variable id.
	stmt.BindInt64(1, int64(variableID))

	var directives []ExpectedDirective
	for {
		ok, err := stmt.Step()
		if err != nil {
			t.Fatalf("error stepping document_variable_directives query: %v", err)
		}
		if !ok {
			break
		}

		// Get the id and name of the directive.
		dirID := int(stmt.ColumnInt(0))
		dirName := stmt.ColumnText(1)

		// Now look up any arguments for this directive.
		args, err := findOperationVariableDirectiveArguments(t, db, dirID)
		if err != nil {
			t.Fatalf("failed to fetch arguments for directive %s: %v", dirName, err)
		}

		directives = append(directives, ExpectedDirective{
			Name:      dirName,
			Arguments: args,
		})
	}
	return directives
}

// findOperationVariableDirectiveArguments retrieves all arguments for a given variable directive.
func findOperationVariableDirectiveArguments[PluginConfig any](t *testing.T, db plugins.DatabasePool[PluginConfig], directiveID int) ([]ExpectedDirectiveArgument, error) {
	conn, err := db.Take(context.Background())
	if err != nil {
		return nil, err
	}
	defer db.Put(conn)

	stmt, err := conn.Prepare(`
		SELECT name, value
		FROM document_variable_directive_arguments
		WHERE parent = ?
		ORDER BY id
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare document_variable_directive_arguments query: %v", err)
	}
	defer stmt.Finalize()

	stmt.BindInt64(1, int64(directiveID))

	var args []ExpectedDirectiveArgument
	for {
		ok, err := stmt.Step()
		if err != nil {
			return nil, fmt.Errorf("error stepping document_variable_directive_arguments query: %v", err)
		}
		if !ok {
			break
		}

		args = append(args, ExpectedDirectiveArgument{
			Name:  stmt.ColumnText(0),
			Value: findArgumentValue(t, db, stmt.ColumnInt(1)),
		})
	}
	return args, nil
}

func FetchSelections[PluginConfig any](t *testing.T, db plugins.DatabasePool[PluginConfig]) []DBSelection {
	conn, err := db.Take(context.Background())
	if err != nil {
		return nil
	}
	defer db.Put(conn)

	stmt, err := conn.Prepare("select id, field_name, alias, path_index, kind from selections join selection_refs on selection_refs.child_id = selections.id order by id")
	if err != nil {
		t.Fatalf("failed to prepare selections query: %v", err)
	}
	defer stmt.Finalize()

	var rows []DBSelection
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
		rows = append(rows, DBSelection{
			ID:        int(stmt.ColumnInt(0)),
			FieldName: stmt.ColumnText(1),
			Alias:     alias,
			PathIndex: int(stmt.ColumnInt(3)),
			Kind:      stmt.ColumnText(4),
		})
	}
	return rows
}

// BuildExpectedFromDB converts the db selection tree into a nested ExpectedSelection structure.
func BuildExpectedFromDB(selections map[int]DBSelection, rel map[int][]int, rootIDs []int) []ExpectedSelection {
	var result []ExpectedSelection
	for _, id := range rootIDs {
		sel := selections[id]
		result = append(result, ExpectedSelection{
			FieldName:  sel.FieldName,
			Alias:      sel.Alias,
			PathIndex:  sel.PathIndex,
			Kind:       sel.Kind,
			Arguments:  nil,
			Directives: nil,
			Children:   BuildExpectedFromDB(selections, rel, rel[sel.ID]),
		})
	}
	return result
}

func CompareExpected(expected, actual []ExpectedSelection) error {
	if len(expected) != len(actual) {
		return fmt.Errorf("expected %d selections got %d: %+v", len(expected), len(actual), actual)
	}
	for i := range expected {
		if expected[i].FieldName != actual[i].FieldName ||
			!StrEqual(expected[i].Alias, actual[i].Alias) ||
			expected[i].PathIndex != actual[i].PathIndex ||
			expected[i].Kind != actual[i].Kind {
			return fmt.Errorf("mismatch at %v %d: \n expected %+v \n got:     %+v", StrEqual(expected[i].Alias, actual[i].Alias), i, expected[i], actual[i])
		}
		if err := CompareExpected(expected[i].Children, actual[i].Children); err != nil {
			return err
		}
	}
	return nil
}

func VerifySelectionDetails[PluginConfig any](t *testing.T, db plugins.DatabasePool[PluginConfig], selectionID int, expected ExpectedSelection) {
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
					if actDArg.Name != expDArg.Name {
						t.Errorf("for selection id %d directive %s argument %d, expected %+v, got %+v", selectionID, expDir.Name, j, expDArg, actDArg)
					}

					validateArgumentValue(t, expDArg.Value, actDArg.Value)
				}
			}
		}
	}
}

func verifySelectionTreeDirectives[PluginConfig any](expectedTree []ExpectedSelection, dbSelections []DBSelection, db plugins.DatabasePool[PluginConfig], t *testing.T) {
	for _, exp := range expectedTree {
		if len(exp.Arguments) > 0 || len(exp.Directives) > 0 {
			if sel, found := findDBSelection(exp, dbSelections); found {
				VerifySelectionDetails(t, db, sel.ID, exp)
			} else {
				t.Errorf("could not find db selection matching expected %+v", exp)
			}
		}
		if len(exp.Children) > 0 {
			verifySelectionTreeDirectives(exp.Children, dbSelections, db, t)
		}
	}
}

func findDBSelection(expected ExpectedSelection, dbSelections []DBSelection) (DBSelection, bool) {
	for _, s := range dbSelections {
		effAlias := s.Alias
		if s.FieldName == expected.FieldName && s.PathIndex == expected.PathIndex && s.Kind == expected.Kind && StrEqual(effAlias, expected.Alias) {
			return s, true
		}
	}
	return DBSelection{}, false
}

func fetchSelectionArgumentsForSelection[PluginConfig any](t *testing.T, db plugins.DatabasePool[PluginConfig], selectionID int) []ExpectedArgument {
	conn, err := db.Take(context.Background())
	if err != nil {
		return nil
	}
	defer db.Put(conn)

	stmt, err := conn.Prepare("select name, value from selection_arguments where selection_id = ? order by id")
	if err != nil {
		t.Fatalf("failed to prepare selection_arguments query: %v", err)
	}
	defer stmt.Finalize()

	stmt.BindInt64(1, int64(selectionID))
	var args []ExpectedArgument
	for {
		ok, err := stmt.Step()
		if err != nil {
			t.Fatalf("error stepping selection_arguments query: %v", err)
		}
		if !ok {
			break
		}
		args = append(args, ExpectedArgument{
			Name:  stmt.ColumnText(0),
			Value: stmt.ColumnText(1),
		})
	}
	return args
}

func fetchSelectionDirectivesForSelection[PluginConfig any](t *testing.T, db plugins.DatabasePool[PluginConfig], selectionID int) []ExpectedDirective {
	conn, err := db.Take(context.Background())
	if err != nil {
		return nil
	}
	defer db.Put(conn)

	stmt, err := conn.Prepare("select id, directive from selection_directives where selection_id = ? order by id")
	if err != nil {
		t.Fatalf("failed to prepare selection_directives query: %v", err)
	}
	defer stmt.Finalize()

	stmt.BindInt64(1, int64(selectionID))
	var directives []ExpectedDirective
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
		argStmt, err := conn.Prepare("select name, value from selection_directive_arguments where parent = ? order by id")
		if err != nil {
			t.Fatalf("failed to prepare selection_directive_arguments query: %v", err)
		}
		argStmt.BindInt64(1, int64(dirID))
		var dirArgs []ExpectedDirectiveArgument
		for {
			ok, err := argStmt.Step()
			if err != nil {
				t.Fatalf("error stepping selection_directive_arguments query: %v", err)
			}
			if !ok {
				break
			}
			dirArgs = append(dirArgs, ExpectedDirectiveArgument{
				Name:  argStmt.ColumnText(0),
				Value: findArgumentValue(t, db, argStmt.ColumnInt(1)),
			})
		}
		argStmt.Finalize()
		directives = append(directives, ExpectedDirective{
			Name:      dirName,
			Arguments: dirArgs,
		})
	}
	return directives
}

func StrPtr(s string) *string {
	return &s
}

func StrEqual(a, b *string) bool {
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

func FetchDocumentDirectives[PluginConfig any](t *testing.T, db plugins.DatabasePool[PluginConfig], document int64) []ExpectedDirective {
	conn, err := db.Take(context.Background())
	if err != nil {
		return nil
	}
	defer db.Put(conn)

	stmt, err := conn.Prepare("SELECT id, directive FROM document_directives WHERE document = ? ORDER BY id")
	if err != nil {
		t.Fatalf("failed to prepare document_directives query: %v", err)
	}
	defer stmt.Finalize()

	stmt.BindInt64(1, document)

	var directives []ExpectedDirective
	for {
		ok, err := stmt.Step()
		if err != nil {
			t.Fatalf("error stepping document_directives query: %v", err)
		}
		if !ok {
			break
		}
		id := int(stmt.ColumnInt(0))
		dirName := stmt.ColumnText(1)

		argStmt, err := conn.Prepare("SELECT name, value FROM document_directive_arguments WHERE parent = ? ORDER BY id")
		if err != nil {
			t.Fatalf("failed to prepare document_directives_argument query: %v", err)
		}
		argStmt.BindInt64(1, int64(id))
		var args []ExpectedDirectiveArgument
		for {
			ok, err := argStmt.Step()
			if err != nil {
				t.Fatalf("error stepping document_directives_argument query: %v", err)
			}
			if !ok {
				break
			}
			args = append(args, ExpectedDirectiveArgument{
				Name:  argStmt.ColumnText(0),
				Value: findArgumentValue(t, db, argStmt.ColumnInt(1)),
			})
		}
		argStmt.Finalize()
		directives = append(directives, ExpectedDirective{
			Name:      dirName,
			Arguments: args,
		})
	}
	return directives
}

func validateArgumentValue(t *testing.T, expected *ExpectedArgumentValue, actual *ExpectedArgumentValue) {
	if expected == nil && actual != nil {
		t.Errorf("expected nil argument value, got %+v", actual)
		return
	}
	if expected != nil && actual == nil {
		t.Errorf("expected %+v, got nil argument value", expected)
		return
	}

	// Compare the basic fields.
	if expected.Kind != actual.Kind {
		t.Errorf("mismatch in Kind: expected %q, got %q", expected.Kind, actual.Kind)
	}
	if expected.Raw != actual.Raw {
		t.Errorf("mismatch in Raw: expected %q, got %q", expected.Raw, actual.Raw)
	}

	// Check that the number of children match.
	if len(expected.Children) != len(actual.Children) {
		t.Errorf("mismatch in number of children for argument value (kind %q): expected %d, got %d",
			expected.Kind, len(expected.Children), len(actual.Children))
	}

	// For each expected child, find a corresponding actual child with the same name.
	// This example first tries to use the same index; if that doesn't match, it searches by name.
	for i, expChild := range expected.Children {
		var actChildValue *ExpectedArgumentValue
		if i < len(actual.Children) && actual.Children[i].Name == expChild.Name {
			actChildValue = actual.Children[i].Value
		} else {
			// Search for a matching child by name.
			for _, ac := range actual.Children {
				if ac.Name == expChild.Name {
					actChildValue = ac.Value
					break
				}
			}
		}
		if actChildValue == nil {
			t.Errorf("expected child with name %q not found in actual argument value %+v", expChild.Name, actual)
		} else {
			// Recurse into the child value.
			validateArgumentValue(t, expChild.Value, actChildValue)
		}
	}
}

func findArgumentValue[PluginConfig any](t *testing.T, db plugins.DatabasePool[PluginConfig], valueID int) *ExpectedArgumentValue {

	// Recursive query to build the argument tree.
	query := `
	WITH RECURSIVE arg_tree AS (
	  -- Base case: start at the given argument value.
	  SELECT
	    av.id,
	    av.kind,
	    av.raw,
	    NULL AS parent_id,
	    NULL AS child_name,
	    0 AS level,
	    CAST(av.id AS TEXT) AS path
	  FROM argument_values av
	  WHERE av.id = $value_id

	  UNION ALL

	  -- Recursive step: join children via argument_value_children.
	  SELECT
	    child_av.id,
	    child_av.kind,
	    child_av.raw,
	    avc.parent AS parent_id,
	    avc.name AS child_name,
	    at.level + 1 AS level,
	    at.path || ',' || child_av.id AS path
	  FROM arg_tree at
	    JOIN argument_value_children avc ON avc.parent = at.id
	    JOIN argument_values child_av ON child_av.id = avc.value
	)
	SELECT * FROM arg_tree
	`

	// Define an internal type to represent nodes in the tree.
	type argNode struct {
		id        int
		kind      string
		raw       string
		parentID  *int // nil for the root
		childName string
		level     int
		children  []*argNode
	}

	// Use a map to keep track of nodes by id.
	nodes := make(map[int]*argNode)

	err := db.StepQuery(context.Background(), query, map[string]any{"value_id": valueID}, func(s *sqlite.Stmt) {
		id := int(s.ColumnInt(0))
		kind := s.ColumnText(1)
		raw := s.ColumnText(2)
		var parentID *int
		if s.ColumnType(3) != sqlite.TypeNull {
			pid := int(s.ColumnInt(3))
			parentID = &pid
		}
		childName := s.ColumnText(4)
		level := int(s.ColumnInt(5))

		node := &argNode{
			id:        id,
			kind:      kind,
			raw:       raw,
			parentID:  parentID,
			childName: childName,
			level:     level,
		}
		nodes[id] = node
	})
	require.Nil(t, err)

	// If no rows were returned, no argument value was found.
	if len(nodes) == 0 {
		return nil
	}

	// Build the tree structure from the flat map.
	var root *argNode
	for _, node := range nodes {
		if node.parentID == nil {
			root = node
		} else if parent, ok := nodes[*node.parentID]; ok {
			parent.children = append(parent.children, node)
		}
	}
	// If we didn't identify a root, return nil.
	if root == nil {
		return nil
	}

	// Recursively convert the tree of argNodes into ExpectedArgumentValue structures.
	var convert func(node *argNode) *ExpectedArgumentValue
	convert = func(node *argNode) *ExpectedArgumentValue {
		children := make([]ExpectedArgumentValueChildren, len(node.children))
		for i, child := range node.children {
			children[i] = ExpectedArgumentValueChildren{
				Name:  child.childName,
				Value: convert(child),
			}
		}
		return &ExpectedArgumentValue{
			Kind:     node.kind,
			Raw:      node.raw,
			Children: children,
		}
	}

	return convert(root)
}
