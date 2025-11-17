package tests

import (
	"bytes"
	"fmt"
	"strings"
	"text/tabwriter"
	"unicode"

	"zombiezen.com/go/sqlite"
	"zombiezen.com/go/sqlite/sqlitex"
)

// ExecuteSchema creates the database schema.
func WriteDatabaseSchema(db *sqlite.Conn) error {
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
CREATE TABLE plugins (
    name TEXT NOT NULL PRIMARY KEY UNIQUE,
    port INTEGER NOT NULL,
    hooks JSON NOT NULL,
    plugin_order TEXT NOT NULL CHECK (plugin_order IN ('before', 'after', 'core')),
    include_runtime TEXT,
    include_static_runtime TEXT,
    config JSON,
	  config_module TEXT,
		client_plugins JSON
);

-- Watch Schema Config
CREATE TABLE watch_schema_config (
    url TEXT NOT NULL,
    headers JSON,
    interval INTEGER,
    timeout INTEGER
);

-- Router Config
CREATE TABLE router_config (
    api_endpoint TEXT,
    redirect TEXT UNIQUE,
    session_keys TEXT NOT NULL UNIQUE,
    url TEXT,
    mutation TEXT UNIQUE
);

-- Runtime Scalar Definition
CREATE TABLE runtime_scalar_definitions (
    name TEXT NOT NULL PRIMARY KEY UNIQUE,
    type TEXT NOT NULL
);

CREATE TABLE component_fields (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	document INTEGER NOT NULL,
  type TEXT,
	prop TEXT,
  field TEXT,
	inline BOOLEAN default false,
  type_field TEXT,
  fragment TEXT,

	UNIQUE (document),
  FOREIGN KEY (type_field)  REFERENCES type_fields(id),
	FOREIGN KEY (document) REFERENCES raw_documents(id) DEFERRABLE INITIALLY DEFERRED
);

-- Static Config (main config table)
CREATE TABLE config (
    include JSON NOT NULL,
    exclude JSON NOT NULL,
    schema_path TEXT NOT NULL,
    definitions_path TEXT,
    cache_buffer_size INTEGER,
    default_cache_policy TEXT,
    default_partial BOOLEAN,
    default_lifetime INTEGER,
    default_list_position TEXT CHECK (default_list_position IN ('APPEND', 'PREPEND')),
    default_list_target TEXT CHECK (default_list_target IN ('ALL', 'NULL')),
    default_paginate_mode TEXT CHECK (default_paginate_mode IN ('Infinite', 'SinglePage')),
    suppress_pagination_deduplication BOOLEAN,
    log_level TEXT CHECK (log_level IN ('QUIET', 'FULL', 'SUMMARY', 'SHORT_SUMMARY')),
    default_fragment_masking BOOLEAN,
    default_keys JSON,
    persisted_queries_path TEXT,
    project_root TEXT,
    runtime_dir TEXT,
		path TEXT
);

CREATE TABLE scalar_config (
    name TEXT NOT NULL PRIMARY KEY UNIQUE,
    type TEXT NOT NULL,
	input_types JSON
);

-- Types configuration
CREATE TABLE type_configs (
    name TEXT NOT NULL,
    keys JSON NOT NULL,
	resolve_query TEXT
);

-- A table of original document contents (to be populated by plugins)
CREATE TABLE raw_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    offset_line INTEGER,
    offset_column INTEGER,
    filepath TEXT NOT NULL,
    content TEXT NOT NULL,
    current_task TEXT,
    loaded_with TEXT
);

-----------------------------------------------------------
-- Schema Definition Tables
-----------------------------------------------------------

CREATE TABLE types (
    name TEXT NOT NULL PRIMARY KEY UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('OBJECT', 'INTERFACE', 'UNION', 'ENUM', 'SCALAR', 'INPUT')),
    operation TEXT,
	description TEXT,
	internal BOOLEAN default false,
	built_in BOOLEAN default false
);

CREATE TABLE type_fields (
    id TEXT PRIMARY KEY, -- will be something like User.name so we don't have to look up the generated id
    parent TEXT NOT NULL, -- will be User
    name TEXT NOT NULL,
    type TEXT NOT NULL,
	  type_modifiers TEXT,
    default_value TEXT,
    description TEXT,
	  internal BOOLEAN default false,
    document INT,

    FOREIGN KEY (document) REFERENCES raw_documents(id) ON DELETE CASCADE,
    FOREIGN KEY (parent) REFERENCES types(name) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (type) REFERENCES types(name) DEFERRABLE INITIALLY DEFERRED,
    UNIQUE (parent, name)
);

