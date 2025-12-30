package plugins

import (
	"context"
	"encoding/json"
	"path"
	"path/filepath"
	"sort"

	"github.com/spf13/afero"
)

type HookHandler func(ctx context.Context, payload map[string]any) (any, error)

type RegisterFunc func(hookName string, handler HookHandler)

func registerPluginHooks[PluginConfig any](plugin HoudiniPlugin[PluginConfig], register RegisterFunc) []string {
	hooks := []string{}

	// --- Config
	hooks = append(hooks, "Config")
	register("Config", handleConfig(plugin))

	// --- AfterLoad is triggered for StaticRuntime OR AfterLoad OR DefaultConfig
	_, isStaticRuntime := plugin.(StaticRuntime)
	_, isAfterLoad := plugin.(AfterLoad)
	_, hasDefaultConfig := plugin.(DefaultConfig[PluginConfig])
	if isStaticRuntime || isAfterLoad || hasDefaultConfig {
		hooks = append(hooks, "AfterLoad")
		register("AfterLoad", handleAfterLoad(plugin))
	}

	// --- Schema
	if _, ok := plugin.(Schema); ok {
		hooks = append(hooks, "Schema")
		register("Schema", handleSchema(plugin))
	}

	// --- ExtractDocuments
	if _, ok := plugin.(ExtractDocuments); ok {
		hooks = append(hooks, "ExtractDocuments")
		register("ExtractDocuments", handleExtractDocuments(plugin))
	}

	// --- AfterExtract
	if _, ok := plugin.(AfterExtract); ok {
		hooks = append(hooks, "AfterExtract")
		register("AfterExtract", handleAfterExtract(plugin))
	}

	// --- BeforeValidate
	if _, ok := plugin.(BeforeValidate); ok {
		hooks = append(hooks, "BeforeValidate")
		register("BeforeValidate", handleBeforeValidate(plugin))
	}

	// --- Validate
	if _, ok := plugin.(Validate); ok {
		hooks = append(hooks, "Validate")
		register("Validate", handleValidate(plugin))
	}

	// --- AfterValidate
	if _, ok := plugin.(AfterValidate); ok {
		hooks = append(hooks, "AfterValidate")
		register("AfterValidate", handleAfterValidate(plugin))
	}

	// --- BeforeGenerate
	if _, ok := plugin.(BeforeGenerate); ok {
		hooks = append(hooks, "BeforeGenerate")
		register("BeforeGenerate", handleBeforeGenerate(plugin))
	}

	// --- GenerateDocuments
	if _, ok := plugin.(GenerateDocuments); ok {
		hooks = append(hooks, "GenerateDocuments")
		register("GenerateDocuments", handleGenerateDocuments(plugin))
	}

	// --- GenerateRuntime is triggered for IncludeRuntime OR GenerateRuntime OR Config
	_, isIncludeRuntime := plugin.(IncludeRuntime)
	_, isGenerateRuntime := plugin.(GenerateRuntime)
	_, isConfig := plugin.(Config)
	if isIncludeRuntime || isGenerateRuntime || isConfig {
		hooks = append(hooks, "GenerateRuntime")
		register("GenerateRuntime", handleGenerateRuntime(plugin))
	}

	// --- AfterGenerate
	if _, ok := plugin.(AfterGenerate); ok {
		hooks = append(hooks, "AfterGenerate")
		register("AfterGenerate", handleAfterGenerate(plugin))
	}

	// --- Environment
	if _, ok := plugin.(Environment); ok {
		hooks = append(hooks, "Environment")
		register("Environment", handleEnvironment(plugin))
	}

	// --- IndexFile
	if _, ok := plugin.(IndexFile); ok {
		hooks = append(hooks, "IndexFile")
		register("IndexFile", handleIndexFile(plugin))
	}

	sort.Strings(hooks)
	return hooks
}

func handleConfig[PluginConfig any](plugin HoudiniPlugin[PluginConfig]) HookHandler {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		// if the plugin implements DefaultConfig, call it to get default values
		if defaultConfig, ok := plugin.(DefaultConfig[PluginConfig]); ok {
			return defaultConfig.DefaultConfig(ctx)
		}
		return nil, nil
	}
}

func handleAfterLoad[PluginConfig any](plugin HoudiniPlugin[PluginConfig]) HookHandler {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		// if the plugin specifies default configuration values we should load that before anything else
		if defaultConfig, ok := plugin.(DefaultConfig[PluginConfig]); ok {
			config, err := defaultConfig.DefaultConfig(ctx)
			if err != nil {
				return nil, err
			}

			marshaled, err := json.Marshal(config)
			if err != nil {
				return nil, err
			}

			updateConfig := `UPDATE plugins SET config = $config WHERE name = $name`
			err = plugin.Database().ExecQuery(ctx, updateConfig, map[string]any{
				"config": string(marshaled),
				"name":   plugin.Name(),
			})
			if err != nil {
				return nil, err
			}
		}

		// if the plugin defines a runtime to include
		if staticRuntime, ok := plugin.(StaticRuntime); ok {
			config, err := plugin.Database().ProjectConfig(ctx)
			if err != nil {
				return nil, err
			}

			runtimePath, err := staticRuntime.StaticRuntime(ctx)
			if err != nil {
				return nil, err
			}

			runtimeSource := path.Join(PluginDirFromContext(ctx), runtimePath)
			targetPath := config.PluginStaticRuntimeDirectory(plugin.Name())

			// the plugin could have defined a transform for the runtime
			transform := func(ctx context.Context, source string, content string) (string, error) { return content, nil }
			if transformer, ok := plugin.(TransformStaticRuntime); ok {
				transform = transformer.TransformStaticRuntime
			}

			// copy the plugin runtime to the runtime directory
			_, err = RecursiveCopy(ctx, afero.NewOsFs(), runtimeSource, targetPath, transform)
			if err != nil {
				return nil, err
			}
		}

		if p, ok := plugin.(AfterLoad); ok {
			return nil, p.AfterLoad(ctx)
		}

		// nothing went wrong
		return nil, nil
	}
}

