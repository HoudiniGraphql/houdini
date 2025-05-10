package artifacts

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"path"
	"sort"
	"strconv"
	"strings"

	"github.com/spf13/afero"
	"zombiezen.com/go/sqlite"

	"code.houdinigraphql.com/packages/houdini-core/config"
	"code.houdinigraphql.com/packages/houdini-core/plugin/schema"
	"code.houdinigraphql.com/plugins"
)

const spacing = "    "

func writeSelectionDocument(
	ctx context.Context,
	fs afero.Fs,
	db plugins.DatabasePool[config.PluginConfig],
	conn *sqlite.Conn,
	docs *CollectedDocuments,
	name string,
	selection []*CollectedSelection,
	sortKeys bool,
) error {
	// load the project config
	projectConfig, err := db.ProjectConfig(ctx)

	// generate the artifact content
	artifact, err := GenerateSelectionDocument(
		ctx,
		db,
		conn,
		docs,
		name,
		selection,
		sortKeys,
	)
	if err != nil {
		return err
	}

	// compute the filepath to write the artifact to
	artifactPath := path.Join(
		projectConfig.ProjectRoot,
		projectConfig.RuntimeDir,
		"artifacts",
		name+".js",
	)

	// write the file to disk
	err = afero.WriteFile(fs, artifactPath, []byte(artifact), 0644)
	if err != nil {
		return err
	}

	// we're done
	return nil
}

func GenerateSelectionDocument(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	conn *sqlite.Conn,
	docs *CollectedDocuments,
	name string,
	selection []*CollectedSelection,
	sortKeys bool,
) (string, error) {
	doc := docs.Selections[name]

	// in order to save cycles creating a json object and then printing it, we'll just
	// build up a string while we walk down the selection. This will also allow us to pull
	// a few tricks, for example selections that are duplicated can be defined as local
	// variables and added to the selection

	// generate the printed value
	printed, err := printedValue(ctx, db, conn, docs, name)
	if err != nil {
		return "", err
	}

	// the hash of the query is a function of the printed value
	hash := fmt.Sprintf("%x", sha256.Sum256([]byte(printed)))

	// figure out the kind of the document
	var kind string
	switch doc.Kind {
	case "query":
		kind = "HoudiniQuery"
	case "fragment":
		kind = "HoudiniFragment"
	case "mutation":
		kind = "HoudiniMutation"
	case "subscription":
		kind = "HoudiniSubscription"
	}

	// stringify the unused variables
	if doc.UnusedVariables == nil {
		doc.UnusedVariables = []string{}
	}
	stripVariables, err := json.Marshal(doc.UnusedVariables)
	if err != nil {
		return "", err
	}

	// collect plugin data
	pluginData, err := plugins.TriggerHook(ctx, db, "PluginData", map[string]any{"document": name})
	if err != nil {
		return "", err
	}
	marshaledData, err := json.Marshal(pluginData)
	if err != nil {
		return "", err
	}

	// we need to compute the cache policy for the document
	projectConfig, err := db.ProjectConfig(ctx)
	if err != nil {
		return "", err
	}
	cachePolicy := projectConfig.DefaultCachePolicy
	partial := projectConfig.DefaultPartial
	for _, directive := range doc.Directives {
		if directive.Name == schema.CacheDirective {
			for _, arg := range directive.Arguments {
				if arg.Name == "policy" {
					cachePolicy = arg.Value.Raw
				}
				if arg.Name == "partial" {
					partial, err = strconv.ParseBool(arg.Value.Raw)
					if err != nil {
						return "", err
					}
				}
			}
		}
	}

	// build up the selection string
	selectionValues := stringifySelection(
		docs,
		projectConfig,
		doc.TypeCondition,
		selection,
		1,
		sortKeys,
	)

	// build up the input specification
	inputTypes := ""
	if len(doc.Variables) > 0 {
		defaults := ""
		variableTypes := ""
		for _, variable := range doc.Variables {
			variableTypes += fmt.Sprintf(`
            "%s": "%s",`, variable.Name, variable.Type)
			if variable.DefaultValue != nil {
				defaults += fmt.Sprintf(`
            "%s": %s,`, variable.Name, printValue(variable.DefaultValue, map[string]bool{}))
			}
		}

		if len(defaults) > 0 {
			defaults += "\n        "
		}

		// the input type defs include a description for every input object
		// that is used in the query so we can correctly marshal the scalar values
		typeDefs := ""
		usedTypes := findUsedTypes(docs, doc.Variables)

		if sortKeys {
			sort.Strings(usedTypes)
		}
		for _, inputType := range usedTypes {
			fields := ""

			// we might have to sort the keys in the input type
			if sortKeys {
				inputKeys := []string{}
				for key := range docs.InputTypes[inputType] {
					inputKeys = append(inputKeys, key)
				}
				sort.Strings(inputKeys)
				for _, key := range inputKeys {
					fields += fmt.Sprintf(`
                "%s": "%s",`, key, docs.InputTypes[inputType][key])
				}
			} else {
				for key, value := range docs.InputTypes[inputType] {
					fields += fmt.Sprintf(`
                "%s": "%s",`, key, value)
				}
			}

			typeDefs += fmt.Sprintf(`
            "%s": {%s
            },`, inputType, fields)
		}
		if len(usedTypes) > 0 {
			typeDefs += "\n        "
		}

		inputTypes = fmt.Sprintf(`

    "input": {
        "fields": {%s
        },

        "types": {%s},

        "defaults": {%s},

        "runtimeScalars": {},
    },
`, variableTypes, typeDefs, defaults)
	}

	// we only consider policy and partial values for queries
	policyValue := ""
	partialValue := ""
	if kind == "HoudiniQuery" || kind == "HoudiniFragment" {
		policyValue = fmt.Sprintf(`
    "policy": "%s",`, cachePolicy)
		partialValue = fmt.Sprintf(`
    "partial": %v`, partial)
	}

	result := strings.TrimSpace(fmt.Sprintf(`
export default {
    "name": "%s",
    "kind": "%s",
    "hash": "%s",
    "raw": `+"`"+printed+"\n`"+`,

    "rootType": "%s",
    "stripVariables": %s,

    "selection": %s,

    "pluginData": %s,%s%s%s
}

"HoudiniHash=%s"
  `,
		name,
		kind,
		hash,
		doc.TypeCondition,
		string(stripVariables),
		selectionValues,
		string(marshaledData),
		inputTypes,
		policyValue,
		partialValue,
		hash,
	))

	return result, nil
}