CREATE TABLE type_field_arguments (
    id TEXT PRIMARY KEY,
    field TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    type_modifiers TEXT,
    FOREIGN KEY (field) REFERENCES type_fields(id),
    UNIQUE (field, name)
);


CREATE TABLE enum_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent TEXT NOT NULL,
    value TEXT NOT NULL,
	  description TEXT,
    FOREIGN KEY (parent) REFERENCES types(name) DEFERRABLE INITIALLY DEFERRED,
    UNIQUE (parent, value)
);

CREATE TABLE possible_types (
    type TEXT NOT NULL,
    member TEXT NOT NULL,
    FOREIGN KEY (type) REFERENCES types(name) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (member) REFERENCES types(name) DEFERRABLE INITIALLY DEFERRED,
    PRIMARY KEY (type, member)
);

CREATE TABLE directives (
    name TEXT NOT NULL UNIQUE PRIMARY KEY,
	internal BOOLEAN default false,
    visible BOOLEAN default true,
    repeatable BOOLEAN default false,
	description TEXT
);

CREATE TABLE directive_arguments (
    parent TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    type_modifiers TEXT,
    default_value TEXT,
    FOREIGN KEY (parent) REFERENCES directives(name),
    PRIMARY KEY (parent, name),
    UNIQUE (parent, name)
);

CREATE TABLE directive_locations (
    directive TEXT NOT NULL,
    location TEXT NOT NULL CHECK (location IN ('QUERY', 'MUTATION', 'SUBSCRIPTION', 'FIELD', 'FRAGMENT_DEFINITION', 'FRAGMENT_SPREAD', 'INLINE_FRAGMENT', 'SCHEMA', 'SCALAR', 'OBJECT', 'FIELD_DEFINITION', 'ARGUMENT_DEFINITION', 'INTERFACE', 'UNION', 'ENUM', 'ENUM_VALUE', 'INPUT_OBJECT', 'INPUT_FIELD_DEFINITION')),
    FOREIGN KEY (directive) REFERENCES directives(name),
    PRIMARY KEY (directive, location)
);

