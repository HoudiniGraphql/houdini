package plugins

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"net/http"
	"strings"
	"sync"
	"time"

	"zombiezen.com/go/sqlite"
)

func TriggerHookSerial[PluginConfig any](
	ctx context.Context,
	db DatabasePool[PluginConfig],
	hook string,
	payload map[string]any,
) (map[string]any, error) {
	// build up the result of invoking the hook on matching plugins
	result := map[string]any{}

	// the first thing we have to do is look for plugins with matching hooks
	query := `
    SELECT * FROM plugins
    WHERE EXISTS (
      SELECT 1
      FROM json_each(plugins.hooks)
      WHERE value = $hook
    )
  `

	pluginPorts := map[string]int64{}
	err := db.StepQuery(ctx, query, map[string]any{"hook": hook}, func(stmt *sqlite.Stmt) {
		pluginPorts[stmt.GetText("name")] = stmt.GetInt64("port")
	})
	if err != nil {
		return nil, err
	}
	if len(pluginPorts) == 0 {
		return map[string]any{}, nil
	}

	errs := &ErrorList{}

	for name, port := range pluginPorts {
		if port == 0 {
			continue
		}

		pluginResult, err := invokeHook(ctx, name, port, hook, payload)
		if err != nil {
			errs.Append(WrapError(err))
			continue
		}

		// merge result safely
		maps.Copy(result, map[string]any{name: pluginResult})
	}

	if errs.Len() > 0 {
		return result, errs
	}

	return result, nil
}

func TriggerHookParallel[PluginConfig any](
	ctx context.Context,
	db DatabasePool[PluginConfig],
	hook string,
	payload map[string]any,
) (map[string]any, error) {
	// build up the result of invoking the hook on matching plugins
	result := map[string]any{}
	var resultMu sync.Mutex // to protect concurrent writes

	// the first thing we have to do is look for plugins with matching hooks
	query := `
    SELECT * FROM plugins
    WHERE EXISTS (
      SELECT 1
      FROM json_each(plugins.hooks)
      WHERE value = $hook
    )
  `

	pluginPorts := map[string]int64{}
	err := db.StepQuery(ctx, query, map[string]any{"hook": hook}, func(stmt *sqlite.Stmt) {
		pluginPorts[stmt.GetText("name")] = stmt.GetInt64("port")
	})
	if err != nil {
		return nil, err
	}
	if len(pluginPorts) == 0 {
		return map[string]any{}, nil
	}

	errs := &ErrorList{}
	var wg sync.WaitGroup

	for name, port := range pluginPorts {
		wg.Add(1)

		go func(name string, port int64) {
			defer wg.Done()
			if port == 0 {
				return
			}

			pluginResult, err := invokeHook(ctx, name, port, hook, payload)
			if err != nil {
				errs.Append(WrapError(err))
				return
			}

			// merge result safely
			resultMu.Lock()
			maps.Copy(result, map[string]any{name: pluginResult})
			resultMu.Unlock()
		}(name, port)
	}

	wg.Wait()

	if errs.Len() > 0 {
		return result, errs
	}

	return result, nil
}

func invokeHook(
	ctx context.Context,
	name string,
	port int64,
	hook string,
	payload map[string]any,
) (map[string]any, error) {
	// hook url is just name of hook 
	endpoint := "/" + strings.ToLower(hook)
	url := fmt.Sprintf("http://localhost:%d%s", port, endpoint)

	var body []byte
	var err error

	if payload != nil && len(payload) > 0 {
		body, err = json.Marshal(payload)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request for plugin %s: %w", name, err)
		}
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request for plugin %s: %w", name, err)
	}
	req.Header.Set("Content-Type", "application/json")

	if taskID := TaskIDFromContext(ctx); taskID != nil {
		req.Header.Set("X-Task-Id", *taskID)
	}
	if pluginDir := PluginDirFromContext(ctx); pluginDir != "" {
		req.Header.Set("X-Plugin-Directory", pluginDir)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request to plugin %s: %w", name, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errResp map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&errResp); err == nil {
			return nil, fmt.Errorf("plugin %s returned error: %v", name, errResp)
		}
		return nil, fmt.Errorf("plugin %s returned status %d", name, resp.StatusCode)
	}

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return map[string]any{}, nil
	}

	return result, nil
}
