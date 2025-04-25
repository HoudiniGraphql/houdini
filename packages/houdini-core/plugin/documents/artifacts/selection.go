package artifacts

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"path"
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
) error {
	// load the project config
	projectConfig, err := db.ProjectConfig(ctx)

	// generate the artifact content
	artifact, err := GenerateSelectionDocument(ctx, db, conn, docs, name, selection)
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
	selectionValues := stringifySelection(selection, 1)

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

func stringifySelection(selections []*CollectedSelection, level int) string {
	indent := strings.Repeat(spacing, level)
	indent2 := strings.Repeat(spacing, level+1)
	indent3 := strings.Repeat(spacing, level+2)
	indent4 := strings.Repeat(spacing, level+3)

	// we need to build up a stringified version of the selection set
	fields := ""
	fragments := ""
	abstractFields := ""
	abstractTypeMap := ""

	for _, selection := range selections {
		switch selection.Kind {

		// add field serialization
		case "field":

			if len(fields) > 0 {
				fields += "\n"
			}

			fields += stringifyFieldSelection(level, selection)

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
						subSelection += stringifyFieldSelection(level+2, field)
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

		result += fmt.Sprintf(`%s"abstractFields": {
%s"fields": {
%s%s},

%s"typeMap": {
%s
%s}
%s},`, indent2,
			indent3,
			abstractFields,
			indent3,
			indent3,
			abstractTypeMap,
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

func stringifyFieldSelection(level int, selection *CollectedSelection) string {
	indent3 := strings.Repeat(spacing, level+2)
	indent4 := strings.Repeat(spacing, level+3)

	// we need to generate the subselection
	subSelection := ""
	if len(selection.Children) > 0 {
		subSelection += fmt.Sprintf(`

%s"selection": %s,`, indent4, stringifySelection(selection.Children, level+3))

		subSelection += "\n"
	}

	result := ""

	// we only want to include the visible key when its true
	visible := fmt.Sprintf(`
%s"visible": true,
`, indent4)
	if selection.Hidden {
		visible = "\n"
	}

	result += fmt.Sprintf(`%s"%s": {
%s"type": "%s",
%s"keyRaw": "%s",%s%s%s},
`,
		indent3,
		*selection.Alias,
		indent4,
		selection.FieldType,
		indent4,
		keyField(selection),
		subSelection,
		visible,
		indent3,
	)

	return result
}
