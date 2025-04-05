package artifacts

import (
	"context"
	"fmt"
	"runtime"
	"sort"
	"strings"
	"sync"

	"zombiezen.com/go/sqlite"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/plugins"
)

func EnsureDocumentsPrinted(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	conn *sqlite.Conn,
	collectedDocuments map[string]*CollectedDocument,
) error {
	// we need to make sure that every document in the current task gets an updated stringified
	// version
	conn, err := db.Take(ctx)
	if err != nil {
		return err
	}
	defer db.Put(conn)

	// the documents we care about are those that fall in the current task
	documentSearch, err := conn.Prepare(`
    SELECT documents.name
    FROM documents 
      JOIN raw_documents ON documents.raw_document = raw_documents.id
    WHERE (raw_documents.current_task = $task_id OR $task_id is null)
  `)
	if err != nil {
		return plugins.WrapError(err)
	}

	// we want to parallelize the printing so we need a channel to push relevant document names
	// that we discover are part of the task
	docCh := make(chan string, len(collectedDocuments))
	errCh := make(chan *plugins.Error, len(collectedDocuments))
	var wg sync.WaitGroup
	for range runtime.NumCPU() {
		wg.Add(1)
		go printDocWorker(ctx, db, &wg, docCh, errCh, collectedDocuments)
	}

	// walk through the documents that are part of the current task
	err = db.StepStatement(ctx, documentSearch, func() {
		docCh <- documentSearch.ColumnText(0)
	})
	if err != nil {
		return plugins.WrapError(err)
	}

	// close the doc channel since no more results will be sent
	close(docCh)

	// wait for every document to be printed
	wg.Wait()

	// close the error channel since no more errors will be sent.
	close(errCh)

	return nil
}

func printDocWorker(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	wg *sync.WaitGroup,
	docChan <-chan string,
	errChan chan<- *plugins.Error,
	collectedDocuments map[string]*CollectedDocument,
) {
	// when we're done we need to signal the wait group
	defer wg.Done()

	// every worker needs a connection to the database
	conn, err := db.Take(ctx)
	if err != nil {
		errChan <- plugins.WrapError(err)
		return
	}
	defer db.Put(conn)

	// we need a statement to update the document
	update, err := conn.Prepare(`
    UPDATE documents SET printed = $printed WHERE name = $name
  `)
	if err != nil {
		errChan <- plugins.WrapError(err)
		return
	}
	defer update.Finalize()

	// consume document names from the channel
	for docName := range docChan {
		// look up the definition of the document we need to print
		doc, ok := collectedDocuments[docName]
		if !ok {
			errChan <- plugins.Errorf("document %v not found in collected documents", docName)
			continue
		}

		// start building up the string

		// the big constraint here is that we need to scrub any unused variables
		// which are assumed to be used in internal bits (ie directives)
		usedVariables := map[string]bool{}

		// which means we need to build up up the pieces and then join them later
		documentDirectives := printDirectives(doc.Directives, usedVariables)
		selection := printSelection(1, doc.Selections, usedVariables)

		// we're now ready to buil up the query
		printed := fmt.Sprintf(`%s %s`, doc.Kind, doc.Name)

		// operations (non-fragments) get their arguments printed here
		if doc.Kind != "fragment" {
			// variables might get used in directives on variables so let's print every variable
			// indenpendently and then we'll join the used ones together
			printedVars := map[string]string{}
			for _, arg := range doc.Variables {
				printedVars[arg.Name] = printDocumentVariables(arg, usedVariables)
			}

			toPrint := []string{}
			for v := range usedVariables {
				toPrint = append(toPrint, v)
			}
			sort.Strings(toPrint)

			if len(toPrint) > 0 {
				printedArgs := []string{}
				for _, arg := range toPrint {
					printedArgs = append(printedArgs, printedVars[arg])
				}
				printed += fmt.Sprintf("(%s)", strings.Join(printedArgs, ", "))
			}
		}

		// add fragment type conditions
		if doc.TypeCondition != nil {
			printed += fmt.Sprintf(` on %s`, *doc.TypeCondition)
		}

		// add the document directives
		printed += documentDirectives

		// and finally the selection
		printed += fmt.Sprintf(` {
%s}`, selection)

		// update the document with the printed version
		err = db.ExecStatement(update, map[string]any{"name": doc.Name, "printed": printed})
		if err != nil {
			errChan <- plugins.WrapError(err)
			continue
		}
	}
}