func handleSchema[PluginConfig any](plugin HoudiniPlugin[PluginConfig]) HookHandler {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		if schema, ok := plugin.(Schema); ok {
			return nil, schema.Schema(ctx)
		}
		return nil, nil
	}
}

func handleExtractDocuments[PluginConfig any](plugin HoudiniPlugin[PluginConfig]) HookHandler {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		if extract, ok := plugin.(ExtractDocuments); ok {
			// Extract filepaths from payload - default to empty if not present
			var filepaths []string
			if filepathsRaw, ok := payload["filepaths"].([]interface{}); ok {
				filepaths = make([]string, len(filepathsRaw))
				for i, v := range filepathsRaw {
					filepaths[i], _ = v.(string)
				}
			}
			return nil, extract.ExtractDocuments(ctx, ExtractDocumentsInput{Filepaths: filepaths})
		}
		return nil, nil
	}
}

func handleAfterExtract[PluginConfig any](plugin HoudiniPlugin[PluginConfig]) HookHandler {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		if p, ok := plugin.(AfterExtract); ok {
			return nil, p.AfterExtract(ctx)
		}
		return nil, nil
	}
}

func handleBeforeValidate[PluginConfig any](plugin HoudiniPlugin[PluginConfig]) HookHandler {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		if p, ok := plugin.(BeforeValidate); ok {
			return nil, p.BeforeValidate(ctx)
		}
		return nil, nil
	}
}

func handleValidate[PluginConfig any](plugin HoudiniPlugin[PluginConfig]) HookHandler {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		if p, ok := plugin.(Validate); ok {
			return nil, p.Validate(ctx)
		}
		return nil, nil
	}
}

func handleAfterValidate[PluginConfig any](plugin HoudiniPlugin[PluginConfig]) HookHandler {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		if p, ok := plugin.(AfterValidate); ok {
			return nil, p.AfterValidate(ctx)
		}
		return nil, nil
	}
}

func handleBeforeGenerate[PluginConfig any](plugin HoudiniPlugin[PluginConfig]) HookHandler {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		if p, ok := plugin.(BeforeGenerate); ok {
			return nil, p.BeforeGenerate(ctx)
		}
		return nil, nil
	}
}

func handleGenerateDocuments[PluginConfig any](plugin HoudiniPlugin[PluginConfig]) HookHandler {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		if generate, ok := plugin.(GenerateDocuments); ok {
			return generate.GenerateDocuments(ctx)
		}
		return nil, nil
	}
}

func handleGenerateRuntime[PluginConfig any](plugin HoudiniPlugin[PluginConfig]) HookHandler {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		paths := []string{}

		if generate, ok := plugin.(GenerateRuntime); ok {
			filepaths, err := generate.GenerateRuntime(ctx)
			if err != nil {
				return nil, err
			}
			paths = append(paths, filepaths...)
		}

		// if the plugin defines a runtime to be included then we should include it now
		if includeRuntime, ok := plugin.(IncludeRuntime); ok {
			runtimeDir, err := includeRuntime.IncludeRuntime(ctx)
			if err != nil {
				return nil, err
			}

			config, err := plugin.Database().ProjectConfig(ctx)
			if err != nil {
				return nil, err
			}

			runtimePath := path.Join(PluginDirFromContext(ctx), runtimeDir)
			targetPath := config.PluginRuntimeDirectory(plugin.Name())

			// the plugin could have defined a transform for the runtime
			transform := func(ctx context.Context, source string, content string) (string, error) { return content, nil }
			if transformer, ok := plugin.(TransformRuntime); ok {
				transform = transformer.TransformRuntime
			}

			// copy the plugin runtime to the runtime directory
			updated, err := RecursiveCopy(ctx, afero.NewOsFs(), runtimePath, targetPath, transform)
			if err != nil {
				return nil, err
			}

			// add any updated paths to the list
			paths = append(paths, updated...)
		}

		// nothing went wrong
		return paths, nil
	}
}

func handleAfterGenerate[PluginConfig any](plugin HoudiniPlugin[PluginConfig]) HookHandler {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		if p, ok := plugin.(AfterGenerate); ok {
			return nil, p.AfterGenerate(ctx)
		}
		return nil, nil
	}
}

func handleEnvironment[PluginConfig any](plugin HoudiniPlugin[PluginConfig]) HookHandler {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		if env, ok := plugin.(Environment); ok {
			// the mode parameter comes as json in the request payload
			mode, _ := payload["mode"].(string)
			return env.Environment(ctx, mode)
		}
		return nil, nil
	}
}

func handleIndexFile[PluginConfig any](plugin HoudiniPlugin[PluginConfig]) HookHandler {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		config, err := plugin.Database().ProjectConfig(ctx)
		if err != nil {
			return nil, err
		}

		updater := plugin.(IndexFile)
		targetPath := filepath.Join(config.ProjectRoot, config.RuntimeDir, "index.ts")

		content, err := updater.IndexFile(ctx, targetPath)
		if err != nil {
			return nil, err
		}

		existingContent, err := afero.ReadFile(plugin.Filesystem(), targetPath)
		if err != nil {
			return nil, err
		}

		newContent := string(existingContent) + "\n" + content
		return nil, afero.WriteFile(plugin.Filesystem(), targetPath, []byte(newContent), 0644)
	}
}

type ExtractDocumentsInput struct {
	Filepaths []string `json:"filepaths"`
}
