package fragmentArguments

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"zombiezen.com/go/sqlite"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin/schema"
	"code.houdinigraphql.com/plugins"
)

func ValidateFragmentArgumentsMissingWith(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	errs *plugins.ErrorList,
) {
	// This query finds fragment spreads (in selections) that reference a fragment document (documents with kind = 'fragment')
	// that declares at least one required argument (document_variables with type_modifiers ending in '!'),
	// but the fragment spread does not have any @with arguments.
	query := `
	SELECT
	  s.id AS spreadID,
	  d.id AS fragmentID,
	  d.name AS fragmentName,
	  rd.filepath,
	  rd.offset_line AS row,
	  rd.offset_column AS column,
	  GROUP_CONCAT(DISTINCT ov.name) AS requiredArgs,
	  COUNT(sda.id) AS withArgCount
	FROM selections s
	  JOIN documents d ON d.name = s.field_name AND d.kind = 'fragment'
	  JOIN raw_documents rd ON rd.id = d.raw_document
	  JOIN document_variables ov ON ov.document = d.id AND ov.type_modifiers LIKE '%!'
	  LEFT JOIN selection_directives wd ON wd.selection_id = s.id AND wd.directive = $with_directive
	  LEFT JOIN selection_directive_arguments sda ON sda.parent = wd.id
	WHERE (rd.current_task = $task_id OR $task_id IS NULL)
	GROUP BY s.id, d.id, d.name, rd.filepath, rd.offset_line, rd.offset_column
	HAVING COUNT(sda.id) < 1
	`
	bindings := map[string]any{"with_directive": schema.WithDirective}
	err := db.StepQuery(ctx, query, bindings, func(stmt *sqlite.Stmt) {
		fragmentName := stmt.ColumnText(2)
		filepath := stmt.ColumnText(3)
		row := int(stmt.ColumnInt(4))
		column := int(stmt.ColumnInt(5))
		requiredArgs := stmt.ColumnText(6)
		// withArgCount is guaranteed to be 0 because of the HAVING clause.
		errs.Append(&plugins.Error{
			Message: fmt.Sprintf(
				"Fragment spread referencing fragment %q requires a @with directive with at least one argument; the fragment declares required arguments: %s",
				fragmentName,
				requiredArgs,
			),
			Kind: plugins.ErrorKindValidation,
			Locations: []*plugins.ErrorLocation{
				{Filepath: filepath, Line: row, Column: column},
			},
		})
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

func ValidateFragmentArgumentValues(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	errs *plugins.ErrorList,
) {
	// --- STEP 1. Build a flat map of argument values for the 'with' directive ---
	flatNodes := make(map[int]*DirectiveArgValueNode)
	flatTreeQuery := `
		WITH RECURSIVE arg_tree(id, kind, raw, parent) AS (
			-- Base case: argument_values directly referenced by a @with directive.
			SELECT
				av.id,
				av.kind,
				av.raw,
				avc.parent
			FROM argument_values av
			JOIN selection_directive_arguments sda ON sda.value = av.id
			JOIN selection_directives sd ON sd.id = sda.parent
			LEFT JOIN argument_value_children avc ON avc.value = av.id
			WHERE sd.directive = $with_directive

			-- Recursive part: get children of any node in arg_tree.
			UNION ALL
			SELECT
				child.id,
				child.kind,
				child.raw,
				avc.parent
			FROM arg_tree
			JOIN argument_value_children avc ON avc.parent = arg_tree.id
			JOIN argument_values child ON child.id = avc.value
		)
		SELECT id, kind, raw, parent FROM arg_tree
	`

	bindings := map[string]any{"with_directive": schema.WithDirective}
	err := db.StepQuery(ctx, flatTreeQuery, bindings, func(stmt *sqlite.Stmt) {
		id := stmt.ColumnInt(0)
		kind := stmt.ColumnText(1)
		raw := stmt.ColumnText(2)
		var parent *int
		if !stmt.ColumnIsNull(3) {
			pid := stmt.ColumnInt(3)
			parent = &pid
		}

		flatNodes[id] = &DirectiveArgValueNode{
			ID:       id,
			Kind:     kind,
			Raw:      raw,
			Parent:   parent,
			Children: []*DirectiveArgValueNode{},
		}
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
		return
	}

	// Assemble the tree by attaching each node to its parent.
	for _, node := range flatNodes {
		if node.Parent != nil {
			if parentNode, ok := flatNodes[*node.Parent]; ok {
				parentNode.Children = append(parentNode.Children, node)
			}
		}
	}

	// --- STEP 2. Run the main query that returns fragment info and directive arguments ---
	// We now have directive arguments as JSON objects with fields "name", "argId", and "raw".
	mainQuery := `
		SELECT
			fd.name as fragmentName,
			rd.filepath,
			sd.row AS row,
			sd.column AS column,
			group_concat(DISTINCT json_object(
				'name', document_variables.name,
				'type', document_variables.type,
				'typeModifiers', document_variables.type_modifiers
			)) AS documentVariablesJson,
			group_concat(DISTINCT json_object(
				'name', sda.name,
				'argId', av.id,
				'raw', av.raw
			)) AS directiveArgumentsJson
		FROM selection_directives sd
			JOIN selections s ON s.id = sd.selection_id
			JOIN documents fd ON fd.name = s.field_name AND fd.kind = 'fragment'
			JOIN raw_documents rd ON rd.id = fd.raw_document
			LEFT JOIN selection_directive_arguments sda ON sda.parent = sd.id
			LEFT JOIN argument_values av ON av.id = sda.value
			JOIN document_variables ON fd.id = document_variables.document
		WHERE sd.directive = $with_directive
			AND (rd.current_task = $task_id OR $task_id IS NULL)
		GROUP BY sd.id
	`

	step2Bindings := map[string]any{"with_directive": schema.WithDirective}
	err = db.StepQuery(ctx, mainQuery, step2Bindings, func(stmt *sqlite.Stmt) {
		// fragmentName := mainStmt.ColumnText(0)
		documentVariablesJson := stmt.ColumnText(4)
		directiveArgumentsRaw := stmt.ColumnText(5)
		// If directiveArgumentsRaw is "null" or empty, substitute an empty JSON array.
		if directiveArgumentsRaw == "null" || directiveArgumentsRaw == "" {
			directiveArgumentsRaw = ""
		}

		var rawArgs []RawDirectiveArgument
		if directiveArgumentsRaw != "" {
			// Wrap the comma-separated JSON objects in square brackets.
			wrapped := "[" + directiveArgumentsRaw + "]"
			if err := json.Unmarshal([]byte(wrapped), &rawArgs); err != nil {
				rawArgs = []RawDirectiveArgument{}
			}
		}

		// Build a slice of directive arguments as structs.
		var directiveArgs []DirectiveArgument
		for _, rawArg := range rawArgs {
			var fullNode *DirectiveArgValueNode
			if rawArg.ArgId != 0 {
				if node, exists := flatNodes[rawArg.ArgId]; exists {
					fullNode = node
				}
			}
			// Fallback: if no valid node is found, we create one using the raw value.
			if fullNode == nil {
				fullNode = &DirectiveArgValueNode{
					Kind: rawArg.Raw,
					Raw:  rawArg.Raw,
				}
			}
			directiveArgs = append(directiveArgs, DirectiveArgument{
				Name:  rawArg.Name,
				Value: fullNode,
			})
		}

		documentVariables := make([]DocumentVariables, 0)
		if err := json.Unmarshal([]byte("["+documentVariablesJson+"]"), &documentVariables); err != nil {
			documentVariables = []DocumentVariables{}
		}

		if err := validateWithArguments(directiveArgs, documentVariables); err != nil {
			errs.Append(&plugins.Error{
				Message: err.Error(),
				Kind:    plugins.ErrorKindValidation,
				Locations: []*plugins.ErrorLocation{
					{
						Filepath: stmt.ColumnText(1),
						Line:     int(stmt.ColumnInt(2)),
						Column:   int(stmt.ColumnInt(3)),
					},
				},
			})
			return
		}
	})
	if err != nil {
		errs.Append(plugins.WrapError(err))
	}
}

// DirectiveArgValueNode represents a node in the argument value tree.
type DirectiveArgValueNode struct {
	ID       int                      `json:"id"`
	Kind     string                   `json:"kind"`
	Raw      string                   `json:"raw"`
	Parent   *int                     `json:"parent,omitempty"`
	Children []*DirectiveArgValueNode `json:"children"`
}

// Define structs for unmarshaling directive arguments.
type RawDirectiveArgument struct {
	Name  string `json:"name"`
	ArgId int    `json:"argId"` // if 0, then no valid arg
	Raw   string `json:"raw"`
}

type DirectiveArgument struct {
	Name  string                 `json:"name"`
	Value *DirectiveArgValueNode `json:"value"` // Full nested structure
}

type DocumentVariables struct {
	Name          string `json:"name"`
	Type          string `json:"type"`
	TypeModifiers string `json:"typeModifiers"`
}

// validateWithArguments loops through the directive arguments, validates
// each one against its corresponding operation variable, and ensures that every
// required argument is passed (i.e. every opVar whose TypeModifiers ends with '!')
func validateWithArguments(directiveArgs []DirectiveArgument, opVars []DocumentVariables) error {
	// Create a map of passed directive argument names.
	passedArgs := make(map[string]bool)

	// Validate each directive argument against the matching operation variable.
	for _, arg := range directiveArgs {
		// Mark this argument as passed.
		passedArgs[arg.Name] = true

		// Look up the operation variable by name.
		var opVar *DocumentVariables
		for i, op := range opVars {
			if op.Name == arg.Name {
				opVar = &opVars[i]
				break
			}
		}
		if opVar == nil {
			return fmt.Errorf("no matching operation variable for argument: %s", arg.Name)
		}

		// Validate the argument's value against the expected type and type modifiers.
		if !checkTypeCompatibility(arg.Value, opVar.Type, opVar.TypeModifiers) {
			return fmt.Errorf("argument %s value does not match expected type %s with modifiers %s",
				arg.Name, opVar.Type, opVar.TypeModifiers)
		}
	}

	// Now ensure that every required argument (operation variable with a type modifier ending in '!') is passed.
	for _, op := range opVars {
		if strings.HasSuffix(op.TypeModifiers, "!") {
			// This opVar is required.
			if _, exists := passedArgs[op.Name]; !exists {
				return fmt.Errorf("missing required argument: %s", op.Name)
			}
		}
	}

	return nil
}

// checkTypeCompatibility recursively validates that the ArgNode value matches
// the expected type (as a string) and its type modifiers.
// For our purposes:
//   - An empty modifier string indicates a scalar (no children, non-empty raw value).
//   - If the modifiers contain a ']', we expect a list.
//   - A trailing '!' indicates that the list (or scalar) is non-null.
func checkTypeCompatibility(arg *DirectiveArgValueNode, expectedType, modifiers string) bool {
	// No modifiers: expect a scalar value.
	if modifiers == "" {
		return len(arg.Children) == 0 && arg.Raw != ""
	}

	// If the modifier contains a ']', then we expect a list.
	if strings.Contains(modifiers, "]") {
		// If a non-null list is required (modifier ends with '!'), ensure the list is nonempty.
		if strings.HasSuffix(modifiers, "!") && len(arg.Children) == 0 {
			return false
		}
		// Recursively validate each child with one layer of list notation stripped.
		newModifiers := stripOneLayer(modifiers)
		for _, child := range arg.Children {
			if !checkTypeCompatibility(child, expectedType, newModifiers) {
				return false
			}
		}
		return true
	}

	// Fallback: treat as scalar.
	return arg.Raw != ""
}

// stripOneLayer removes one layer of list notation from the modifiers string.
// For example, given a modifiers string like "]!]!", it will remove up to and including
// the first ']' and then, if the next character is '!', remove that as well.
func stripOneLayer(modifiers string) string {
	idx := strings.Index(modifiers, "]")
	if idx == -1 {
		return modifiers
	}
	newStr := modifiers[idx+1:]
	if strings.HasPrefix(newStr, "!") {
		newStr = newStr[1:]
	}
	return newStr
}
