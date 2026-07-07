//go:build !wasip1

package tests

import (
	"bytes"
	_ "embed"
	"fmt"
	"strings"
	"code.houdinigraphql.com/plugins"
	"text/tabwriter"
	"unicode"
)

// WriteDatabaseSchema creates the database schema.
func WriteDatabaseSchema(conn plugins.Conn) error {
	// strip -- line comments before splitting so semicolons inside comments
	// (eg. "large table; index needed") don't split statements incorrectly.
	statements := strings.Split(stripSQLComments(schema), ";")
	for _, sql := range statements {
		sql = strings.TrimSpace(sql)
		if sql == "" {
			continue
		}
		s, err := conn.Prepare(sql)
		if err != nil {
			return err
		}
		if _, err := s.Step(); err != nil {
			s.Finalize()
			return err
		}
		if err := s.Finalize(); err != nil {
			return err
		}
	}
	return nil
}

// InsertRawDocument inserts a raw_documents row with the given id so fixtures
// that call LoadPendingQuery directly satisfy the documents.raw_document
// foreign key, exactly like the extraction step does in production.
func InsertRawDocument(conn plugins.Conn, id int, filepath string, content string) error {
	stmt, err := conn.Prepare(
		`INSERT INTO raw_documents (id, filepath, content) VALUES ($id, $filepath, $content)`,
	)
	if err != nil {
		return err
	}
	defer stmt.Finalize()
	stmt.SetInt64("$id", int64(id))
	stmt.SetText("$filepath", filepath)
	stmt.SetText("$content", content)
	_, err = stmt.Step()
	return err
}

// schema is the canonical orchestration database schema, generated from
// `create_schema` in packages/houdini/src/lib/database.ts via `pnpm sync-schema`.
// Do not edit schema.sql by hand.
//
//go:embed schema.sql
var schema string

// stripSQLComments removes -- line comments from a SQL script.
func stripSQLComments(s string) string {
	var b strings.Builder
	for _, line := range strings.Split(s, "\n") {
		if i := strings.Index(line, "--"); i >= 0 {
			line = line[:i]
		}
		b.WriteString(line)
		b.WriteByte('\n')
	}
	return b.String()
}

// expectedDocument represents an operation or fragment definition.
type ExpectedDocument struct {
	Name          string
	RawDocument   int
	Kind          string // "query", "mutation", "subscription", or "fragment"
	TypeCondition *string
	Variables     []ExpectedOperationVariable
	Selections    []ExpectedSelection
	Directives    []ExpectedDirective
}

type ExpectedOperationVariable struct {
	Document      int
	Name          string
	Type          string
	TypeModifiers string
	DefaultValue  *ExpectedArgumentValue
	Directives    []ExpectedDirective
}

type ExpectedArgument struct {
	ID    int64
	Name  string
	Value *ExpectedArgumentValue
}

type ExpectedArgumentValue struct {
	Kind     string
	Raw      string
	Children []ExpectedArgumentValueChildren
}

type ExpectedArgumentValueChildren struct {
	Name  string
	Value *ExpectedArgumentValue
}

type ExpectedDirectiveArgument struct {
	Name  string
	Value *ExpectedArgumentValue
}

type ExpectedDirective struct {
	Name      string
	Arguments []ExpectedDirectiveArgument
}

type ExpectedSelection struct {
	ID         int64
	FieldName  string
	Alias      *string
	PathIndex  int
	Kind       string // "field", "fragment", "inline_fragment", etc.
	Arguments  []ExpectedArgument
	Directives []ExpectedDirective
	Children   []ExpectedSelection
}

func printExpectedSelectionDiff(selA ExpectedSelection, selB ExpectedSelection) string {
	expectedLines := strings.Split(PrintExpectedSelection(selA), "\n")
	foundLines := strings.Split(PrintExpectedSelection(selB), "\n")

	// Use tabwriter to align the columns
	var buf bytes.Buffer
	w := tabwriter.NewWriter(&buf, 0, 0, 2, ' ', 0)

	fmt.Fprintf(w, "%-60s\t%s\n", "expected", "found")
	fmt.Fprintf(w, "%-60s\t%s\n", strings.Repeat("-", 60), strings.Repeat("-", 60))

	// determine the maximum number of lines
	maxLines := len(expectedLines)
	if len(foundLines) > maxLines {
		maxLines = len(foundLines)
	}

	for i := 0; i < maxLines; i++ {
		var expLine, foundLine string
		if i < len(expectedLines) {
			expLine = expectedLines[i]
		}
		if i < len(foundLines) {
			foundLine = foundLines[i]
		}
		// Print expected and found lines side by side separated by a tab
		fmt.Fprintf(w, "%-60s\t%s\n", expLine, foundLine)
	}
	w.Flush()

	return buf.String()
}

