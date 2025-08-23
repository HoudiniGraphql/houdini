package plugins

import (
	"fmt"
	"strings"
	"sync"
)

func WrapError(err error) *Error {
	if err == nil {
		return nil
	}

	if e, ok := err.(*Error); ok {
		return e
	}
	return &Error{
		Message: err.Error(),
	}
}

func WrapFilepathError(filepath string, err error) *Error {
	if err == nil {
		return nil
	}

	if e, ok := err.(*Error); ok {
		return e
	}
	return &Error{
		Locations: []*ErrorLocation{
			{
				Filepath: filepath,
			},
		},
		Message: err.Error(),
	}
}

type Error struct {
	Message   string           `json:"message"`
	Detail    string           `json:"detail"`
	Locations []*ErrorLocation `json:"locations"`
	Kind      ErrorKind        `json:"kind"`
}

type ErrorLocation struct {
	Filepath string `json:"filepath"`
	Line     int    `json:"line"`
	Column   int    `json:"column"`
}

type ErrorKind string

const (
	ErrorKindValidation ErrorKind = "validation"
)

func (e Error) Error() string {
	return e.Message
}

func (e Error) WithPrefix(prefix string) Error {
	e.Message = prefix + ": " + e.Message
	return e
}

type ErrorList struct {
	ThreadSafeSlice[*Error]
}

func (e *ErrorList) Append(err *Error) {
	if err == nil {
		return
	}
	e.ThreadSafeSlice.Append(err)
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

func Errorf(format string, args ...any) *Error {
	return WrapError(fmt.Errorf(format, args...))
}
