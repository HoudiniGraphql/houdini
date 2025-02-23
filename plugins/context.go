package plugins

import "context"

func ContextWithTaskID(ctx context.Context, taskID string) context.Context {
	return context.WithValue(ctx, "taskID", taskID)
}

func TaskIDFromContext(ctx context.Context) *string {
	taskID := ctx.Value("taskID").(string)
	if taskID == "" {
		return nil
	}
	return &taskID
}
