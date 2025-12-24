package plugins

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"path"
	"path/filepath"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/spf13/afero"
)

type WebSocketMessage struct {
	ID              string         `json:"id"`
	Type            string         `json:"type"`
	Hook            string         `json:"hook"`
	Payload         map[string]any `json:"payload"`
	TaskID          string         `json:"taskId"`
	PluginDirectory string         `json:"pluginDirectory"`
}

type WebSocketResponse struct {
	ID     string `json:"id"`
	Type   string `json:"type"`
	Result any    `json:"result,omitempty"`
	Error  any    `json:"error,omitempty"`
}

// routing map for websocket handlers
var (
	wsHandlers = make(map[string]func(*websocket.Conn, WebSocketMessage))
	wsMutex    = sync.Mutex{}
)

func pluginWebsocketHooks[PluginConfig any](plugin HoudiniPlugin[PluginConfig]) []string {
	hooks := []string{}

	// --- Config
	hooks = append(hooks, "Config")
	registerWSHandler("Config", handleConfig(plugin))

	// --- AfterLoad is triggered for StaticRuntime OR AfterLoad OR DefaultConfig
	_, isStaticRuntime := plugin.(StaticRuntime)
	_, isAfterLoad := plugin.(AfterLoad)
	_, hasDefaultConfig := plugin.(DefaultConfig[PluginConfig])
	if isStaticRuntime || isAfterLoad || hasDefaultConfig {
		hooks = append(hooks, "AfterLoad")
		registerWSHandler("AfterLoad", handleAfterLoad(plugin))
	}

	// --- Schema
	if _, ok := plugin.(Schema); ok {
		hooks = append(hooks, "Schema")
		registerWSHandler("Schema", handleSchema(plugin))
	}

	// --- ExtractDocuments
	if _, ok := plugin.(ExtractDocuments); ok {
		hooks = append(hooks, "ExtractDocuments")
		registerWSHandler("ExtractDocuments", handleExtractDocuments(plugin))
	}

	// --- AfterExtract
	if _, ok := plugin.(AfterExtract); ok {
		hooks = append(hooks, "AfterExtract")
		registerWSHandler("AfterExtract", handleAfterExtract(plugin))
	}

	// --- BeforeValidate
	if _, ok := plugin.(BeforeValidate); ok {
		hooks = append(hooks, "BeforeValidate")
		registerWSHandler("BeforeValidate", handleBeforeValidate(plugin))
	}

	// --- Validate
	if _, ok := plugin.(Validate); ok {
		hooks = append(hooks, "Validate")
		registerWSHandler("Validate", handleValidate(plugin))
	}

	// --- AfterValidate
	if _, ok := plugin.(AfterValidate); ok {
		hooks = append(hooks, "AfterValidate")
		registerWSHandler("AfterValidate", handleAfterValidate(plugin))
	}

	// --- BeforeGenerate
	if _, ok := plugin.(BeforeGenerate); ok {
		hooks = append(hooks, "BeforeGenerate")
		registerWSHandler("BeforeGenerate", handleBeforeGenerate(plugin))
	}

	// --- GenerateDocuments
	if _, ok := plugin.(GenerateDocuments); ok {
		hooks = append(hooks, "GenerateDocuments")
		registerWSHandler("GenerateDocuments", handleGenerateDocuments(plugin))
	}

	// --- GenerateRuntime is triggered for IncludeRuntime OR GenerateRuntime OR Config
	_, isIncludeRuntime := plugin.(IncludeRuntime)
	_, isGenerateRuntime := plugin.(GenerateRuntime)
	_, isConfig := plugin.(Config)
	if isIncludeRuntime || isGenerateRuntime || isConfig {
		hooks = append(hooks, "GenerateRuntime")
		registerWSHandler("GenerateRuntime", handleGenerateRuntime(plugin))
	}

	// --- AfterGenerate
	if _, ok := plugin.(AfterGenerate); ok {
		hooks = append(hooks, "AfterGenerate")
		registerWSHandler("AfterGenerate", handleAfterGenerate(plugin))
	}

	// --- Environment (not in pipeline order - standalone hook with payload)
	if _, ok := plugin.(Environment); ok {
		hooks = append(hooks, "Environment")
		registerWSHandler("Environment", handleEnvironment(plugin))
	}

	// --- IndexFile
	if _, ok := plugin.(IndexFile); ok {
		hooks = append(hooks, "IndexFile")
		registerWSHandler("IndexFile", handleIndexFile(plugin))
	}

	return hooks
}

