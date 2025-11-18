package plugins

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"path/filepath"
	"sort"

	"github.com/spf13/afero"
)

// the hooks that a plugin defines dictate a set of events that the plugin must repond to
func pluginHooks[PluginConfig any](
	ctx context.Context,
	plugin HoudiniPlugin[PluginConfig],
) []string {
	hooks := map[string]struct{}{}
	registered := map[string]struct{}{} // path -> registered

	register := func(path, hookName string, cond bool, handler http.Handler) {
		if !cond {
			return
		}
		hooks[hookName] = struct{}{}
		if _, ok := registered[path]; ok {
			return
		}
		http.Handle(path, handler)
		registered[path] = struct{}{}
	}

	// --- AfterLoad is triggered for StaticRuntime OR AfterLoad
	_, isStaticRuntime := plugin.(StaticRuntime)
	_, isAfterLoad := plugin.(AfterLoad)
	_, hasDefaultConfig := plugin.(DefaultConfig[PluginConfig])
	register("/afterload", "AfterLoad", isStaticRuntime || isAfterLoad || hasDefaultConfig,
		InjectContext(EventHook(handleAfterLoad(plugin))))

	// --- GenerateRuntime is triggered for IncludeRuntime OR GenerateRuntime
	_, isIncludeRuntime := plugin.(IncludeRuntime)
	_, isGenerateRuntime := plugin.(GenerateRuntime)
	_, isConfig := plugin.(Config)
	register(
		"/generateruntime", "GenerateRuntime",
		isIncludeRuntime || isGenerateRuntime || isConfig,
		InjectContext(EventHookWithResponse(handleGenerateRuntime(plugin))),
	)

	// --- Environment
	if p, ok := plugin.(Environment); ok {
		register("/environment", "Environment", true,
			InjectContext(handleEnvironment(ctx, p)))
	}

	// --- ExtractDocuments
	if p, ok := plugin.(ExtractDocuments); ok {
		register("/extractdocuments", "ExtractDocuments", true,
			InjectContext(EventHookWithInput(p.ExtractDocuments)))
	}

	// --- AfterExtract
	if p, ok := plugin.(AfterExtract); ok {
		register("/afterextract", "AfterExtract", true,
			InjectContext(EventHook(p.AfterExtract)))
	}

	// --- Schema
	if p, ok := plugin.(Schema); ok {
		register("/schema", "Schema", true,
			InjectContext(EventHook(p.Schema)))
	}

	// --- BeforeValidate
	if p, ok := plugin.(BeforeValidate); ok {
		register("/beforevalidate", "BeforeValidate", true,
			InjectContext(EventHook(p.BeforeValidate)))
	}

	// --- Validate
	if p, ok := plugin.(Validate); ok {
		register("/validate", "Validate", true,
			InjectContext(EventHook(p.Validate)))
	}

	// --- AfterValidate
	if p, ok := plugin.(AfterValidate); ok {
		register("/aftervalidate", "AfterValidate", true,
			InjectContext(EventHook(p.AfterValidate)))
	}

	// --- BeforeGenerate
	if p, ok := plugin.(BeforeGenerate); ok {
		register("/beforegenerate", "BeforeGenerate", true,
			InjectContext(EventHook(p.BeforeGenerate)))
	}

	// --- GenerateDocuments
	if p, ok := plugin.(GenerateDocuments); ok {
		register("/generatedocuments", "GenerateDocuments", true,
			InjectContext(EventHookWithResponse(p.GenerateDocuments)))
	}

	// --- AfterGenerate
	if p, ok := plugin.(AfterGenerate); ok {
		register("/aftergenerate", "AfterGenerate", true,
			InjectContext(EventHook(p.AfterGenerate)))
	}

	if _, ok := plugin.(IndexFile); ok {
		register("/IndexFile", "IndexFile", true,
			InjectContext(EventHook(handleIndexFile(plugin))))
	}

	// return stable list
	out := make([]string, 0, len(hooks))
	for h := range hooks {
		out = append(out, h)
	}
	sort.Strings(out)
	return out
}

func InjectContext(next http.Handler) http.Handler {
	// the task id is passed in the request headers
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// get the task id from the request headers
		taskID := r.Header.Get("X-Task-Id")

		// add the task id to the context
		ctx := ContextWithPluginDir(
			ContextWithTaskID(r.Context(), taskID),
			r.Header.Get("X-Plugin-Directory"),
		)

		// call the next handler
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func JSONHook[T any](hook func(ctx context.Context) (T, error)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// call the function
		data, err := hook(r.Context())
		if err != nil {
			handleError(w, err)
			return
		}

		// write the response
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(data)
	})
}

func EventHook(hook func(context.Context) error) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// call the function
		err := hook(r.Context())
		if err != nil {
			handleError(w, err)
			return
		}

		// write the response
		w.WriteHeader(http.StatusOK)
	})
}

