package plugins

import (
	"context"
)

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

type taskIDCtxKey struct{}

type pluginDirCtxKey struct{}
