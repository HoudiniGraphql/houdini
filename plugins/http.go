package plugins

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

// the hooks that a plugin defines dictate a set of events that the plugin must repond to
func pluginHooks[PluginConfig any](ctx context.Context, plugin HoudiniPlugin[PluginConfig]) []string {
	hooks := map[string]bool{}
	if _, ok := plugin.(IncludeRuntime); ok {
		hooks["Generate"] = true
		http.Handle("/generate", EventHook(ctx, handleGenerate(plugin)))
	}
	if _, ok := plugin.(StaticRuntime); ok {
		hooks["AfterLoad"] = true
		http.Handle("/afterload", EventHook(ctx, handleAfterLoad(plugin)))
	}
	if _, ok := plugin.(TransformRuntime); ok {
		hooks["Generate"] = true
		http.Handle("/generate", EventHook(ctx, handleGenerate(plugin)))
	}
	if _, ok := plugin.(Config); ok {
		hooks["Config"] = true
	}
	if p, ok := plugin.(Environment); ok {
		hooks["Environment"] = true
		http.Handle("/environment", handleEnvironment(ctx, p))
	}
	if _, ok := plugin.(AfterLoad); ok {
		hooks["AfterLoad"] = true
		http.Handle("/afterload", EventHook(ctx, handleAfterLoad(plugin)))
	}
	if p, ok := plugin.(ExtractDocuments); ok {
		hooks["ExtractDocuments"] = true
		http.Handle("/extractdocuments", EventHook(ctx, p.ExtractDocuments))
	}
	if p, ok := plugin.(AfterExtract); ok {
		hooks["AfterExtract"] = true
		http.Handle("/afterextract", EventHook(ctx, p.AfterExtract))
	}
	if p, ok := plugin.(Schema); ok {
		hooks["Schema"] = true
		http.Handle("/schema", EventHook(ctx, p.Schema))
	}
	if p, ok := plugin.(BeforeValidate); ok {
		hooks["BeforeValidate"] = true
		http.Handle("/beforevalidate", EventHook(ctx, p.BeforeValidate))
	}
	if p, ok := plugin.(Validate); ok {
		hooks["Validate"] = true
		http.Handle("/validate", EventHook(ctx, p.Validate))
	}
	if p, ok := plugin.(AfterValidate); ok {
		hooks["AfterValidate"] = true
		http.Handle("/aftervalidate", EventHook(ctx, p.AfterValidate))
	}
	if _, ok := plugin.(BeforeGenerate); ok {
		hooks["BeforeGenerate"] = true
		http.Handle("/beforegenerate", EventHook(ctx, handleBeforeGenerate(plugin)))
	}
	if _, ok := plugin.(Generate); ok {
		hooks["Generate"] = true
		http.Handle("/generate", EventHook(ctx, handleGenerate(plugin)))
	}
	if _, ok := plugin.(ArtifactData); ok {
		hooks["AfterGenerate"] = true
		http.Handle("/aftergenerate", EventHook(ctx, handleAfterGenerate(plugin)))
	}
	if _, ok := plugin.(Hash); ok {
		hooks["BeforeGenerate"] = true
		http.Handle("/aftergenerate", EventHook(ctx, handleBeforeGenerate(plugin)))
	}
	if _, ok := plugin.(GraphQLTagReturn); ok {
		hooks["AfterGenerate"] = true
		http.Handle("/aftergenerate", EventHook(ctx, handleAfterGenerate(plugin)))
	}
	if _, ok := plugin.(IndexFile); ok {
		hooks["AfterGenerate"] = true
		http.Handle("/aftergenerate", EventHook(ctx, handleAfterGenerate(plugin)))
	}
	if _, ok := plugin.(ArtifactEnd); ok {
		hooks["AfterGenerate"] = true
		http.Handle("/aftergenerate", EventHook(ctx, handleAfterGenerate(plugin)))
	}
	if p, ok := plugin.(ClientPlugins); ok {
		hooks["ClientPlugins"] = true
		http.Handle("/clientplugins", JSONHook(ctx, p.ClientPlugins))
	}
	if p, ok := plugin.(TransformFile); ok {
		hooks["TransformFile"] = true
		http.Handle("/transformfile", handleTransformFile(ctx, p))
	}

	// get the unique hooks this plugin cares about
	hookStrs := []string{}
	for hook := range hooks {
		hookStrs = append(hookStrs, hook)
	}

	return hookStrs
}

func JSONHook[T any](ctx context.Context, hook func(ctx context.Context) (T, error)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// call the function
		data, err := hook(ctx)
		if err != nil {
			handleError(w, err)
			return
		}

		// write the response
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(data)
	})

}

func EventHook(ctx context.Context, hook func(ctx context.Context) error) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// call the function
		err := hook(ctx)
		if err != nil {
			handleError(w, err)
			return
		}

		// write the response
		w.WriteHeader(http.StatusOK)
	})

}

func handleGenerate[PluginConfig any](plugin HoudiniPlugin[PluginConfig]) func(ctx context.Context) error {
	return func(ctx context.Context) error {
		// if the plugin defines a runtime to include
		if includeRuntime, ok := plugin.(IncludeRuntime); ok {
			runtimePath, err := includeRuntime.IncludeRuntime(ctx)
			if err != nil {
				return err
			}
			fmt.Println("include runtime", runtimePath)
		}

		// nothing went wrong
		return nil
	}
}

func handleAfterLoad[PluginConfig any](plugin HoudiniPlugin[PluginConfig]) func(ctx context.Context) error {
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

func handleTransformFile(ctx context.Context, plugin TransformFile) http.Handler {
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
		updated, err := plugin.TransformFile(ctx, payload.Filename, payload.Source)
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

func handleBeforeGenerate[PluginConfig any](plugin HoudiniPlugin[PluginConfig]) func(ctx context.Context) error {
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

func handleAfterGenerate[PluginConfig any](plugin HoudiniPlugin[PluginConfig]) func(ctx context.Context) error {
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
		json.NewEncoder(w).Encode(pluginErr)
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
