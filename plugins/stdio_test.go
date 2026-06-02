package plugins

import (
	"bufio"
	"context"
	"encoding/json"
	"os"
	"strings"
	"testing"
	"time"
)

// minimalPlugin is a bare-bones HoudiniPlugin used for stdio tests.
type minimalPlugin struct {
	Plugin[struct{}]
}

func (p *minimalPlugin) Name() string       { return "test-plugin" }
func (p *minimalPlugin) Order() PluginOrder { return PluginOrderAfter }

// schemaHookPlugin implements Schema so request/response tests have a real hook to call.
type schemaHookPlugin struct {
	Plugin[struct{}]
}

func (p *schemaHookPlugin) Name() string       { return "schema-plugin" }
func (p *schemaHookPlugin) Order() PluginOrder { return PluginOrderAfter }
func (p *schemaHookPlugin) Schema(ctx context.Context) error {
	return nil
}

// invokePlugin calls StdioInvoke from its Schema handler so we can test the
// invoke round-trip without needing a real orchestrator.
type invokePlugin struct {
	Plugin[struct{}]
}

func (p *invokePlugin) Name() string       { return "invoke-plugin" }
func (p *invokePlugin) Order() PluginOrder { return PluginOrderAfter }
func (p *invokePlugin) Schema(ctx context.Context) error {
	_, err := StdioInvoke(ctx, "Validate", map[string]any{"from": "schema"}, false)
	return err
}

// withStdioPipes replaces os.Stdin and os.Stdout with pipes for the duration
// of fn, then restores them.
func withStdioPipes(t *testing.T, fn func(stdinW *os.File, stdoutR *os.File)) {
	t.Helper()

	stdinR, stdinW, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	stdoutR, stdoutW, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}

	oldStdin := os.Stdin
	oldStdout := os.Stdout
	os.Stdin = stdinR
	os.Stdout = stdoutW

	defer func() {
		os.Stdin = oldStdin
		os.Stdout = oldStdout
		stdinR.Close()
		stdoutW.Close()
	}()

	fn(stdinW, stdoutR)
}

func readLine(t *testing.T, r *os.File, timeout time.Duration) string {
	t.Helper()
	ch := make(chan string, 1)
	go func() {
		scanner := bufio.NewScanner(r)
		if scanner.Scan() {
			ch <- scanner.Text()
		}
	}()
	select {
	case line := <-ch:
		return line
	case <-time.After(timeout):
		t.Fatal("timed out waiting for output")
		return ""
	}
}

func writeMessage(t *testing.T, w *os.File, msg any) {
	t.Helper()
	b, err := json.Marshal(msg)
	if err != nil {
		t.Fatal(err)
	}
	w.Write(append(b, '\n'))
}

// ─── register message ─────────────────────────────────────────────────────────

func TestStdio_RegisterMessage(t *testing.T) {
	withStdioPipes(t, func(stdinW, stdoutR *os.File) {
		done := make(chan error, 1)
		go func() {
			done <- runStdio(context.Background(), &minimalPlugin{})
		}()

		line := readLine(t, stdoutR, 2*time.Second)
		stdinW.Close()

		var msg StdioRegister
		if err := json.Unmarshal([]byte(line), &msg); err != nil {
			t.Fatalf("could not parse register message: %v", err)
		}
		if msg.Type != "register" {
			t.Errorf("expected type 'register', got %q", msg.Type)
		}
		if msg.Name != "test-plugin" {
			t.Errorf("expected name 'test-plugin', got %q", msg.Name)
		}
		if msg.Order != "after" {
			t.Errorf("expected order 'after', got %q", msg.Order)
		}

		select {
		case err := <-done:
			if err != nil {
				t.Errorf("runStdio returned error: %v", err)
			}
		case <-time.After(2 * time.Second):
			t.Fatal("runStdio did not exit after stdin closed")
		}
	})
}

// ─── request → response round-trip ───────────────────────────────────────────

func TestStdio_RequestResponse(t *testing.T) {
	withStdioPipes(t, func(stdinW, stdoutR *os.File) {
		done := make(chan error, 1)
		go func() {
			done <- runStdio(context.Background(), &schemaHookPlugin{})
		}()

		readLine(t, stdoutR, 2*time.Second) // register

		writeMessage(t, stdinW, StdioInbound{ID: "req-1", Type: "request", Hook: "Schema"})

		line := readLine(t, stdoutR, 2*time.Second)
		stdinW.Close()

		var resp StdioResponse
		if err := json.Unmarshal([]byte(line), &resp); err != nil {
			t.Fatalf("could not parse response: %v", err)
		}
		if resp.Type != "response" {
			t.Errorf("expected type 'response', got %q", resp.Type)
		}
		if resp.ID != "req-1" {
			t.Errorf("expected id 'req-1', got %q", resp.ID)
		}
		if resp.Error != nil {
			t.Errorf("expected no error, got %v", resp.Error)
		}

		<-done
	})
}

// ─── unknown hook returns error ───────────────────────────────────────────────

