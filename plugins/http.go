package plugins

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path"
)

// the hooks that a plugin defines dictate a set of events that the plugin must repond to
func pluginHooks[PluginConfig any](
	ctx context.Context,
	plugin HoudiniPlugin[PluginConfig],
) []string {
	hooks := map[string]bool{}
	if _, ok := plugin.(StaticRuntime); ok {
		hooks["AfterLoad"] = true
		http.Handle("/afterload", InjectContext(EventHook(handleAfterLoad(plugin))))
	}
	if _, ok := plugin.(IncludeRuntime); ok {
		hooks["GenerateRuntime"] = true
		http.Handle(
			"/generateruntime",
			InjectContext(EventHookWithResponse(handleGenerateRuntime(plugin))),
		)
	}
	if _, ok := plugin.(GenerateRuntime); ok {
		if _, ok := plugin.(IncludeRuntime); !ok {
			hooks["GenerateRuntime"] = true
			http.Handle(
				"/generateruntime",
				InjectContext(EventHookWithResponse(handleGenerateRuntime(plugin))),
			)
		}
	}
	if _, ok := plugin.(Config); ok {
		hooks["Config"] = true
		// TODO: support config hook
	}
	if p, ok := plugin.(Environment); ok {
		hooks["Environment"] = true
		http.Handle("/environment", InjectContext(handleEnvironment(ctx, p)))
	}
	if _, ok := plugin.(AfterLoad); ok {
		hooks["AfterLoad"] = true
		http.Handle("/afterload", InjectContext(EventHook(handleAfterLoad(plugin))))
	}
	if p, ok := plugin.(ExtractDocuments); ok {
		hooks["ExtractDocuments"] = true
		http.Handle(
			"/extractdocuments",
			InjectContext(EventHookWithInput(p.ExtractDocuments)),
		)
	}
	if p, ok := plugin.(AfterExtract); ok {
		hooks["AfterExtract"] = true
		http.Handle("/afterextract", InjectContext(EventHook(p.AfterExtract)))
	}
	if p, ok := plugin.(Schema); ok {
		hooks["Schema"] = true
		http.Handle("/schema", InjectContext(EventHook(p.Schema)))
	}
	if p, ok := plugin.(BeforeValidate); ok {
		hooks["BeforeValidate"] = true
		http.Handle("/beforevalidate", InjectContext(EventHook(p.BeforeValidate)))
	}
	if p, ok := plugin.(Validate); ok {
		hooks["Validate"] = true
		http.Handle("/validate", InjectContext(EventHook(p.Validate)))
	}
	if p, ok := plugin.(AfterValidate); ok {
		hooks["AfterValidate"] = true
		http.Handle("/aftervalidate", InjectContext(EventHook(p.AfterValidate)))
	}
	if _, ok := plugin.(BeforeGenerate); ok {
		hooks["BeforeGenerate"] = true
		http.Handle("/beforegenerate", InjectContext(EventHook(handleBeforeGenerate(plugin))))
	}
	if p, ok := plugin.(Generate); ok {
		hooks["Generate"] = true
		http.Handle("/generate", InjectContext(EventHookWithResponse(p.Generate)))
	}
	if _, ok := plugin.(ArtifactData); ok {
		hooks["AfterGenerate"] = true
		http.Handle("/aftergenerate", InjectContext(EventHook(handleAfterGenerate(plugin))))
	}
	if _, ok := plugin.(Hash); ok {
		hooks["Hash"] = true
		http.Handle("/aftergenerate", InjectContext(EventHook(handleBeforeGenerate(plugin))))
	}
	if _, ok := plugin.(GraphQLTagReturn); ok {
		hooks["AfterGenerate"] = true
		http.Handle("/aftergenerate", InjectContext(EventHook(handleAfterGenerate(plugin))))
	}
	if _, ok := plugin.(IndexFile); ok {
		hooks["AfterGenerate"] = true
		http.Handle("/aftergenerate", InjectContext(EventHook(handleAfterGenerate(plugin))))
	}
	if _, ok := plugin.(ArtifactEnd); ok {
		hooks["AfterGenerate"] = true
		http.Handle("/aftergenerate", InjectContext(EventHook(handleAfterGenerate(plugin))))
	}
	if p, ok := plugin.(ClientPlugins); ok {
		hooks["ClientPlugins"] = true
		http.Handle("/clientplugins", InjectContext(JSONHook(p.ClientPlugins)))
	}
	if p, ok := plugin.(TransformFile); ok {
		hooks["TransformFile"] = true
		http.Handle("/transformfile", InjectContext(handleTransformFile(p)))
	}

	// get the unique hooks this plugin cares about
	hookStrs := []string{}
	for hook := range hooks {
		hookStrs = append(hookStrs, hook)
	}

	return hookStrs
}

func InjectContext(next http.Handler) http.Handler {
	// the task id is passed in the request headers
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// get the task id from the request headers
		taskID := r.Header.Get("X-Task-ID")

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

func handleGenerateRuntime[PluginConfig any](
	plugin HoudiniPlugin[PluginConfig],
) func(ctx context.Context) ([]string, error) {
	return func(ctx context.Context) ([]string, error) {
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
			updated, err := RecursiveCopy(ctx, runtimePath, targetPath, transform)
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

func handleAfterLoad[PluginConfig any](
	plugin HoudiniPlugin[PluginConfig],
) func(ctx context.Context) error {
	return func(ctx context.Context) error {
		// if the plugin defines a runtime to include
		if staticRuntime, ok := plugin.(StaticRuntime); ok {
			runtimePath, err := staticRuntime.StaticRuntime(ctx)
			if err != nil {
				return err
			}

			if _, ok := plugin.(TransformRuntime); ok {
				fmt.Println("transform runtime")
			}

			fmt.Println("static runtime", runtimePath)
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

func handleTransformFile(plugin TransformFile) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// the include and exclude paramters come as json in the request body
		payload := struct {
			Filename string `json:"filename"`
			Source   string `json:"source"`
		}{}
		err := json.NewDecoder(r.Body).Decode(&payload)
		if err != nil {
			handleError(w, err)
			return
		}

		// invoke the extraction logic
		updated, err := plugin.TransformFile(r.Context(), payload.Filename, payload.Source)
		if err != nil {
			handleError(w, err)
			return
		}

		// send the string back over the endpoint
		result := map[string]string{
			"result": updated,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	})
}

func handleBeforeGenerate[PluginConfig any](
	plugin HoudiniPlugin[PluginConfig],
) func(ctx context.Context) error {
	return func(ctx context.Context) error {
		// if the plugin defines a runtime to include
		if _, ok := plugin.(BeforeGenerate); ok {
			fmt.Println("generate generate")
		}

		if _, ok := plugin.(Hash); ok {
			fmt.Println("hash")
		}

		// nothing went wrong
		return nil
	}
}

func handleAfterGenerate[PluginConfig any](
	plugin HoudiniPlugin[PluginConfig],
) func(ctx context.Context) error {
	return func(ctx context.Context) error {
		// if the plugin defines a runtime to include
		if _, ok := plugin.(ArtifactData); ok {
			fmt.Println("artifact data")
		}

		if _, ok := plugin.(Hash); ok {
			fmt.Println("hash")
		}

		if _, ok := plugin.(GraphQLTagReturn); ok {
			fmt.Println("graphql tag return")
		}

		if _, ok := plugin.(IndexFile); ok {
			fmt.Println("index file")
		}

		if _, ok := plugin.(ArtifactEnd); ok {
			fmt.Println("artifact end")
		}

		// nothing went wrong
		return nil
	}
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
