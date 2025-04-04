package artifacts

import (
	"context"
	"fmt"
	"runtime"
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
		printed := fmt.Sprintf(`%s %s`, doc.Kind, doc.Name)

		// operations (non-fragments) get their arguments printed here
		if doc.Kind != "fragment" {
			printed += printDocumentVariables(doc.Variables)
		}

		// add fragment type conditions
		if doc.TypeCondition != nil {
			printed += fmt.Sprintf(` on %s`, *doc.TypeCondition)
		}

		// add document directives
		if len(doc.Directives) > 0 {
			printed += " " + printDirectives(doc.Directives)
		}

		// we are now ready to start printing the selection
		printed += fmt.Sprintf(` {
%s}`, printSelection(1, doc.Selections))

		// update the document with the printed version
		err = db.ExecStatement(update, map[string]any{"name": doc.Name, "printed": printed})
		if err != nil {
			errChan <- plugins.WrapError(err)
			continue
		}
	}
}

func printDirectives(directives []*CollectedDirective) string {
	printed := []string{}
	for _, directive := range directives {
		printed = append(printed, fmt.Sprintf(
			`@%s%s`,
			directive.Name,
			printSelectionArguments(0, directive.Arguments),
		))
	}

	return strings.Join(printed, " ")
}

func printSelectionArguments(level int, args []*CollectedArgument) string {
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
			printValue(arg.Value),
		)

		if len(arg.Directives) > 0 {
			printed += " " + printDirectives(arg.Directives)
		}
		argsPrinted = append(argsPrinted, printed)
	}

	return fmt.Sprintf("(%s)", strings.Join(argsPrinted, ", "))
}

func printDocumentVariables(vars []*CollectedOperationVariable) string {
	if len(vars) == 0 {
		return ""
	}
	// variables get wrapped in ()
	printed := []string{}

	for _, v := range vars {
		// we need to wrap the type in modifiers
		varType := v.Type + v.TypeModifiers
		for range strings.Count(v.TypeModifiers, "]") {
			varType = "[" + varType
		}

		defaultValue := ""
		if v.DefaultValue != nil {
			defaultValue = fmt.Sprintf("= %s", printValue(v.DefaultValue))
		}

		printedVar := fmt.Sprintf("$%s: %s", v.Name, varType)
		if defaultValue != "" {
			printedVar += " " + defaultValue
		}
		if len(v.Directives) > 0 {
			printedVar += " " + printDirectives(v.Directives)
		}

		printed = append(printed, printedVar)
	}

	// wrap the printed result in parens
	return fmt.Sprintf("(%s)", strings.Join(printed, ", "))
}

func printSelection(level int, selections []*CollectedSelection) string {
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
				printSelectionArguments(0, selection.Arguments),
			)
		}

		// add the directives
		if len(selection.Directives) > 0 {
			result += " " + printDirectives(selection.Directives)
		}

		// add the subselections
		if len(selection.Children) > 0 {
			result += fmt.Sprintf(
				" {\n%s%s}",
				printSelection(level+1, selection.Children),
				indent,
			)
		}

		result += "\n"
	}
	return result
}

func printValue(value *CollectedArgumentValue) string {
	if value == nil {
		return "null"
	}

	switch value.Kind {
	case "String":
		return fmt.Sprintf("%q", value.Raw)
	case "Block":
		return fmt.Sprintf(`"""%s"""`, value.Raw)
	case "Variable":
		return "$" + value.Raw
	case "Object":
		result := "{"
		for i, v := range value.Children {
			result += fmt.Sprintf("%s: %s", v.Name, printValue(v.Value))
			if i != len(value.Children)-1 {
				result += ", "
			}
		}

		return result + "}"
	case "List":
		result := "["

		for i, v := range value.Children {
			result += printValue(v.Value)
			if i != len(value.Children)-1 {
				result += ", "
			}
		}

		return result + "]"
	default:
		return value.Raw
	}
}
