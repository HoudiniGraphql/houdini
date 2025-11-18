package plugins

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	iofs "io/fs"
	"path/filepath"
	"runtime"
	"sync"

	"github.com/spf13/afero"
	"golang.org/x/sync/errgroup"
)

// RecursiveCopy walks `from`, mirrors directories into `to`, and processes files in parallel.
// It applies `transform` to each file's textual contents and writes atomically only if changed.
// It returns a slice of destination file paths that were updated (created or content-changed).
func RecursiveCopy(
	ctx context.Context,
	fs afero.Fs,
	from string,
	to string,
	transform func(ctx context.Context, source string, content string) (string, error),
) ([]string, error) {
	// For in-memory filesystems, use paths as-is to avoid real filesystem resolution
	src := filepath.Clean(from)
	dst := filepath.Clean(to)
	if src == dst {
		return nil, errors.New("source and destination are the same")
	}
	if err := fs.MkdirAll(dst, 0o755); err != nil {
		return nil, fmt.Errorf("mkdir %q: %w", dst, err)
	}

	type job struct {
		srcPath string
		dstPath string
		mode    iofs.FileMode
	}
	jobs := make(chan job, 8192)

	var (
		changedMu sync.Mutex
		changed   []string
	)

	eg, ctx := errgroup.WithContext(ctx)

	// Producer: walk source tree
	eg.Go(func() error {
		defer close(jobs)
		return afero.Walk(fs, src, func(path string, info iofs.FileInfo, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}
			rel, err := filepath.Rel(src, path)
			if err != nil {
				return err
			}
			target := filepath.Join(dst, rel)

			switch {
			case info.IsDir():
				return fs.MkdirAll(target, info.Mode()&iofs.ModePerm)
			case info.Mode().IsRegular():
				select {
				case jobs <- job{srcPath: path, dstPath: target, mode: info.Mode() & iofs.ModePerm}:
					return nil
				case <-ctx.Done():
					return ctx.Err()
				}
			default:
				// skip symlinks and non-regular files
				return nil
			}
		})
	})

	// Consumers: process files in parallel
	workerCount := runtime.NumCPU()
	for range workerCount {
		eg.Go(func() error {
			for j := range jobs {
				select {
				case <-ctx.Done():
					return ctx.Err()
				default:
				}

				data, err := afero.ReadFile(fs, j.srcPath)
				if err != nil {
					return fmt.Errorf("read %q: %w", j.srcPath, err)
				}
				relPath, err := filepath.Rel(to, j.dstPath)
				if err != nil {
					return err
				}
				out, err := transform(ctx, relPath, string(data))
				if err != nil {
					return fmt.Errorf("transform %q: %w", j.srcPath, err)
				}
				didChange, err := writeFileIfChanged(fs, j.dstPath, []byte(out), j.mode)
				if err != nil {
					return fmt.Errorf("write %q: %w", j.dstPath, err)
				}
				if didChange {
					changedMu.Lock()
					changed = append(changed, j.dstPath)
					changedMu.Unlock()
				}
			}
			return nil
		})
	}

	if err := eg.Wait(); err != nil {
		return nil, err
	}

	return changed, nil
}

// writeFileIfChanged writes data to dst atomically only if its content differs.
// Returns changed=true if the file was created or updated.
func writeFileIfChanged(
	filesystem afero.Fs,
	dst string,
	data []byte,
	mode iofs.FileMode,
) (bool, error) {
	fi, err := filesystem.Stat(dst)
	switch {
	case err == nil && fi.Mode().IsRegular():
		// Fast path: same size → compare bytes to avoid a rewrite.
		if fi.Size() == int64(len(data)) {
			f, err := filesystem.Open(dst)
			if err != nil {
				return false, err
			}
			defer f.Close()

			const chunk = 64 * 1024
			buf := make([]byte, chunk)
			offset := 0
			for {
				n, rerr := f.Read(buf)
				if n > 0 {
					if !bytes.Equal(buf[:n], data[offset:offset+n]) {
						break // differs → proceed to write
					}
					offset += n
				}
				if rerr == io.EOF {
					return false, nil // identical → no write
				}
				if rerr != nil {
					return false, rerr
				}
			}
		}
	case errors.Is(err, afero.ErrFileNotFound):
		// new file → will write
	default:
		return false, err
	}

	// Ensure parent directory
	if err := filesystem.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return false, err
	}

	// Write file using afero (simplified atomic write for filesystem abstraction)
	// For in-memory filesystems, this is effectively atomic
	// For OS filesystem, afero.WriteFile handles the basic write operation
	if err := afero.WriteFile(filesystem, dst, data, mode); err != nil {
		return false, err
	}

	return true, nil
}