func printDirectives(directives []*CollectedDirective, usedVariables map[string]bool) string {
	if len(directives) == 0 {
		return ""
	}
	printed := []string{}
	for _, directive := range directives {
		// don't print internal directives
		if directive.Internal == 1 {
			continue
		}

		printed = append(printed, fmt.Sprintf(
			`@%s%s`,
			directive.Name,
			printSelectionArguments(0, directive.Arguments, usedVariables),
		))
	}
	if len(printed) == 0 {
		return ""
	}

	return " " + strings.Join(printed, " ")
}

func printSelectionArguments(
	level int,
	args []*CollectedArgument,
	usedVariables map[string]bool,
) string {
	if len(args) == 0 {
		return ""
	}

	tab := ""
	for range level {
		tab += "    "
	}

	// add directive arguments
	argsPrinted := []string{}
	for _, arg := range args {
		printed := fmt.Sprintf(
			`%s%s: %s`,
			tab,
			arg.Name,
			printValue(arg.Value, usedVariables),
		)

		if len(arg.Directives) > 0 {
			printed += printDirectives(arg.Directives, usedVariables)
		}
		argsPrinted = append(argsPrinted, printed)
	}

	return fmt.Sprintf("(%s)", strings.Join(argsPrinted, ", "))
}

func printDocumentVariables(
	variable *CollectedOperationVariable,
	usedVariables map[string]bool,
) string {
	// we need to wrap the type in modifiers
	varType := variable.Type + variable.TypeModifiers
	for range strings.Count(variable.TypeModifiers, "]") {
		varType = "[" + varType
	}

	defaultValue := ""
	if variable.DefaultValue != nil {
		defaultValue = fmt.Sprintf("= %s", printValue(variable.DefaultValue, usedVariables))
	}

	printedVar := fmt.Sprintf("$%s: %s", variable.Name, varType)
	if defaultValue != "" {
		printedVar += " " + defaultValue
	}
	if len(variable.Directives) > 0 {
		printedVar += printDirectives(variable.Directives, usedVariables)
	}

	return printedVar
}

func printSelection(
	level int,
	selections []*CollectedSelection,
	usedVariables map[string]bool,
) string {
	indent := strings.Repeat("    ", level)
	result := ""
	for _, selection := range selections {
		// before we print children and directives we need
		// to handle the specific selection type
		switch selection.Kind {
		case "fragment":
			result += fmt.Sprintf("%s...%s", indent, selection.FieldName)
		case "inline_fragment":
			typeCondition := ""
			if selection.FieldName != "" {
				typeCondition = fmt.Sprintf(" on %s", selection.FieldName)
			}
			result += fmt.Sprintf("%s...%s", indent, typeCondition)
		case "field":
			alias := ""
			if selection.Alias != nil && *selection.Alias != selection.FieldName {
				alias = fmt.Sprintf("%s: ", *selection.Alias)
			}
			// add the selection name
			result += fmt.Sprintf(
				"%s%s%s%s",
				indent,
				alias,
				selection.FieldName,
				printSelectionArguments(0, selection.Arguments, usedVariables),
			)
		}

		// add the directives
		if len(selection.Directives) > 0 {
			result += printDirectives(selection.Directives, usedVariables)
		}

		// add the subselections
		if len(selection.Children) > 0 {
			result += fmt.Sprintf(
				" {\n%s%s}",
				printSelection(level+1, selection.Children, usedVariables),
				indent,
			)
		}

		result += "\n"
	}
	return result
}

func printValue(value *CollectedArgumentValue, usedVariables map[string]bool) string {
	if value == nil {
		return "null"
	}

	switch value.Kind {
	case "String":
		return fmt.Sprintf("%q", value.Raw)
	case "Block":
		return fmt.Sprintf(`"""%s"""`, value.Raw)
	case "Variable":
		usedVariables[value.Raw] = true
		return "$" + value.Raw
	case "Object":
		result := "{"
		for i, v := range value.Children {
			result += fmt.Sprintf("%s: %s", v.Name, printValue(v.Value, usedVariables))
			if i != len(value.Children)-1 {
				result += ", "
			}
		}

		return result + "}"
	case "List":
		result := "["

		for i, v := range value.Children {
			result += printValue(v.Value, usedVariables)
			if i != len(value.Children)-1 {
				result += ", "
			}
		}

		return result + "]"
	default:
		return value.Raw
	}
}