func Dedent(input string) string {
	lines := strings.Split(input, "\n")
	var baseline string

	// Find the first non-empty line and record its leading whitespace.
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		i := 0
		for i < len(line) {
			if !unicode.IsSpace(rune(line[i])) {
				break
			}
			i++
		}
		baseline = line[:i]
		break
	}

	// If no baseline is found, return the original input.
	if baseline == "" {
		return input
	}

	// Remove the baseline indentation from each line (if present).
	for i, line := range lines {
		if strings.HasPrefix(line, baseline) {
			lines[i] = line[len(baseline):]
		}
	}
	return strings.TrimSpace(strings.Join(lines, "\n"))
}

// PrintExpectedDocument returns the GraphQL string representation
// of the given ExpectedDocument.
func PrintExpectedDocument(doc *ExpectedDocument) string {
	var buf bytes.Buffer

	// Operation vs fragment
	if strings.EqualFold(doc.Kind, "fragment") {
		// fragment MyFragment on TypeCond @dir { ... }
		fmt.Fprintf(&buf, "fragment %s", doc.Name)
		if doc.TypeCondition != nil && *doc.TypeCondition != "" {
			fmt.Fprintf(&buf, " on %s", *doc.TypeCondition)
		}
		writeDirectives(&buf, doc.Directives)
		buf.WriteString(" {\n")
		writeSelectionSet(&buf, doc.Selections, 1)
		buf.WriteString("}\n")
		return buf.String()
	}

	// query/mutation/subscription
	if doc.Kind != "" {
		buf.WriteString(doc.Kind)
	} else {
		// default to "query" if kind is empty
		buf.WriteString("query")
	}

	if doc.Name != "" {
		buf.WriteByte(' ')
		buf.WriteString(doc.Name)
	}

	// Variables: ($var: Type = default)
	if len(doc.Variables) > 0 {
		buf.WriteByte('(')
		for i, v := range doc.Variables {
			if i > 0 {
				buf.WriteString(", ")
			}
			buf.WriteByte('$')
			buf.WriteString(v.Name)
			buf.WriteString(": ")

			// NOTE: TypeModifiers’ encoding is domain-specific.
			// Here we just append it around the type in a simple way.
			// Adjust this if your modifiers are stored differently.
			if v.TypeModifiers != "" {
				// e.g., "[%s!]!" style might already be encoded, but if not,
				// you can switch to a custom formatter.
				buf.WriteString(v.TypeModifiers)
			}
			buf.WriteString(v.Type)

			if v.DefaultValue != nil {
				buf.WriteString(" = ")
				buf.WriteString(printArgumentValue(v.DefaultValue))
			}
		}
		buf.WriteByte(')')
	}

	// Operation-level directives
	writeDirectives(&buf, doc.Directives)

	buf.WriteString(" {\n")
	writeSelectionSet(&buf, doc.Selections, 1)
	buf.WriteString("}\n")

	return buf.String()
}

func writeSelectionSet(buf *bytes.Buffer, selections []ExpectedSelection, indent int) {
	for _, sel := range selections {
		writeIndent(buf, indent)

		switch strings.ToLower(sel.Kind) {
		case "field", "":
			// alias: fieldName
			if sel.Alias != nil && *sel.Alias != "" && *sel.Alias != sel.FieldName {
				fmt.Fprintf(buf, "%s: %s", *sel.Alias, sel.FieldName)
			} else {
				buf.WriteString(sel.FieldName)
			}

			// arguments
			writeArguments(buf, sel.Arguments)

			// directives
			writeDirectives(buf, sel.Directives)

			// children
			if len(sel.Children) > 0 {
				buf.WriteString(" {\n")
				writeSelectionSet(buf, sel.Children, indent+1)
				writeIndent(buf, indent)
				buf.WriteString("}")
			}
			buf.WriteString("\n")

		case "fragment": // fragment spread
			// FieldName is assumed to be the fragment name
			fmt.Fprintf(buf, "...%s", sel.FieldName)
			writeDirectives(buf, sel.Directives)
			buf.WriteString("\n")

		case "inline_fragment":
			// Here we assume FieldName holds the type condition
			fmt.Fprintf(buf, "... on %s", sel.FieldName)
			writeDirectives(buf, sel.Directives)
			if len(sel.Children) > 0 {
				buf.WriteString(" {\n")
				writeSelectionSet(buf, sel.Children, indent+1)
				writeIndent(buf, indent)
				buf.WriteString("}")
			}
			buf.WriteString("\n")

		default:
			// Fallback: treat unknown kinds as plain fields
			buf.WriteString(sel.FieldName)
			writeArguments(buf, sel.Arguments)
			writeDirectives(buf, sel.Directives)
			if len(sel.Children) > 0 {
				buf.WriteString(" {\n")
				writeSelectionSet(buf, sel.Children, indent+1)
				writeIndent(buf, indent)
				buf.WriteString("}")
			}
			buf.WriteString("\n")
		}
	}
}

