package plugins

import (
	"context"
	"strconv"
)

func ContextWithTaskID(ctx context.Context, taskID string) context.Context {
	if taskID == "" {
		return ctx
	}

	id, err := strconv.ParseInt(taskID, 10, 64)
	if err != nil {
		return ctx
	}

	return context.WithValue(ctx, "taskID", &id)
}

func TaskIDFromContext(ctx context.Context) *int64 {
	taskID := ctx.Value("taskID")
	if taskID == nil {
		return nil
	}
	return taskID.(*int64)
}
