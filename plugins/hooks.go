package plugins

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"maps"
	"net/http"
	"sync"

	"zombiezen.com/go/sqlite"
)

func TriggerHook[PluginConfig any](
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

	pluginPorts := []int{}
	err := db.StepQuery(ctx, query, map[string]any{"hook": hook}, func(stmt *sqlite.Stmt) {
		pluginPorts = append(pluginPorts, int(stmt.GetInt64("port")))
	})
	if err != nil {
		return nil, err
	}
	if len(pluginPorts) == 0 {
		return map[string]any{}, nil
	}

	// marshal the payload once
	marshaled, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	errs := &ErrorList{}
	var wg sync.WaitGroup

	for _, port := range pluginPorts {
		wg.Add(1)

		go func(port int) {
			defer wg.Done()

			resp, err := http.Post(
				fmt.Sprintf("http://localhost:%v/%s", port, hook),
				"application/json",
				bytes.NewBuffer(marshaled),
			)
			if err != nil {
				errs.Append(WrapError(err))
				return
			}
			defer resp.Body.Close()

			body, err := io.ReadAll(resp.Body)
			if err != nil {
				errs.Append(WrapError(err))
				return
			}

			var pluginResult map[string]any
			if err := json.Unmarshal(body, &pluginResult); err != nil {
				return
			}

			// merge result safely
			resultMu.Lock()
			maps.Copy(result, pluginResult)
			resultMu.Unlock()
		}(port)
	}

	wg.Wait()

	if errs.Len() > 0 {
		return result, errs
	}

	return result, nil
}
