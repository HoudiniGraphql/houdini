package plugins

import (
	"context"
)

func ContextWithTaskID(ctx context.Context, taskID string) context.Context {
	if taskID == "" {
		return ctx
	}
	return context.WithValue(ctx, "taskID", &taskID)
}

func TaskIDFromContext(ctx context.Context) *string {
	taskID := ctx.Value("taskID")
	if taskID == nil {
		return nil
	}
	return taskID.(*string)
}
