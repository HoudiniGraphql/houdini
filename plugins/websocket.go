package plugins

import (
	"context"
	"fmt"
	"os"
	"sync"
	"time"

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

// routing map for websocket handlers and connection tracking
var (
	wsHandlers      = make(map[string]func(*websocket.Conn, WebSocketMessage))
	wsMutex         = sync.Mutex{}
	activeConns     = make(map[*websocket.Conn]bool)
	connMutex       = sync.Mutex{}
	shutdownChannel = make(chan struct{})
	shutdownOnce    = sync.Once{}
)

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
		_ = conn.WriteJSON(response)
	}
}

func HandleWebSocketConnection(conn *websocket.Conn) {
	// Register this connection
	connMutex.Lock()
	activeConns[conn] = true
	connMutex.Unlock()

	// Ensure cleanup when connection ends
	defer func() {
		connMutex.Lock()
		delete(activeConns, conn)
		connCount := len(activeConns)
		connMutex.Unlock()

		// If this was the last connection, initiate shutdown
		if connCount == 0 {
			shutdownOnce.Do(func() {
				close(shutdownChannel)
			})
		}
	}()

	// message loop
	for {
		var msg WebSocketMessage
		if err := conn.ReadJSON(&msg); err != nil {
			// Exit the message loop, defer will handle cleanup
			return
		}

		wsMutex.Lock()
		handler, exists := wsHandlers[msg.Hook]
		wsMutex.Unlock()

		if exists {
			go func(msgCopy WebSocketMessage) {
				defer func() {
					if r := recover(); r != nil {
						sendErrorResponse(conn, msgCopy.ID, fmt.Errorf("handler panic: %v", r))
					}
				}()
				handler(conn, msgCopy)
			}(msg)
		} else {
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

// WaitForShutdown blocks until all WebSocket connections are closed
// This should be called from the main goroutine to wait for graceful shutdown
func WaitForShutdown() {
	<-shutdownChannel
	os.Exit(0)
}

// GetActiveConnectionCount returns the number of active WebSocket connections
// Useful for monitoring and testing
func GetActiveConnectionCount() int {
	connMutex.Lock()
	defer connMutex.Unlock()
	return len(activeConns)
}

// ForceShutdown closes all active WebSocket connections and exits
// This should only be used in emergency situations
func ForceShutdown() {
	connMutex.Lock()
	connections := make([]*websocket.Conn, 0, len(activeConns))
	for conn := range activeConns {
		connections = append(connections, conn)
	}
	connMutex.Unlock()

	for _, conn := range connections {
		conn.Close()
	}

	// Give a brief moment for cleanup, then exit
	go func() {
		time.Sleep(100 * time.Millisecond)
		os.Exit(1)
	}()
}