func registerWSHandler(hookName string, handler func(ctx context.Context, payload map[string]any) (any, error)) {
	wsMutex.Lock()
	defer wsMutex.Unlock()
	wsHandlers[hookName] = func(conn *websocket.Conn, msg WebSocketMessage) {
		// validate request type
		if msg.Type != "request" {
			sendErrorResponse(conn, msg.ID, fmt.Errorf("Expected request type"))
			return
		}

		// context with all necessary values
		ctx := ContextWithWSConn(context.Background(), conn)
		ctx = ContextWithWSMessageID(ctx, msg.ID)
		ctx = ContextWithTaskID(ctx, msg.TaskID)
		ctx = ContextWithPluginDir(ctx, msg.PluginDirectory)

		// execute with payload
		result, err := handler(ctx, msg.Payload)
		if err != nil {
			sendErrorResponse(conn, msg.ID, err)
			return
		}

		// success response
		response := WebSocketResponse{
			ID:     msg.ID,
			Type:   "response",
			Result: result,
		}
		if writeErr := conn.WriteJSON(response); writeErr != nil {
			log.Printf("Failed to write response: %s", writeErr.Error())
		}
	}
}

// generator plugin functions
func handleGenerateRuntime[PluginConfig any](
	plugin HoudiniPlugin[PluginConfig],
) func(ctx context.Context, payload map[string]any) (any, error) {
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

func handleGenerateDocuments[PluginConfig any](
	plugin HoudiniPlugin[PluginConfig],
) func(ctx context.Context, payload map[string]any) (any, error) {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		if generate, ok := plugin.(GenerateDocuments); ok {
			return generate.GenerateDocuments(ctx)
		}
		return nil, nil
	}
}

func handleSchema[PluginConfig any](
	plugin HoudiniPlugin[PluginConfig],
) func(ctx context.Context, payload map[string]any) (any, error) {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		if schema, ok := plugin.(Schema); ok {
			return nil, schema.Schema(ctx)
		}
		return nil, fmt.Errorf("schema hook not implemented")
	}
}

func handleAfterExtract[PluginConfig any](
	plugin HoudiniPlugin[PluginConfig],
) func(ctx context.Context, payload map[string]any) (any, error) {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		if afterExtract, ok := plugin.(AfterExtract); ok {
			return nil, afterExtract.AfterExtract(ctx)
		}
		return nil, fmt.Errorf("afterExtract hook not implemented")
	}
}

func handleAfterLoad[PluginConfig any](
	plugin HoudiniPlugin[PluginConfig],
) func(ctx context.Context, payload map[string]any) (any, error) {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		// if the plugin specifies default configuration values we should load that
		// before anything else
		if defaultConfig, ok := plugin.(DefaultConfig[PluginConfig]); ok {
			config, err := defaultConfig.DefaultConfig(ctx)
			if err != nil {
				return nil, err
			}

			marshaled, err := json.Marshal(config)
			if err != nil {
				return nil, err
			}

			// now that we have the updated values we need to persist them to the database
			updateConfig := `
				UPDATE plugins SET config = $config WHERE name = $name
			`
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

			// the plugin could have defined a transform for the static runtime
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

func handleBeforeValidate[PluginConfig any](
	plugin HoudiniPlugin[PluginConfig],
) func(ctx context.Context, payload map[string]any) (any, error) {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		if beforeValidate, ok := plugin.(BeforeValidate); ok {
			return nil, beforeValidate.BeforeValidate(ctx)
		}
		return nil, fmt.Errorf("beforeValidate hook not implemented")
	}
}

func handleValidate[PluginConfig any](
	plugin HoudiniPlugin[PluginConfig],
) func(ctx context.Context, payload map[string]any) (any, error) {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		if validate, ok := plugin.(Validate); ok {
			return nil, validate.Validate(ctx)
		}
		return nil, fmt.Errorf("validate hook not implemented")
	}
}

func handleAfterValidate[PluginConfig any](
	plugin HoudiniPlugin[PluginConfig],
) func(ctx context.Context, payload map[string]any) (any, error) {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		if afterValidate, ok := plugin.(AfterValidate); ok {
			return nil, afterValidate.AfterValidate(ctx)
		}
		return nil, fmt.Errorf("afterValidate hook not implemented")
	}
}

func handleBeforeGenerate[PluginConfig any](
	plugin HoudiniPlugin[PluginConfig],
) func(ctx context.Context, payload map[string]any) (any, error) {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		if beforeGenerate, ok := plugin.(BeforeGenerate); ok {
			return nil, beforeGenerate.BeforeGenerate(ctx)
		}
		return nil, fmt.Errorf("beforeGenerate hook not implemented")
	}
}

