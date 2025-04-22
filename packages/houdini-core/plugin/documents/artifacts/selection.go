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
		printed += query.GetText("printed")
	})
	if err != nil {
		return "", err
	}

	// we're done
	return printed, nil
}

func stringifySelection(selections []*CollectedSelection, level int) string {
	spacing := "    "

	ident := strings.Repeat(spacing, level)
	ident2 := strings.Repeat(spacing, level+1)
	ident3 := strings.Repeat(spacing, level+2)
	ident4 := strings.Repeat(spacing, level+3)

	// we need to build up a stringified version of the fields
	fields := ""
	for _, selection := range selections {
		switch selection.Kind {
		// add field serialization
		case "field":
			fields += fmt.Sprintf(`%s"%s": {
%s"type": "%s",
%s"keyRaw": "%s",
%s"visible": %v
%s}`,
				ident3,
				*selection.Alias,
				ident4,
				selection.FieldType,
				ident4,
				keyField(level, selection),
				ident4,
				!selection.Hidden,
				ident3,
			)

			// every field but the last needs a comma a new line
			fields += ",\n"
		}
	}

	return fmt.Sprintf(`{
%s"fields": {
%s%s},
%s}`, ident2, fields, ident2, ident)
}

func keyField(level int, field *CollectedSelection) string {
	if len(field.Arguments) == 0 {
		return *field.Alias
	}

	return fmt.Sprintf(
		"%s(%s)",
		*field.Alias,
		printSelectionArguments(level, field.Arguments, map[string]bool{}),
	)
}
