package plugins

import (
	"context"
	"fmt"
	"os"
	"sync"
	"time"
)

const (
	LogLevelQuiet        = 0 // errors and doc-change info only
	LogLevelPluginDetail = 1 // short-summary — less than summary
	LogLevelSummary      = 2 // + pipeline phase timing totals
	LogLevelVerbose      = 3 // + per-plugin spawn and per-hook timing
)

type Logger struct {
	level  int
	mu     sync.Mutex
	timers map[string]time.Time
}

func NewLogger(level int) *Logger {
	return &Logger{
		level:  level,
		timers: make(map[string]time.Time),
	}
}

// parseLogLevel converts a DB log level string (e.g. "SUMMARY") to its integer constant.
func parseLogLevel(s string) int {
	switch s {
	case "QUIET":
		return LogLevelQuiet
	case "SUMMARY":
		return LogLevelSummary
	case "SHORT_SUMMARY":
		return LogLevelPluginDetail
	case "FULL":
		return LogLevelVerbose
	default:
		return LogLevelSummary
	}
}

// Logger returns a logger seeded from the project's configured log level.
func (db DatabasePool[PluginConfig]) Logger(ctx context.Context) (*Logger, error) {
	config, err := db.ProjectConfig(ctx)
	if err != nil {
		return nil, err
	}
	return NewLogger(parseLogLevel(config.LogLevel)), nil
}

// Error always prints to stderr regardless of log level.
func (l *Logger) Error(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
}

// Warn always prints to stderr regardless of log level.
func (l *Logger) Warn(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
}

// Info prints to stderr only when the logger's level is >= minLevel.
func (l *Logger) Info(minLevel int, format string, args ...any) {
	if l.level >= minLevel {
		fmt.Fprintf(os.Stderr, format+"\n", args...)
	}
}

// Time starts a named timer.
func (l *Logger) Time(label string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.timers[label] = time.Now()
}

// TimeEnd stops the named timer and prints the elapsed time if level >= minLevel.
func (l *Logger) TimeEnd(label string, minLevel int) {
	l.mu.Lock()
	start, ok := l.timers[label]
	if ok {
		delete(l.timers, label)
	}
	l.mu.Unlock()

	if ok && l.level >= minLevel {
		ms := float64(time.Since(start).Nanoseconds()) / 1e6
		fmt.Fprintf(os.Stderr, "  %s: %.1fms\n", label, ms)
	}
}

// At reports whether the logger's level is at or above minLevel.
func (l *Logger) At(minLevel int) bool {
	return l.level >= minLevel
}