func handleAfterGenerate[PluginConfig any](
	plugin HoudiniPlugin[PluginConfig],
) func(ctx context.Context, payload map[string]any) (any, error) {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		if afterGenerate, ok := plugin.(AfterGenerate); ok {
			return nil, afterGenerate.AfterGenerate(ctx)
		}
		return nil, fmt.Errorf("afterGenerate hook not implemented")
	}
}

func handleConfig[PluginConfig any](
	plugin HoudiniPlugin[PluginConfig],
) func(ctx context.Context, payload map[string]any) (any, error) {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		// if the plugin implements DefaultConfig, call it to get default values
		if defaultConfig, ok := plugin.(DefaultConfig[PluginConfig]); ok {
			return defaultConfig.DefaultConfig(ctx)
		}
		return nil, nil
	}
}

func handleEnvironment[PluginConfig any](
	plugin HoudiniPlugin[PluginConfig],
) func(ctx context.Context, payload map[string]any) (any, error) {
	return func(ctx context.Context, payload map[string]any) (any, error) {
		if env, ok := plugin.(Environment); ok {
			// the mode parameter comes as json in the request payload
			mode, _ := payload["mode"].(string)

			// invoke the environment logic
			return env.Environment(ctx, mode)
		}
		return nil, fmt.Errorf("environment hook not implemented")
	}
}

type ExtractDocumentsInput struct {
	Filepaths []string `json:"filepaths"`
}

func handleExtractDocuments[PluginConfig any](
	plugin HoudiniPlugin[PluginConfig],
) func(ctx context.Context, payload map[string]any) (any, error) {
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

			input := ExtractDocumentsInput{Filepaths: filepaths}
			return nil, extract.ExtractDocuments(ctx, input)
		}
		return nil, fmt.Errorf("extractDocuments hook not implemented")
	}
}

func handleIndexFile[PluginConfig any](
	plugin HoudiniPlugin[PluginConfig],
) func(ctx context.Context, payload map[string]any) (any, error) {
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

		existingContent, err := afero.ReadFile(afero.NewOsFs(), targetPath)
		if err != nil {
			return nil, err
		}

		newContent := string(existingContent) + "\n" + content

		err = afero.WriteFile(afero.NewOsFs(), targetPath, []byte(newContent), 0644)
		if err != nil {
			return nil, err
		}

		return nil, nil
	}
}

func HandleWebSocketConnection(conn *websocket.Conn) {

	// message loop
	for {
		var msg WebSocketMessage
		if err := conn.ReadJSON(&msg); err != nil {
			// only log if it's an unexpected close (not normal disconnect)
			if !websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket read error from %s: %v", conn.RemoteAddr(), err)
			}
			// return instead of os.Exit, plugin-to-plugin(TriggerHookParallel/TriggerHookSerial) closes the connection
			return
		}

		wsMutex.Lock()
		handler, exists := wsHandlers[msg.Hook]
		wsMutex.Unlock()

		if exists {
			go func() {
				defer func() {
					if r := recover(); r != nil {
						log.Printf("Handler panic for hook %s: %v", msg.Hook, r)
						sendErrorResponse(conn, msg.ID, fmt.Errorf("handler panic: %v", r))
					}
				}()

				handler(conn, msg)
			}()
		} else {
			log.Printf("No handler for hook %s", msg.Hook)
			sendErrorResponse(conn, msg.ID, fmt.Errorf("no handler for hook %s", msg.Hook))
		}
	}
}

func sendErrorResponse(conn *websocket.Conn, id string, err error) {
	// if the error is a list of plugin errors then we should serialize the full list
	if pluginErr, ok := err.(*ErrorList); ok {
		response := WebSocketResponse{
			ID:    id,
			Type:  "response",
			Error: pluginErr.GetItems(),
		}
		if writeErr := conn.WriteJSON(response); writeErr != nil {
			log.Printf("Failed to write response: %s", writeErr.Error())
		}
		return
	}

	// error could be just a single error
	if pluginErr, ok := err.(*Error); ok {
		response := WebSocketResponse{
			ID:    id,
			Type:  "response",
			Error: pluginErr,
		}
		if writeErr := conn.WriteJSON(response); writeErr != nil {
			log.Printf("Failed to write response: %s", writeErr.Error())
		}
		return
	}

	// otherwise w should just serialize the error message
	response := WebSocketResponse{
		ID:   id,
		Type: "response",
		Error: map[string]string{
			"message": err.Error(),
		},
	}
	if writeErr := conn.WriteJSON(response); writeErr != nil {
		log.Printf("Failed to write response : %s", writeErr.Error())
	}
}