func printedValue(
	ctx context.Context,
	db plugins.DatabasePool[config.PluginConfig],
	conn *sqlite.Conn,
	docs *CollectedDocuments,
	name string,
) (string, error) {
	// we need to generate a printed version of the document which is just a concatenated print
	// of the parent doc and every referenced fragment
	printed := ""

	dependentDocs := []string{fmt.Sprintf("'%s'", name)}
	for _, fragment := range docs.Selections[name].ReferencedFragments {
		dependentDocs = append(dependentDocs, fmt.Sprintf("'%s'", fragment))
	}

	// the query that looks up the printed value needs a whereIn for every referenced document
	whereIn := strings.Join(dependentDocs, ", ")

	query, err := conn.Prepare(fmt.Sprintf(`
    SELECT printed, name FROM documents WHERE name in (%s) ORDER BY name
  `, whereIn))
	if err != nil {
		return "", err
	}
	defer query.Finalize()

	err = db.StepStatement(ctx, query, func() {
		printed += query.GetText("printed") + "\n\n"
	})
	if err != nil {
		return "", err
	}

	// we're done
	return printed[:len(printed)-2], nil
}

func stringifySelection(
	docs *CollectedDocuments,
	projectConfig plugins.ProjectConfig,
	parentType string,
	selections []*CollectedSelection,
	level int,
	sortKeys bool,
) string {
	indent := strings.Repeat(spacing, level)
	indent2 := strings.Repeat(spacing, level+1)
	indent3 := strings.Repeat(spacing, level+2)
	indent4 := strings.Repeat(spacing, level+3)
	indent5 := strings.Repeat(spacing, level+4)

	// we need to build up a stringified version of the selection set
	fields := ""
	fragments := ""
	abstractFields := ""

	for _, selection := range selections {
		switch selection.Kind {

		// add field serialization
		case "field":

			if len(fields) > 0 {
				fields += "\n"
			}

			fields += stringifyFieldSelection(projectConfig, docs, level, selection, sortKeys)

		case "fragment":
			// the applied fragment might have arguments
			arguments := ""
			for _, directive := range selection.Directives {
				if directive.Name == schema.WithDirective {
					for _, arg := range directive.Arguments {
						arguments += fmt.Sprintf(`
%s"%s": %s`, indent5, arg.Name, serializeFragmentArgument(arg.Value, level+4))
					}
				}
			}
			if arguments != "" {
				arguments += "\n" + indent4
			}
			fragmentName := selection.FieldName
			if selection.FragmentRef != nil {
				fragmentName = *selection.FragmentRef
			}

			fragments += fmt.Sprintf(`%s"%s": {
%s"arguments": {%s}
%s},`, indent3, fragmentName, indent4, arguments, indent3)

		case "inline_fragment":
			// we need to generate the subselection
			subSelection := "{\n"
			if len(selection.Children) > 0 {
				for _, field := range selection.Children {
					if field.Kind == "field" {
						subSelection += stringifyFieldSelection(
							projectConfig,
							docs,
							level+2,
							field,
							sortKeys,
						)
					}
				}
				subSelection += fmt.Sprintf("%s},\n", indent4)
			}

			// every inline fragment represents a new abstract selection
			abstractFields += fmt.Sprintf(
				`%s"%s": %s`,
				indent4,
				selection.FieldName,
				subSelection,
			)
		}
	}

	// build up the final result
	result := ""

	// if there were concrete fields include them
	if len(fields) > 0 {
		result += fmt.Sprintf(`%s"fields": {
%s%s},`, indent2, fields, indent2)
	}

	// then add any fragment specifications we ran into
	if len(fragments) > 0 {
		if len(result) > 0 {
			result += "\n\n"
		}
		result += fmt.Sprintf(`%s"fragments": {
%s
%s},`, indent2, fragments, indent2)
	}

	// and finally include any abstract selections we ran into
	if len(abstractFields) > 0 {
		if len(result) > 0 {
			result += "\n"
		}

		// we need to compute the mapping from runtime types to which inline fragment we need to consider (if it exists)
		// to do this, we need to look at the selection for inline fragments, if there is an inline fragment on a concrete
		// type then the mapping is just ConcreteType -> ConcreteType. If the inline fragments are an abstract type then we
		// can assume there is only one possible intersection between the two abstract types (this is baked into the collection algorithm)
		// and every concrete type that implements the abstract type of the fragment that also implements the abstract type of the
		// parent needs to be mapped to the abstract inline fragment
		typeMap := map[string]string{}
		// we'll do this in 2 passes, once looking for concrete types and then once looking for abstract types
		for _, selection := range selections {
			if selection.Kind != "inline_fragment" {
				continue
			}

			// identify concrete types by looking for types that don't have any possible members
			if _, ok := docs.PossibleTypes[selection.FieldName]; !ok {
				// we have found a concrete type
				typeMap[selection.FieldName] = selection.FieldName
			}
		}

		// now we need to look at every inline fragment we found and see if it corresponds to an abstract type
		// that a concrete type of the parent implements
		for _, selection := range selections {
			if selection.Kind != "inline_fragment" {
				continue
			}

			// identify concrete types by looking for types that do have possible members
			if concreteTypes, ok := docs.PossibleTypes[selection.FieldName]; ok {
				for concreteType := range concreteTypes {
					if possibles, ok := docs.PossibleTypes[parentType]; ok {
						if _, ok := possibles[concreteType]; ok {
							typeMap[concreteType] = selection.FieldName
						}
					}
				}
			}
		}

		typeMapStr := ""
		if !sortKeys {
			for key, value := range typeMap {
				typeMapStr += fmt.Sprintf(`%s"%s": "%s",
`, indent4, key, value)
			}
		} else {
			keys := []string{}
			for key := range typeMap {
				keys = append(keys, key)
			}
			sort.Strings(keys)
			for _, key := range keys {
				typeMapStr += fmt.Sprintf(`%s"%s": "%s",
`, indent4, key, typeMap[key])
			}
		}

		result += fmt.Sprintf(`%s"abstractFields": {
%s"fields": {
%s%s},

%s"typeMap": {
%s%s}
%s},`, indent2,
			indent3,
			abstractFields,
			indent3,
			indent3,
			typeMapStr,
			indent3,
			indent2,
		)
	}

	return fmt.Sprintf(`{
%s
%s}`, result, indent)
}

