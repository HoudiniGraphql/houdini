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
	artifact, err := GenerateSelectionDocument(ctx, db, conn, docs, name, selection, sortKeys)
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
	selectionValues := stringifySelection(docs, doc.TypeCondition, selection, 1, sortKeys)

	result := strings.TrimSpace(fmt.Sprintf(`
export default {
    "name": "%s",
    "kind": "%s",
    "hash": "%s",
    "raw": `+"`"+printed+"\n`"+`,

    "rootType": "%s",
    "stripVariables": %s,

    "selection": %s,

    "pluginData": %s,
    "policy": "%s",
    "partial": %v
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
		cachePolicy,
		partial,
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
    SELECT printed FROM documents WHERE name in (%s) ORDER BY name
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
	parentType string,
	selections []*CollectedSelection,
	level int,
	sortKeys bool,
) string {
	indent := strings.Repeat(spacing, level)
	indent2 := strings.Repeat(spacing, level+1)
	indent3 := strings.Repeat(spacing, level+2)
	indent4 := strings.Repeat(spacing, level+3)

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

			fields += stringifyFieldSelection(docs, level, selection, sortKeys)

		case "fragment":
			fragments += fmt.Sprintf(`%s"%s": {
%s"arguments": {}
%s},`, indent3, selection.FieldName, indent4, indent3)

		case "inline_fragment":
			// we need to generate the subselection
			subSelection := "{\n"
			if len(selection.Children) > 0 {
				for _, field := range selection.Children {
					if field.Kind == "field" {
						subSelection += stringifyFieldSelection(docs, level+2, field, sortKeys)
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
		return *field.Alias
	}

	return fmt.Sprintf(
		"%s%s",
		*field.Alias,
		printSelectionArguments(0, field.Arguments, map[string]bool{}),
	)
}

func stringifyFieldSelection(
	docs *CollectedDocuments,
	level int,
	selection *CollectedSelection,
	sortKeys bool,
) string {
	indent3 := strings.Repeat(spacing, level+2)
	indent4 := strings.Repeat(spacing, level+3)

	// we need to generate the subselection
	subSelection := ""
	if len(selection.Children) > 0 {
		subSelection += fmt.Sprintf(`

%s"selection": %s,`, indent4, stringifySelection(docs, selection.FieldType, selection.Children, level+3, sortKeys))

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

	// if the field is nullable we need to include an optional value
	nullable := ""
	if selection.TypeModifiers != nil && !strings.HasSuffix(*selection.TypeModifiers, "!") {
		nullable = fmt.Sprintf(`
%s"nullable": true,`, indent4)
	}

	result += fmt.Sprintf(`%s"%s": {
%s"type": "%s",
%s"keyRaw": "%s",%s%s%s%s
%s},
`,
		indent3,
		*selection.Alias,
		indent4,
		selection.FieldType,
		indent4,
		keyField(selection),
		nullable,
		subSelection,
		abstract,
		visible,
		indent3,
	)

	return result
}