func writeArguments(buf *bytes.Buffer, args []ExpectedArgument) {
	if len(args) == 0 {
		return
	}
	buf.WriteByte('(')
	for i, arg := range args {
		if i > 0 {
			buf.WriteString(", ")
		}
		buf.WriteString(arg.Name)
		buf.WriteString(": ")
		if arg.Value != nil {
			buf.WriteString(printArgumentValue(arg.Value))
		} else {
			buf.WriteString("null")
		}
	}
	buf.WriteByte(')')
}

func writeDirectiveArguments(buf *bytes.Buffer, args []ExpectedDirectiveArgument) {
	if len(args) == 0 {
		return
	}
	buf.WriteByte('(')
	for i, arg := range args {
		if i > 0 {
			buf.WriteString(", ")
		}
		buf.WriteString(arg.Name)
		buf.WriteString(": ")
		if arg.Value != nil {
			buf.WriteString(printArgumentValue(arg.Value))
		} else {
			buf.WriteString("null")
		}
	}
	buf.WriteByte(')')
}

func writeDirectives(buf *bytes.Buffer, directives []ExpectedDirective) {
	for _, d := range directives {
		buf.WriteByte(' ')
		buf.WriteByte('@')
		buf.WriteString(d.Name)
		writeDirectiveArguments(buf, d.Arguments)
	}
}

func printArgumentValue(v *ExpectedArgumentValue) string {
	if v == nil {
		return "null"
	}

	switch strings.ToLower(v.Kind) {
	case "variable":
		// Assume Raw is the variable name without $
		return "$" + v.Raw

	case "list":
		var parts []string
		for _, child := range v.Children {
			if child.Value != nil {
				parts = append(parts, printArgumentValue(child.Value))
			} else {
				parts = append(parts, "null")
			}
		}
		return "[" + strings.Join(parts, ", ") + "]"

	case "object":
		var parts []string
		for _, child := range v.Children {
			valStr := "null"
			if child.Value != nil {
				valStr = printArgumentValue(child.Value)
			}
			parts = append(parts, fmt.Sprintf("%s: %s", child.Name, valStr))
		}
		return "{ " + strings.Join(parts, ", ") + " }"

	default:
		// Scalars/enums/etc: assume Raw already contains valid GraphQL literal
		// (e.g., "123", "\"string\"", "ENUM_VALUE", "true", "null")
		return v.Raw
	}
}

func writeIndent(buf *bytes.Buffer, indent int) {
	for i := 0; i < indent; i++ {
		buf.WriteString("  ")
	}
}

func PrintExpectedSelection(sel ExpectedSelection) string {
	var buf bytes.Buffer
	writeSingleSelection(&buf, sel, 0)
	return buf.String()
}

func writeSingleSelection(buf *bytes.Buffer, sel ExpectedSelection, indent int) {
	writeIndent(buf, indent)

	kind := strings.ToLower(sel.Kind)

	switch kind {
	case "field", "":
		// alias: fieldName
		if sel.Alias != nil && *sel.Alias != "" && *sel.Alias != sel.FieldName {
			fmt.Fprintf(buf, "%s: %s", *sel.Alias, sel.FieldName)
		} else {
			buf.WriteString(sel.FieldName)
		}

		// arguments
		writeArguments(buf, sel.Arguments)

		// directives
		writeDirectives(buf, sel.Directives)

		// children
		if len(sel.Children) > 0 {
			buf.WriteString(" {\n")
			for _, child := range sel.Children {
				writeSingleSelection(buf, child, indent+1)
			}
			writeIndent(buf, indent)
			buf.WriteString("}")
		}
		buf.WriteString("\n")

	case "fragment": // fragment spread
		fmt.Fprintf(buf, "...%s", sel.FieldName)
		writeDirectives(buf, sel.Directives)
		buf.WriteString("\n")

	case "inline_fragment":
		// FieldName holds the type condition
		fmt.Fprintf(buf, "... on %s", sel.FieldName)
		writeDirectives(buf, sel.Directives)
		if len(sel.Children) > 0 {
			buf.WriteString(" {\n")
			for _, child := range sel.Children {
				writeSingleSelection(buf, child, indent+1)
			}
			writeIndent(buf, indent)
			buf.WriteString("}")
		}
		buf.WriteString("\n")

	default:
		// fallback to field-like printing
		buf.WriteString(sel.FieldName)
		writeArguments(buf, sel.Arguments)
		writeDirectives(buf, sel.Directives)
		if len(sel.Children) > 0 {
			buf.WriteString(" {\n")
			for _, child := range sel.Children {
				writeSingleSelection(buf, child, indent+1)
			}
			writeIndent(buf, indent)
			buf.WriteString("}")
		}
		buf.WriteString("\n")
	}
}
