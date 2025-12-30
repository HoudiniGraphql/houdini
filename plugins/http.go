package plugins

import (
	"encoding/json"
	"net/http"
)

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