func EventHookWithResponse[Response any](
	hook func(context.Context) (Response, error),
) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// call the function
		result, err := hook(r.Context())
		if err != nil {
			handleError(w, err)
			return
		}

		// write the response
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(result); err != nil {
			handleError(w, err)
			return
		}
	})
}

func EventHookWithInput[T any](hook func(context.Context, T) error) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// parse the input from the request body
		var input T

		const maxBody = 1 << 20 // 1MB
		defer r.Body.Close()
		err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBody)).Decode(&input)
		if err != nil && !errors.Is(err, io.EOF) {
			handleError(w, err)
			return
		}

		// call the function
		err = hook(r.Context(), input)
		if err != nil {
			handleError(w, err)
			return
		}
	})
}

type ExtractDocumentsInput struct {
	Filepaths []string `json:"filepaths"`
}

func handleIndexFile[PluginConfig any](
	plugin HoudiniPlugin[PluginConfig],
) func(ctx context.Context) error {
	return func(ctx context.Context) error {
		config, err := plugin.Database().ProjectConfig(ctx)
		if err != nil {
			return err
		}

		updater := plugin.(IndexFile)

		targetPath := filepath.Join(config.ProjectRoot, config.RuntimeDir, "index.ts")

		content, err := updater.IndexFile(ctx, targetPath)
		if err != nil {
			return err
		}

		existingContent, err := afero.ReadFile(plugin.Filesystem(), targetPath)
		if err != nil {
			return err
		}

		newContent := string(existingContent) + "\n" + content

		err = afero.WriteFile(plugin.Filesystem(), targetPath, []byte(newContent), 0644)
		if err != nil {
			return err
		}

		return nil
	}
}

func handleGenerateRuntime[PluginConfig any](
	plugin HoudiniPlugin[PluginConfig],
) func(ctx context.Context) ([]string, error) {
	return func(ctx context.Context) ([]string, error) {
		// Use the OS filesystem for production
		return CopyPluginRuntime(ctx, plugin, afero.NewOsFs())
	}
}

func handleAfterLoad[PluginConfig any](
	plugin HoudiniPlugin[PluginConfig],
) func(ctx context.Context) error {
	return func(ctx context.Context) error {
		// if the plugin specifies default configuration values we should load that
		// before anything else
		if defaultConfig, ok := plugin.(DefaultConfig[PluginConfig]); ok {
			config, err := defaultConfig.DefaultConfig(ctx)
			if err != nil {
				return err
			}

			marshaled, err := json.Marshal(config)
			if err != nil {
				return err
			}

			// now that we have the updated values we need to persist them to the databse
			updateConfig := `
				UPDATE plugins SET config = $config WHERE name = $name
			`
			err = plugin.Database().ExecQuery(ctx, updateConfig, map[string]any{
				"config": string(marshaled),
				"name":   plugin.Name(),
			})
			if err != nil {
				return err
			}
		}

		// if the plugin defines a runtime to include
		if staticRuntime, ok := plugin.(StaticRuntime); ok {
			config, err := plugin.Database().ProjectConfig(ctx)
			if err != nil {
				return err
			}

			runtimePath, err := staticRuntime.StaticRuntime(ctx)
			if err != nil {
				return err
			}

			runtimeSource := filepath.Join(PluginDirFromContext(ctx), runtimePath)
			targetPath := config.PluginStaticRuntimeDirectory(plugin.Name())

			// the plugin could have defined a transform for the runtime
			transform := func(ctx context.Context, source string, content string) (string, error) { return content, nil }
			if transformer, ok := plugin.(TransformStaticRuntime); ok {
				transform = transformer.TransformStaticRuntime
			}

			// copy the plugin runtime to the runtime directory
			_, err = RecursiveCopy(ctx, afero.NewOsFs(), runtimeSource, targetPath, transform)
			if err != nil {
				return err
			}
		}

		if p, ok := plugin.(AfterLoad); ok {
			return p.AfterLoad(ctx)
		}

		// nothing went wrong
		return nil
	}
}

func handleEnvironment(ctx context.Context, plugin Environment) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// the include and exclude paramters come as json in the request body
		payload := struct {
			Mode string `json:"mode"`
		}{}
		err := json.NewDecoder(r.Body).Decode(&payload)
		if err != nil {
			handleError(w, err)
			return
		}

		// invoke the extraction logic
		value, err := plugin.Environment(ctx, payload.Mode)
		if err != nil {
			handleError(w, err)
			return
		}

		// serialize the value as the response
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(value)
	})
}

func handleError(w http.ResponseWriter, err error) {
	w.WriteHeader(http.StatusInternalServerError)

	// if the error is a list of plugin errors then we should serialize the full list
	if pluginErr, ok := err.(*ErrorList); ok {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(pluginErr.GetItems())
		return
	}

	// the error could just be a single error
	if pluginErr, ok := err.(*Error); ok {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(pluginErr)
		return
	}

	// otherwise we should just serialize the error message
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": err.Error()})
}
