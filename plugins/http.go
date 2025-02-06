package plugins

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// the hooks that a plugin defines dictate a set of events that the plugin must repond to
func pluginHooks(plugin Plugin) []string {
	hooks := map[string]bool{}
	if _, ok := plugin.(IncludeRuntime); ok {
		hooks["Generate"] = true
		http.Handle("/generate", EventHook(handleGenerate(plugin)))
	}
	if _, ok := plugin.(StaticRuntime); ok {
		hooks["AfterLoad"] = true
		http.Handle("/afterload", EventHook(handleAfterLoad(plugin)))
	}
	if _, ok := plugin.(TransformRuntime); ok {
		hooks["Generate"] = true
		http.Handle("/generate", EventHook(handleGenerate(plugin)))
	}
	if _, ok := plugin.(Config); ok {
		hooks["Config"] = true
	}
	if p, ok := plugin.(Environment); ok {
		hooks["Environment"] = true
		http.Handle("/environment", handleEnvironment(p))
	}
	if _, ok := plugin.(AfterLoad); ok {
		hooks["AfterLoad"] = true
		http.Handle("/afterload", EventHook(handleAfterLoad(plugin)))
	}
	if p, ok := plugin.(ExtractDocuments); ok {
		hooks["ExtractDocuments"] = true
		http.Handle("/extractdocuments", EventHook(p.ExtractDocuments))
	}
	if p, ok := plugin.(AfterExtract); ok {
		hooks["AfterExtract"] = true
		http.Handle("/afterextract", EventHook(p.AfterExtract))
	}
	if p, ok := plugin.(Schema); ok {
		hooks["Schema"] = true
		http.Handle("/schema", EventHook(p.Schema))
	}
	if p, ok := plugin.(BeforeValidate); ok {
		hooks["BeforeValidate"] = true
		http.Handle("/beforevalidate", EventHook(p.BeforeValidate))
	}
	if p, ok := plugin.(Validate); ok {
		hooks["Validate"] = true
		http.Handle("/validate", EventHook(p.Validate))
	}
	if p, ok := plugin.(AfterValidate); ok {
		hooks["AfterValidate"] = true
		http.Handle("/aftervalidate", EventHook(p.AfterValidate))
	}
	if _, ok := plugin.(BeforeGenerate); ok {
		hooks["BeforeGenerate"] = true
		http.Handle("/beforegenerate", EventHook(handleBeforeGenerate(plugin)))
	}
	if _, ok := plugin.(Generate); ok {
		hooks["Generate"] = true
		http.Handle("/generate", EventHook(handleGenerate(plugin)))
	}
	if _, ok := plugin.(ArtifactData); ok {
		hooks["AfterGenerate"] = true
		http.Handle("/aftergenerate", EventHook(handleAfterGenerate(plugin)))
	}
	if _, ok := plugin.(Hash); ok {
		hooks["BeforeGenerate"] = true
		http.Handle("/aftergenerate", EventHook(handleBeforeGenerate(plugin)))
	}
	if _, ok := plugin.(GraphQLTagReturn); ok {
		hooks["AfterGenerate"] = true
		http.Handle("/aftergenerate", EventHook(handleAfterGenerate(plugin)))
	}
	if _, ok := plugin.(IndexFile); ok {
		hooks["AfterGenerate"] = true
		http.Handle("/aftergenerate", EventHook(handleAfterGenerate(plugin)))
	}
	if _, ok := plugin.(ArtifactEnd); ok {
		hooks["AfterGenerate"] = true
		http.Handle("/aftergenerate", EventHook(handleAfterGenerate(plugin)))
	}
	if p, ok := plugin.(ClientPlugins); ok {
		hooks["ClientPlugins"] = true
		http.Handle("/clientplugins", JSONHook(p.ClientPlugins))
	}
	if p, ok := plugin.(TransformFile); ok {
		hooks["TransformFile"] = true
		http.Handle("/transformfile", handleTransformFile(p))
	}

	// get the unique hooks this plugin cares about
	hookStrs := []string{}
	for hook := range hooks {
		hookStrs = append(hookStrs, hook)
	}

	return hookStrs
}

func JSONHook[T any](hook func() (T, error)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// call the function
		data, err := hook()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// write the response
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(data)
	})

}

func EventHook(hook func() error) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// call the function
		err := hook()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// write the response
		w.WriteHeader(http.StatusOK)
	})

}

func handleGenerate(plugin Plugin) func() error {
	return func() error {
		// if the plugin defines a runtime to include
		if includeRuntime, ok := plugin.(IncludeRuntime); ok {
			runtimePath, err := includeRuntime.IncludeRuntime()
			if err != nil {
				return err
			}
			fmt.Println("include runtime", runtimePath)
		}

		// nothing went wrong
		return nil
	}
}

func handleAfterLoad(plugin Plugin) func() error {
	return func() error {
		// if the plugin defines a runtime to include
		if staticRuntime, ok := plugin.(StaticRuntime); ok {
			runtimePath, err := staticRuntime.StaticRuntime()
			if err != nil {
				return err
			}

			if _, ok := plugin.(TransformRuntime); ok {
				fmt.Println("transform runtime")
			}

			fmt.Println("static runtime", runtimePath)
		}

		if p, ok := plugin.(AfterLoad); ok {
			return p.AfterLoad()
		}

		// nothing went wrong
		return nil
	}
}

func handleEnvironment(plugin Environment) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// the include and exclude paramters come as json in the request body
		payload := struct {
			Mode string `json:"mode"`
		}{}
		err := json.NewDecoder(r.Body).Decode(&payload)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// invoke the extraction logic
		value, err := plugin.Environment(payload.Mode)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
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
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// invoke the extraction logic
		updated, err := plugin.TransformFile(payload.Filename, payload.Source)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
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

func handleBeforeGenerate(plugin Plugin) func() error {
	return func() error {
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

func handleAfterGenerate(plugin Plugin) func() error {
	return func() error {
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