func keyField(field *CollectedSelection) string {
	if len(field.Arguments) == 0 {
		return `"` + *field.Alias + `"`
	}

	escaped, _ := json.Marshal(fmt.Sprintf(
		"%s%s",
		*field.Alias,
		printSelectionArguments(0, field.Arguments, map[string]bool{}),
	))
	return string(escaped)
}

func stringifyFieldSelection(
	projectConfig plugins.ProjectConfig,
	docs *CollectedDocuments,
	level int,
	selection *CollectedSelection,
	sortKeys bool,
) string {
	indent3 := strings.Repeat(spacing, level+2)
	indent4 := strings.Repeat(spacing, level+3)
	indent5 := strings.Repeat(spacing, level+4)

	// we need to generate the subselection
	subSelection := ""
	if len(selection.Children) > 0 {
		subSelection += fmt.Sprintf(`

%s"selection": %s,`, indent4, stringifySelection(docs, projectConfig, selection.FieldType, selection.Children, level+3, sortKeys))

		subSelection += "\n"
	}

	result := ""

	// we only want to include the visible key when its true
	visible := fmt.Sprintf(`
%s"visible": true,`, indent4)
	if selection.Hidden {
		visible = ""
	}

	// only show the abstract field when its true
	abstract := ""
	isAbstract := false
	switch selection.Kind {
	case "inline_fragment":
		if len(docs.PossibleTypes[selection.FieldName]) > 0 {
			isAbstract = true
		}
	case "field":
		if len(docs.PossibleTypes[selection.FieldType]) > 0 {
			isAbstract = true
		}
	}
	if isAbstract {
		abstract = fmt.Sprintf(`
%s"abstract": true,`, indent4)
	}

	// we might need to look for operations
	operations := ""
	// look for fragments on the field for any indications of an operation
	for _, subSel := range selection.Children {
		operation := extractOperation(projectConfig, subSel)
		if operation == nil {
			continue
		}

		operations += fmt.Sprintf(`{
%s"action": "%s",
%s"list": "%s",
%s"position": "%s"
%s},
`, indent5, operation.Action, indent5, operation.ListName, indent5, operation.Position, indent4)

	}
	if operations != "" {
		operations = fmt.Sprintf(`

%s"operations": [%s],`, indent4, operations[:len(operations)-2])
	}

	// if the field is nullable we need to include an optional value
	nullable := ""
	if selection.TypeModifiers != nil && !strings.HasSuffix(*selection.TypeModifiers, "!") {
		nullable = fmt.Sprintf(`
%s"nullable": true,`, indent4)
	}

	result += fmt.Sprintf(`%s"%s": {
%s"type": "%s",
%s"keyRaw": %s,%s%s%s%s%s
%s},
`,
		indent3,
		*selection.Alias,
		indent4,
		selection.FieldType,
		indent4,
		keyField(selection),
		nullable,
		operations,
		subSelection,
		abstract,
		visible,
		indent3,
	)

	return result
}