func TestStdio_UnknownHook(t *testing.T) {
	withStdioPipes(t, func(stdinW, stdoutR *os.File) {
		done := make(chan error, 1)
		go func() {
			done <- runStdio(context.Background(), &minimalPlugin{})
		}()

		readLine(t, stdoutR, 2*time.Second) // register

		writeMessage(t, stdinW, StdioInbound{ID: "req-x", Type: "request", Hook: "NonExistentHook"})

		line := readLine(t, stdoutR, 2*time.Second)
		stdinW.Close()

		var resp StdioResponse
		json.Unmarshal([]byte(line), &resp)

		if resp.Error == nil {
			t.Error("expected an error for unknown hook")
		}
		errStr := ""
		if m, ok := resp.Error.(map[string]any); ok {
			errStr, _ = m["message"].(string)
		}
		if !strings.Contains(errStr, "NonExistentHook") {
			t.Errorf("expected hook name in error, got: %q", errStr)
		}

		<-done
	})
}

// readLines starts a background goroutine that drains r into a channel using a
// single shared scanner, avoiding the buffering problem that arises when
// multiple bufio.Scanners are created on the same file descriptor.
func readLines(r *os.File) <-chan string {
	ch := make(chan string, 16)
	go func() {
		scanner := bufio.NewScanner(r)
		for scanner.Scan() {
			ch <- scanner.Text()
		}
		close(ch)
	}()
	return ch
}

func recvLine(t *testing.T, ch <-chan string, timeout time.Duration) string {
	t.Helper()
	select {
	case line, ok := <-ch:
		if !ok {
			t.Fatal("output channel closed unexpectedly")
		}
		return line
	case <-time.After(timeout):
		t.Fatal("timed out waiting for output")
		return ""
	}
}

// ─── concurrent requests get independent responses ───────────────────────────

func TestStdio_ConcurrentRequests(t *testing.T) {
	withStdioPipes(t, func(stdinW, stdoutR *os.File) {
		lines := readLines(stdoutR)

		done := make(chan error, 1)
		go func() {
			done <- runStdio(context.Background(), &schemaHookPlugin{})
		}()

		recvLine(t, lines, 2*time.Second) // register

		writeMessage(t, stdinW, StdioInbound{ID: "r-1", Type: "request", Hook: "Schema"})
		writeMessage(t, stdinW, StdioInbound{ID: "r-2", Type: "request", Hook: "Schema"})

		responses := map[string]StdioResponse{}
		for range 2 {
			var resp StdioResponse
			json.Unmarshal([]byte(recvLine(t, lines, 2*time.Second)), &resp)
			responses[resp.ID] = resp
		}
		stdinW.Close()

		if _, ok := responses["r-1"]; !ok {
			t.Error("missing response for r-1")
		}
		if _, ok := responses["r-2"]; !ok {
			t.Error("missing response for r-2")
		}

		<-done
	})
}

// ─── invoke round-trip (Go plugin calls out to Node, gets result back) ────────

func TestStdio_InvokeRoundTrip(t *testing.T) {
	withStdioPipes(t, func(stdinW, stdoutR *os.File) {
		done := make(chan error, 1)
		go func() {
			done <- runStdio(context.Background(), &invokePlugin{})
		}()

		readLine(t, stdoutR, 2*time.Second) // register

		// trigger the Schema handler, which internally calls StdioInvoke
		writeMessage(t, stdinW, StdioInbound{ID: "req-1", Type: "request", Hook: "Schema"})

		// the handler blocks on StdioInvoke — read the invoke message it emits
		var inv StdioInvokeMsg
		if err := json.Unmarshal([]byte(readLine(t, stdoutR, 2*time.Second)), &inv); err != nil {
			t.Fatalf("could not parse invoke message: %v", err)
		}
		if inv.Type != "invoke" {
			t.Errorf("expected type 'invoke', got %q", inv.Type)
		}
		if inv.Hook != "Validate" {
			t.Errorf("expected hook 'Validate', got %q", inv.Hook)
		}

		// send the invoke_result back — the handler unblocks
		writeMessage(t, stdinW, StdioInbound{
			ID:     inv.ID,
			Type:   "invoke_result",
			Result: map[string]any{"ok": true},
		})

		// handler completes and sends its response
		var resp StdioResponse
		if err := json.Unmarshal([]byte(readLine(t, stdoutR, 2*time.Second)), &resp); err != nil {
			t.Fatalf("could not parse response: %v", err)
		}
		if resp.Error != nil {
			t.Errorf("unexpected error: %v", resp.Error)
		}

		stdinW.Close()
		<-done
	})
}

// ─── invoke_result routes to pending channel ──────────────────────────────────

func TestStdio_InvokeResult_RoutedToPending(t *testing.T) {
	id := "go-invoke-test-1"
	ch := make(chan StdioInbound, 1)

	pendingInvokesMu.Lock()
	pendingInvokes[id] = ch
	pendingInvokesMu.Unlock()

	msg := StdioInbound{ID: id, Type: "invoke_result", Result: map[string]any{"key": "value"}}

	pendingInvokesMu.Lock()
	target, ok := pendingInvokes[msg.ID]
	pendingInvokesMu.Unlock()

	if !ok {
		t.Fatal("pending channel not found")
	}
	target <- msg

	select {
	case received := <-ch:
		if received.ID != id {
			t.Errorf("expected id %q, got %q", id, received.ID)
		}
	case <-time.After(time.Second):
		t.Fatal("invoke_result was not routed to pending channel")
	}

	pendingInvokesMu.Lock()
	delete(pendingInvokes, id)
	pendingInvokesMu.Unlock()
}
