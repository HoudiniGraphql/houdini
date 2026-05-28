package plugins

import (
	"bytes"
	"os"
	"strings"
	"testing"
	"time"
)

func captureStderr(t *testing.T, fn func()) string {
	t.Helper()
	old := os.Stderr
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	os.Stderr = w

	fn()

	w.Close()
	os.Stderr = old

	var buf bytes.Buffer
	buf.ReadFrom(r)
	return buf.String()
}

func TestLogger_Info_LevelGating(t *testing.T) {
	out := captureStderr(t, func() {
		l := NewLogger(LogLevelSummary)
		l.Info(LogLevelSummary, "should print")
		l.Info(LogLevelVerbose, "should not print")
	})

	if !strings.Contains(out, "should print") {
		t.Errorf("expected 'should print' in output, got: %q", out)
	}
	if strings.Contains(out, "should not print") {
		t.Errorf("expected 'should not print' to be suppressed, got: %q", out)
	}
}

func TestLogger_Info_Quiet(t *testing.T) {
	out := captureStderr(t, func() {
		l := NewLogger(LogLevelQuiet)
		l.Info(LogLevelSummary, "suppressed")
	})

	if strings.Contains(out, "suppressed") {
		t.Errorf("quiet logger should suppress summary messages, got: %q", out)
	}
}

func TestLogger_ErrorAndWarn_AlwaysPrint(t *testing.T) {
	out := captureStderr(t, func() {
		l := NewLogger(LogLevelQuiet)
		l.Error("error message")
		l.Warn("warn message")
	})

	if !strings.Contains(out, "error message") {
		t.Errorf("Error should always print, got: %q", out)
	}
	if !strings.Contains(out, "warn message") {
		t.Errorf("Warn should always print, got: %q", out)
	}
}

func TestLogger_At(t *testing.T) {
	l := NewLogger(LogLevelSummary)

	if !l.At(LogLevelSummary) {
		t.Error("expected At(Summary) to be true for Summary logger")
	}
	if !l.At(LogLevelPluginDetail) {
		t.Error("expected At(PluginDetail) to be true for Summary logger (PluginDetail < Summary)")
	}
	if l.At(LogLevelVerbose) {
		t.Error("expected At(Verbose) to be false for Summary logger")
	}
}

func TestLogger_TimeEnd_PrintsElapsed(t *testing.T) {
	out := captureStderr(t, func() {
		l := NewLogger(LogLevelSummary)
		l.Time("my-op")
		time.Sleep(5 * time.Millisecond)
		l.TimeEnd("my-op", LogLevelSummary)
	})

	if !strings.Contains(out, "my-op") {
		t.Errorf("expected label in output, got: %q", out)
	}
	if !strings.Contains(out, "ms") {
		t.Errorf("expected 'ms' in timing output, got: %q", out)
	}
}

func TestLogger_TimeEnd_Suppressed(t *testing.T) {
	out := captureStderr(t, func() {
		l := NewLogger(LogLevelQuiet)
		l.Time("my-op")
		l.TimeEnd("my-op", LogLevelSummary)
	})

	if strings.Contains(out, "my-op") {
		t.Errorf("expected timing to be suppressed at Quiet level, got: %q", out)
	}
}

func TestLogger_TimeEnd_UnknownLabel(t *testing.T) {
	out := captureStderr(t, func() {
		l := NewLogger(LogLevelVerbose)
		l.TimeEnd("never-started", LogLevelQuiet)
	})

	if strings.Contains(out, "never-started") {
		t.Errorf("TimeEnd for unknown label should be a no-op, got: %q", out)
	}
}