func findUsedTypes(docs *CollectedDocuments, variables []*CollectedOperationVariable) []string {
	// we need a way to ensure we dont find ourselves in cyclic types
	foundTypes := map[string]bool{}

	queue := []string{}
	for _, vars := range variables {
		queue = append(queue, vars.Type)
	}

	for len(queue) > 0 {
		// dequeue
		target := queue[0]
		queue = queue[1:]

		// if we've already processed the type, dont worry about it
		if _, ok := foundTypes[target]; ok {
			continue
		}

		inputType, ok := docs.InputTypes[target]
		if !ok {
			continue
		}

		// record we encountered a used input type
		foundTypes[target] = true

		// the next thing to do is walk through the fields of the input type
		for _, fieldType := range inputType {
			queue = append(queue, fieldType)
		}
	}

	// build up the list of found types
	found := []string{}
	for key := range foundTypes {
		found = append(found, key)
	}
	return found
}

func extractOperation(
	config plugins.ProjectConfig,
	selection *CollectedSelection,
) *CollectedOperation {
	if selection.Kind != "fragment" {
		return nil
	}

	listName := ""
	action := ""
	position := config.DefaultListPosition
	if position == "" {
		position = "last"
	}

	// we found a fragment so now we should look for one of the magic suffix
	switch {
	case strings.Contains(selection.FieldName, schema.ListOperationSuffixInsert):
		listName = stripSuffix(selection.FieldName, schema.ListOperationSuffixInsert)
		action = "insert"
	case strings.Contains(selection.FieldName, schema.ListOperationSuffixDelete):
		listName = stripSuffix(selection.FieldName, schema.ListOperationSuffixDelete)
		action = "delete"
	case strings.Contains(selection.FieldName, schema.ListOperationSuffixRemove):
		listName = stripSuffix(selection.FieldName, schema.ListOperationSuffixRemove)
		action = "remove"
	case strings.Contains(selection.FieldName, schema.ListOperationSuffixToggle):
		listName = stripSuffix(selection.FieldName, schema.ListOperationSuffixToggle)
		action = "toggle"

	default:
		// the fragment doesn't end in one of the magic prefixes
		return nil
	}

	// to find the position we need to look at directives applied to the fragment
	for _, dir := range selection.Directives {
		switch dir.Name {
		case schema.PrependDirective:
			position = "first"
		case schema.AppendDirective:
			position = "last"
		}
	}

	return &CollectedOperation{
		ListName: listName,
		Action:   action,
		Position: position,
	}
}

