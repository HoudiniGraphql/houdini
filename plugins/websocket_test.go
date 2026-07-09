package plugins

import (
	"sync/atomic"
	"testing"
	"time"
)

// the connection deadline exists for the orchestrator that spawns a plugin and
// then never dials it (crashed or errored out of setup): the plugin must exit
// rather than wait forever. once any connection has arrived, the count-to-zero
// shutdown owns the lifecycle and the deadline must stay quiet.
func TestConnectionDeadline(t *testing.T) {
	reset := func(connected bool) {
		everConnected.Store(connected)
	}
	t.Cleanup(func() { reset(false) })

	t.Run("exits when no orchestrator ever connects", func(t *testing.T) {
		reset(false)
		exited := make(chan int, 1)
		timer := armConnectionDeadline(10*time.Millisecond, func(code int) { exited <- code })
		defer timer.Stop()

		select {
		case code := <-exited:
			if code != 1 {
				t.Fatalf("expected exit code 1, got %d", code)
			}
		case <-time.After(2 * time.Second):
			t.Fatal("deadline never fired for a never-connected plugin")
		}
	})

	t.Run("stays quiet once a connection has been established", func(t *testing.T) {
		reset(true)
		var fired atomic.Bool
		timer := armConnectionDeadline(10*time.Millisecond, func(int) { fired.Store(true) })
		defer timer.Stop()

		time.Sleep(100 * time.Millisecond)
		if fired.Load() {
			t.Fatal("deadline fired even though the orchestrator had connected")
		}
	})
}
