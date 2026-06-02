package plugins

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"time"
)

// StdioInbound covers messages received on stdin: "request" from Node.js and
// "invoke_result" as responses to our own invoke calls.
type StdioInbound struct {
	ID              string         `json:"id"`
	Type            string         `json:"type"`
	Hook            string         `json:"hook"`
	Payload         map[string]any `json:"payload"`
	TaskID          string         `json:"taskId"`
	PluginDirectory string         `json:"pluginDirectory"`
	Result          any            `json:"result"`
	Error           any            `json:"error"`
}

// StdioRegister is written to stdout once on startup.
type StdioRegister struct {
	Type           string   `json:"type"` // always "register"
	Name           string   `json:"name"`
	Hooks          []string `json:"hooks"`
	Order          string   `json:"order"`
	IncludeRuntime any      `json:"includeRuntime,omitempty"`
	ConfigModule   any      `json:"configModule,omitempty"`
	ClientPlugins  any      `json:"clientPlugins,omitempty"`
}

// StdioResponse is written to stdout in reply to a "request" message.
type StdioResponse struct {
	ID     string `json:"id"`
	Type   string `json:"type"` // always "response"
	Result any    `json:"result,omitempty"`
	Error  any    `json:"error,omitempty"`
}

// StdioInvokeMsg is written to stdout to ask Node.js to call other plugins.
type StdioInvokeMsg struct {
	ID       string         `json:"id"`
	Type     string         `json:"type"` // always "invoke"
	Hook     string         `json:"hook"`
	Payload  map[string]any `json:"payload"`
	TaskID   string         `json:"taskId,omitempty"`
	Parallel bool           `json:"parallel,omitempty"`
}

var (
	stdioWriteMu     sync.Mutex
	pendingInvokes   = make(map[string]chan StdioInbound)
	pendingInvokesMu sync.Mutex
	stdioIDCounter   atomic.Int64
)

func writeStdio(msg any) error {
	stdioWriteMu.Lock()
	defer stdioWriteMu.Unlock()
	return json.NewEncoder(os.Stdout).Encode(msg)
}

// StdioInvoke sends an invoke message to Node.js and waits for the aggregated
// result. Used by TriggerHookSerial/Parallel when in stdio transport mode so
// the Go binary can trigger hooks on other plugins without direct networking.
func StdioInvoke(ctx context.Context, hook string, payload map[string]any, parallel bool) (map[string]any, error) {
	id := fmt.Sprintf("go-invoke-%d", stdioIDCounter.Add(1))

	ch := make(chan StdioInbound, 1)
	pendingInvokesMu.Lock()
	pendingInvokes[id] = ch
	pendingInvokesMu.Unlock()
	defer func() {
		pendingInvokesMu.Lock()
		delete(pendingInvokes, id)
		pendingInvokesMu.Unlock()
	}()

	taskID := ""
	if tid := TaskIDFromContext(ctx); tid != nil {
		taskID = *tid
	}

	if err := writeStdio(StdioInvokeMsg{
		ID:       id,
		Type:     "invoke",
		Hook:     hook,
		Payload:  payload,
		TaskID:   taskID,
		Parallel: parallel,
	}); err != nil {
		return nil, err
	}

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-time.After(30 * time.Second):
		return nil, fmt.Errorf("timeout waiting for invoke_result for hook %s", hook)
	case msg := <-ch:
		if msg.Error != nil {
			return nil, fmt.Errorf("invoke %s error: %v", hook, msg.Error)
		}
		if result, ok := msg.Result.(map[string]any); ok {
			return result, nil
		}
		return map[string]any{}, nil
	}
}

func runStdio[PluginConfig any](ctx context.Context, plugin HoudiniPlugin[PluginConfig]) error {
	// Collect handlers using the same registration path as the WebSocket flow.
	handlerMap := make(map[string]HookHandler)
	hooks := registerPluginHooks(plugin, func(hookName string, handler HookHandler) {
		handlerMap[hookName] = handler
	})

	// Gather registration metadata (mirrors what Run writes to the plugins table).
	var includeRuntime any
	if inc, ok := plugin.(IncludeRuntime); ok {
		rt, err := inc.IncludeRuntime(ctx)
		if err != nil {
			return err
		}
		includeRuntime = rt
	}

	var configModule any
	if cfg, ok := plugin.(Config); ok {
		mod, err := cfg.Config(ctx)
		if err != nil {
			return err
		}
		configModule = mod
	}

	var clientPlugins any
	if cp, ok := plugin.(ClientPlugins); ok {
		plugs, err := cp.ClientPlugins(ctx)
		if err != nil {
			return err
		}
		b, err := json.Marshal(plugs)
		if err != nil {
			return err
		}
		clientPlugins = string(b)
	}

	if err := writeStdio(StdioRegister{
		Type:           "register",
		Name:           cmp(pluginKey, plugin.Name()),
		Hooks:          hooks,
		Order:          string(plugin.Order()),
		IncludeRuntime: includeRuntime,
		ConfigModule:   configModule,
		ClientPlugins:  clientPlugins,
	}); err != nil {
		return err
	}

	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 10*1024*1024), 10*1024*1024)

	for scanner.Scan() {
		var msg StdioInbound
		if err := json.Unmarshal(scanner.Bytes(), &msg); err != nil {
			continue
		}

		switch msg.Type {
		case "request":
			go func(m StdioInbound) {
				defer func() {
					if r := recover(); r != nil {
						writeStdio(StdioResponse{
							ID:    m.ID,
							Type:  "response",
							Error: map[string]string{"message": fmt.Sprintf("handler panic: %v", r)},
						})
					}
				}()

				handler, ok := handlerMap[m.Hook]
				if !ok {
					writeStdio(StdioResponse{
						ID:    m.ID,
						Type:  "response",
						Error: map[string]string{"message": fmt.Sprintf("no handler for hook %s", m.Hook)},
					})
					return
				}

				handlerCtx := context.Background()
				handlerCtx = ContextWithTaskID(handlerCtx, m.TaskID)
				handlerCtx = ContextWithPluginDir(handlerCtx, m.PluginDirectory)

				result, err := handler(handlerCtx, m.Payload)
				if err != nil {
					var errVal any
					switch e := err.(type) {
					case *ErrorList:
						errVal = e.GetItems()
					case *Error:
						errVal = e
					default:
						errVal = map[string]string{"message": e.Error()}
					}
					writeStdio(StdioResponse{ID: m.ID, Type: "response", Error: errVal})
					return
				}

				writeStdio(StdioResponse{ID: m.ID, Type: "response", Result: result})
			}(msg)

		case "invoke_result":
			pendingInvokesMu.Lock()
			ch, ok := pendingInvokes[msg.ID]
			pendingInvokesMu.Unlock()
			if ok {
				select {
				case ch <- msg:
				default:
				}
			}
		}
	}

	return scanner.Err()
}
