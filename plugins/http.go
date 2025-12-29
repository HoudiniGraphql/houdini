package plugins

import (
	"encoding/json"
	"net/http"
	"sort"
)

func pluginHTTPHooks[PluginConfig any](plugin HoudiniPlugin[PluginConfig]) []string {
	hooks := map[string]struct{}{}
	registered := map[string]struct{}{}

	register := func(path, hookName string, handler HookHandler) {
		hooks[hookName] = struct{}{}
		if _, ok := registered[path]; ok {
			return
		}
		http.Handle(path, wrapHandler(handler))
		registered[path] = struct{}{}
	}

	// --- Config
	register("/config", "Config", handleConfig(plugin))

	// --- AfterLoad is triggered for StaticRuntime OR AfterLoad OR DefaultConfig
	_, isStaticRuntime := plugin.(StaticRuntime)
	_, isAfterLoad := plugin.(AfterLoad)
	_, hasDefaultConfig := plugin.(DefaultConfig[PluginConfig])
	if isStaticRuntime || isAfterLoad || hasDefaultConfig {
		register("/afterload", "AfterLoad", handleAfterLoad(plugin))
	}

	// --- Schema
	if _, ok := plugin.(Schema); ok {
		register("/schema", "Schema", handleSchema(plugin))
	}

	// --- ExtractDocuments
	if _, ok := plugin.(ExtractDocuments); ok {
		register("/extractdocuments", "ExtractDocuments", handleExtractDocuments(plugin))
	}

	// --- AfterExtract
	if _, ok := plugin.(AfterExtract); ok {
		register("/afterextract", "AfterExtract", handleAfterExtract(plugin))
	}

	// --- BeforeValidate
	if _, ok := plugin.(BeforeValidate); ok {
		register("/beforevalidate", "BeforeValidate", handleBeforeValidate(plugin))
	}

	// --- Validate
	if _, ok := plugin.(Validate); ok {
		register("/validate", "Validate", handleValidate(plugin))
	}

	// --- AfterValidate
	if _, ok := plugin.(AfterValidate); ok {
		register("/aftervalidate", "AfterValidate", handleAfterValidate(plugin))
	}

	// --- BeforeGenerate
	if _, ok := plugin.(BeforeGenerate); ok {
		register("/beforegenerate", "BeforeGenerate", handleBeforeGenerate(plugin))
	}

	// --- GenerateDocuments
	if _, ok := plugin.(GenerateDocuments); ok {
		register("/generatedocuments", "GenerateDocuments", handleGenerateDocuments(plugin))
	}

	// --- GenerateRuntime is triggered for IncludeRuntime OR GenerateRuntime OR Config
	_, isIncludeRuntime := plugin.(IncludeRuntime)
	_, isGenerateRuntime := plugin.(GenerateRuntime)
	_, isConfig := plugin.(Config)
	if isIncludeRuntime || isGenerateRuntime || isConfig {
		register("/generateruntime", "GenerateRuntime", handleGenerateRuntime(plugin))
	}

	// --- AfterGenerate
	if _, ok := plugin.(AfterGenerate); ok {
		register("/aftergenerate", "AfterGenerate", handleAfterGenerate(plugin))
	}

	// --- Environment
	if _, ok := plugin.(Environment); ok {
		register("/environment", "Environment", handleEnvironment(plugin))
	}

	// --- IndexFile
	if _, ok := plugin.(IndexFile); ok {
		register("/indexfile", "IndexFile", handleIndexFile(plugin))
	}

	out := make([]string, 0, len(hooks))
	for h := range hooks {
		out = append(out, h)
	}
	sort.Strings(out)
	return out
}

func wrapHandler(handler HookHandler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		taskID := r.Header.Get("X-Task-Id")
		pluginDir := r.Header.Get("X-Plugin-Directory")

		ctx := ContextWithPluginDir(
			ContextWithTaskID(r.Context(), taskID),
			pluginDir,
		)

		var payload map[string]any
		if r.Body != nil {
			json.NewDecoder(r.Body).Decode(&payload)
		}

		result, err := handler(ctx, payload)
		if err != nil {
			handleHTTPError(w, err)
			return
		}

		if result == nil {
			w.WriteHeader(http.StatusOK)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	})
}

func handleHTTPError(w http.ResponseWriter, err error) {
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
