package plugins

import (
	"context"
	"fmt"
	"log"
	"os"
	"sync"

	"github.com/gorilla/websocket"
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

	register := func(hookName string, handler HookHandler) {
		hooks = append(hooks, hookName)
		registerWSHandler(hookName, handler)
	}

	// --- Config
	register("Config", handleConfig(plugin))

	// --- AfterLoad is triggered for StaticRuntime OR AfterLoad OR DefaultConfig
	_, isStaticRuntime := plugin.(StaticRuntime)
	_, isAfterLoad := plugin.(AfterLoad)
	_, hasDefaultConfig := plugin.(DefaultConfig[PluginConfig])
	if isStaticRuntime || isAfterLoad || hasDefaultConfig {
		register("AfterLoad", handleAfterLoad(plugin))
	}

	// --- Schema
	if _, ok := plugin.(Schema); ok {
		register("Schema", handleSchema(plugin))
	}

	// --- ExtractDocuments
	if _, ok := plugin.(ExtractDocuments); ok {
		register("ExtractDocuments", handleExtractDocuments(plugin))
	}

	// --- AfterExtract
	if _, ok := plugin.(AfterExtract); ok {
		register("AfterExtract", handleAfterExtract(plugin))
	}

	// --- BeforeValidate
	if _, ok := plugin.(BeforeValidate); ok {
		register("BeforeValidate", handleBeforeValidate(plugin))
	}

	// --- Validate
	if _, ok := plugin.(Validate); ok {
		register("Validate", handleValidate(plugin))
	}

	// --- AfterValidate
	if _, ok := plugin.(AfterValidate); ok {
		register("AfterValidate", handleAfterValidate(plugin))
	}

	// --- BeforeGenerate
	if _, ok := plugin.(BeforeGenerate); ok {
		register("BeforeGenerate", handleBeforeGenerate(plugin))
	}

	// --- GenerateDocuments
	if _, ok := plugin.(GenerateDocuments); ok {
		register("GenerateDocuments", handleGenerateDocuments(plugin))
	}

	// --- GenerateRuntime is triggered for IncludeRuntime OR GenerateRuntime OR Config
	_, isIncludeRuntime := plugin.(IncludeRuntime)
	_, isGenerateRuntime := plugin.(GenerateRuntime)
	_, isConfig := plugin.(Config)
	if isIncludeRuntime || isGenerateRuntime || isConfig {
		register("GenerateRuntime", handleGenerateRuntime(plugin))
	}

	// --- AfterGenerate
	if _, ok := plugin.(AfterGenerate); ok {
		register("AfterGenerate", handleAfterGenerate(plugin))
	}

	// --- Environment (not in pipeline order - standalone hook with payload)
	if _, ok := plugin.(Environment); ok {
		register("Environment", handleEnvironment(plugin))
	}

	// --- IndexFile
	if _, ok := plugin.(IndexFile); ok {
		register("IndexFile", handleIndexFile(plugin))
	}

	return hooks
}

func registerWSHandler(hookName string, handler HookHandler) {
	wsMutex.Lock()
	defer wsMutex.Unlock()

	wsHandlers[hookName] = func(conn *websocket.Conn, msg WebSocketMessage) {
		// validate request type
		if msg.Type != "request" {
			sendErrorResponse(conn, msg.ID, fmt.Errorf("expected request type"))
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

func HandleWebSocketConnection(conn *websocket.Conn) {
	// message loop
	for {
		var msg WebSocketMessage
		if err := conn.ReadJSON(&msg); err != nil {
			// Any WebSocket close means orchestrator shutdown (1001)
			// Plugin-to-plugin calls use HTTP, so 1000 never happens here
			os.Exit(0)
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
		response := WebSocketResponse{ID: id, Type: "response", Error: pluginErr.GetItems()}
		conn.WriteJSON(response)
		return
	}

	// error could be just a single error
	if pluginErr, ok := err.(*Error); ok {
		response := WebSocketResponse{ID: id, Type: "response", Error: pluginErr}
		conn.WriteJSON(response)
		return
	}

	// otherwise we should just serialize the error message
	response := WebSocketResponse{
		ID:    id,
		Type:  "response",
		Error: map[string]string{"message": err.Error()},
	}
	conn.WriteJSON(response)
}