CREATE TABLE document_variable_directives (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	parent INTEGER NOT NULL,
	directive TEXT NOT NULL,
    row INTEGER NOT NULL,
    column INTEGER NOT NULL,
	FOREIGN KEY (parent) REFERENCES document_variables(id) DEFERRABLE INITIALLY DEFERRED,
	FOREIGN KEY (directive) REFERENCES directives(name) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE document_variable_directive_arguments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent INTEGER NOT NULL,
    name TEXT NOT NULL,
    value INTEGER NOT NULL,

    FOREIGN KEY (value) REFERENCES argument_values(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (parent) REFERENCES document_variable_directives(id) DEFERRABLE INITIALLY DEFERRED
);

-- while we validate list operations we need to store metadata that we can use to generate the
-- necessary documents after everything has been validated
CREATE TABLE discovered_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    node_type TEXT NOT NULL,
    edge_type TEXT,
    connection_type TEXT NOT NULL,
    node INTEGER NOT NULL,
    document INTEGER NOT NULL,
    connection BOOLEAN default false,
    list_field INTEGER NOT NULL,
    page_size INTEGER NOT NULL,
    mode TEXT NOT NULL,
    embedded BOOLEAN NOT NULL,
    target_type TEXT NOT NULL,
    paginate TEXT,
    supports_forward BOOLEAN default false,
    supports_backward BOOLEAN default false,
    cursor_type TEXT,

    FOREIGN KEY (list_field) REFERENCES selections(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (node) REFERENCES selections(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (node_type) REFERENCES types(name) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (document) REFERENCES documents(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE document_dependencies (
  document INTEGER NOT NULL,
  depends_on TEXT NOT NULL,

  FOREIGN KEY (document) REFERENCES documents(id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (depends_on) REFERENCES documents(name) DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (document, depends_on)
);

-----------------------------------------------------------
-- Document Tables
-----------------------------------------------------------

CREATE TABLE document_variables (
 	id INTEGER PRIMARY KEY AUTOINCREMENT,
    document TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    type_modifiers TEXT,
    default_value INT,
    row INTEGER NOT NULL,
    column INTEGER NOT NULL,

    FOREIGN KEY (default_value) REFERENCES argument_values(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (document) REFERENCES documents(id),
    UNIQUE (document, name)
);

-- this is pulled out separately from operations and fragments so foreign keys can be used
CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
  	kind TEXT NOT NULL CHECK (kind IN ('query', 'mutation', 'subscription', 'fragment')),
		internal boolean default false,
		visible boolean default true,
		processed boolean default false,
	  raw_document INTEGER,
    printed TEXT,
    hash TEXT,
    type_condition TEXT,
    FOREIGN KEY (type_condition) REFERENCES types(name) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (raw_document) REFERENCES raw_documents(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE selections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    field_name TEXT NOT NULL,
		kind TEXT NOT NULL CHECK (kind IN ('field', 'fragment', 'inline_fragment')),
    alias TEXT,
    type TEXT, -- should be something like User.Avatar
    fragment_ref TEXT, -- used when fragment arguments cause a hash to be inlined (removing the ability to track what the original fragment is)
		fragment_args JSON, -- used to store the arguments that are used when fragment variables are expanded
    FOREIGN KEY (type) REFERENCES type_fields(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE selection_directives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    selection_id INTEGER NOT NULL,
    directive TEXT NOT NULL,
    row INTEGER NOT NULL,
    column INTEGER NOT NULL,
    FOREIGN KEY (selection_id) REFERENCES selections(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (directive) REFERENCES directives(name) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE selection_directive_arguments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent INTEGER NOT NULL,
    name TEXT NOT NULL,
    value INTEGER NOT NULL,
    document INTEGER NOT NULL,

    FOREIGN KEY (value) REFERENCES argument_values(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (parent) REFERENCES selection_directives(id) DEFERRABLE INITIALLY DEFERRED
    FOREIGN KEY (document) REFERENCES documents(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE document_directives (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	document int NOT NULL,
	directive TEXT NOT NULL,
	row INTEGER NOT NULL,
	column INTEGER NOT NULL,
	FOREIGN KEY (document) REFERENCES documents(id) DEFERRABLE INITIALLY DEFERRED,
	FOREIGN KEY (directive) REFERENCES directives(name) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE document_directive_arguments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent INTEGER NOT NULL,
    name TEXT NOT NULL,
    value INTEGER NOT NULL,

    FOREIGN KEY (value) REFERENCES argument_values(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (parent) REFERENCES document_directives(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE selection_refs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER,
    child_id INTEGER NOT NULL,
    path_index INTEGER NOT NULL,
    document INTEGER NOT NULL,
	row INTEGER NOT NULL,
	column INTEGER NOT NULL,
	internal BOOLEAN NOT NULL DEFAULT false,
    FOREIGN KEY (parent_id) REFERENCES selections(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (child_id) REFERENCES selections(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (document) REFERENCES documents(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE selection_arguments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    selection_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    value INTEGER NOT NULL,
	row INTEGER NOT NULL,
	column INTEGER NOT NULL,
    field_argument TEXT NOT NULL,
  document INTEGER NOT NULL,

    FOREIGN KEY (value) REFERENCES argument_values(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (selection_id) REFERENCES selections(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (document) REFERENCES documents(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (field_argument) REFERENCES type_field_arguments(id) DEFERRABLE INITIALLY DEFERRED
);


CREATE TABLE argument_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK (kind IN ('Variable', 'Int', 'Float', 'String', 'Block', 'Boolean', 'Null', 'Enum', 'List', 'Object')),
    raw TEXT NOT NULL,
    row INTEGER NOT NULL,
    column INTEGER NOT NULL,
    expected_type TEXT NOT NULL,
    expected_type_modifiers TEXT,
    document INTEGER NOT NULL,

    FOREIGN KEY (document) REFERENCES documents(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (expected_type) REFERENCES types(name) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE argument_value_children (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    parent INTEGER NOT NULL,
    value INTEGER NOT NULL,
    row INTEGER NOT NULL,
    column INTEGER NOT NULL,
    document INTEGER NOT NULL,

    FOREIGN KEY (document) REFERENCES documents(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (parent) REFERENCES argument_values(id) DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (value) REFERENCES argument_values(id) DEFERRABLE INITIALLY DEFERRED
);
`

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
