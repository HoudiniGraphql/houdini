package plugins

import (
	"strings"
	"sync"

	"github.com/vektah/gqlparser/v2/ast"
)

func WrapError(err error) Error {
	return Error{
		Message: err.Error(),
	}
}

type Error struct {
	Message  string        `json:"message"`
	Detail   string        `json:"detail"`
	Filepath string        `json:"filepath"`
	Position *ast.Position `json:"position"`
}

func (e Error) Error() string {
	return e.Message
}

func (e Error) WithPrefix(prefix string) Error {
	e.Message = prefix + ": " + e.Message
	return e
}

type ErrorList struct {
	ThreadSafeSlice[Error]
}

func (errs *ErrorList) Error() string {
	messages := []string{}
	errs.Lock()
	defer errs.Unlock()
	for _, err := range errs.items {
		messages = append(messages, err.Message)
	}
	return strings.Join(messages, "\n")
}

// thread-safe slice wrapper
type ThreadSafeSlice[val any] struct {
	sync.Mutex
	items []val
}

// helper methods for SafeSlice
func (s *ThreadSafeSlice[T]) Append(val T) {
	s.Lock()
	defer s.Unlock()
	s.items = append(s.items, val)
}

func (s *ThreadSafeSlice[T]) GetItems() []T {
	s.Lock()
	defer s.Unlock()
	// Return copy to prevent external modifications
	return append([]T{}, s.items...)
}

func (s *ThreadSafeSlice[val]) Len() int {
	s.Lock()
	defer s.Unlock()
	return len(s.items)
}