type CollectedOperation struct {
	ListName string
	Action   string
	Position string
}

func stripSuffix(s string, suffix string) string {
	if i := strings.Index(s, suffix); i >= 0 {
		return s[:i]
	}
	return s
}

func serializeFragmentArgument(arg *CollectedArgumentValue, level int) string {
	indent0 := strings.Repeat(spacing, level)
	indent1 := strings.Repeat(spacing, level+1)
	// the first thing we need to do is figure out the kind
	var kind string
	switch arg.Kind {
	case "Variable":
		kind = "Variable"
	default:
		kind = arg.Kind + "Value"
	}

	// the attributes that define the node depend on the kind
	attrs := ""
	switch arg.Kind {
	case "Variable", "Int", "Float", "String", "Boolean", "Enum":
		attrs = fmt.Sprintf(`
%s"value": "%s"`, indent1, arg.Raw)
	case "Null":
		attrs = fmt.Sprintf(`
%s"value": null`, indent1)
	case "List":
		children := ""
		for _, child := range arg.Children {
			if len(children) > 0 {
				children += ", "
			}
			children += serializeFragmentArgument(child.Value, level+1)
		}

		attrs = fmt.Sprintf(`
%s"values": [%s]`, indent1, children,
		)
	case "Object":
		fields := ""
		for _, child := range arg.Children {
			if len(fields) > 0 {
				fields += ", "
			}
			fields += fmt.Sprintf(
				`{"%s": %s}`,
				child.Name,
				serializeFragmentArgument(child.Value, level+1),
			)
		}
	}

	return fmt.Sprintf(`{
%s"kind": "%s",%s
%s}`, indent1, kind, attrs, indent0)
}
