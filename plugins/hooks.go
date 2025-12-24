package plugins

import (
	"context"
	"fmt"
	"maps"
	"sync"
	"time"

	"github.com/gorilla/websocket"
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

		pluginResult, err := invokeHookWebSocket(ctx, name, port, hook, payload)
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

			pluginResult, err := invokeHookWebSocket(ctx, name, port, hook, payload)
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

func invokeHookWebSocket(
	ctx context.Context,
	name string,
	port int64,
	hook string,
	payload map[string]any,
) (map[string]any, error) {
	wsURL := fmt.Sprintf("ws://localhost:%d/", port)
	conn, _, err := websocket.DefaultDialer.DialContext(ctx, wsURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to plugin %s: %w", name, err)
	}
	defer func() {
		conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
		conn.Close()
	}()

	messageID := fmt.Sprintf("hook-%d", time.Now().UnixNano())
	message := map[string]any{
		"id":      messageID,
		"type":    "request",
		"hook":    hook,
		"payload": payload,
	}

	if err := conn.WriteJSON(message); err != nil {
		return nil, fmt.Errorf("failed to send message to plugin %s: %w", name, err)
	}

	var response struct {
		ID     string         `json:"id"`
		Type   string         `json:"type"`
		Result map[string]any `json:"result"`
		Error  any            `json:"error"`
	}

	if err := conn.ReadJSON(&response); err != nil {
		return nil, fmt.Errorf("failed to read response from plugin %s: %w", name, err)
	}

	if response.Error != nil {
		return nil, fmt.Errorf("plugin %s returned error: %v", name, response.Error)
	}

	return response.Result, nil
}
