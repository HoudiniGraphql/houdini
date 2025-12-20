package plugins

import (
	"context"

	"github.com/gorilla/websocket"
)

type taskIDCtxKey struct{}

type pluginDirCtxKey struct{}

type wsConnCtxKey struct{}

type wsMessageIDCtxKey struct{}

func ContextWithTaskID(ctx context.Context, taskID string) context.Context {
	if taskID == "" {
		return ctx
	}

	return context.WithValue(ctx, taskIDCtxKey{}, &taskID)
}

func ContextWithPluginDir(ctx context.Context, directory string) context.Context {
	return context.WithValue(ctx, pluginDirCtxKey{}, directory)
}

func TaskIDFromContext(ctx context.Context) *string {
	taskID := ctx.Value(taskIDCtxKey{})
	if taskID == nil {
		return nil
	}
	return taskID.(*string)
}

func PluginDirFromContext(ctx context.Context) string {
	return ctx.Value(pluginDirCtxKey{}).(string)
}

func ContextWithWSConn(ctx context.Context, conn *websocket.Conn) context.Context {
	return context.WithValue(ctx, wsConnCtxKey{}, conn)
}

// WSConnFromContext helper to get the conn from context
// Example:
//  	if conn := WSConnFromContext(ctx); conn != nil {
// 			conn.WriteJSON(WebSocketResponse{
// 				ID:    ctx.Value("wsMessageID").(string),
// 				Type:  "1error",
// 				Error: "TEST: This is a simulated non-fatal error during generation",
// 			})
// 		}
func WSConnFromContext(ctx context.Context) *websocket.Conn {
	conn, _ := ctx.Value(wsConnCtxKey{}).(*websocket.Conn)
	return conn
}

func ContextWithWSMessageID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, wsMessageIDCtxKey{}, id)
}

func WSMessageIDFromContext(ctx context.Context) string {
	id, _ := ctx.Value(wsMessageIDCtxKey{}).(string)
	return id
}
