package plugins

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"sync"

	"golang.org/x/sync/errgroup"
)

// RecursiveCopy walks `from`, mirrors directories into `to`, and processes files in parallel.
// It applies `transform` to each file's textual contents and writes atomically only if changed.
// It returns a slice of destination file paths that were updated (created or content-changed).
func RecursiveCopy(
	ctx context.Context,
	from string,
	to string,
	transform func(ctx context.Context, source string, content string) (string, error),
) ([]string, error) {
	src, err := filepath.Abs(from)
	if err != nil {
		return nil, fmt.Errorf("abs(from): %w", err)
	}
	dst, err := filepath.Abs(to)
	if err != nil {
		return nil, fmt.Errorf("abs(to): %w", err)
	}
	if src == dst {
		return nil, errors.New("source and destination are the same")
	}
	if err := os.MkdirAll(dst, 0o755); err != nil {
		return nil, fmt.Errorf("mkdir %q: %w", dst, err)
	}

	type job struct {
		srcPath string
		dstPath string
		mode    fs.FileMode
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
		return filepath.WalkDir(src, func(path string, d fs.DirEntry, walkErr error) error {
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
			info, err := d.Info()
			if err != nil {
				return err
			}

			switch {
			case d.IsDir():
				return os.MkdirAll(target, info.Mode()&fs.ModePerm)
			case d.Type().IsRegular():
				select {
				case jobs <- job{srcPath: path, dstPath: target, mode: info.Mode() & fs.ModePerm}:
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

				data, err := os.ReadFile(j.srcPath)
				if err != nil {
					return fmt.Errorf("read %q: %w", j.srcPath, err)
				}
				out, err := transform(ctx, j.dstPath, string(data))
				if err != nil {
					return fmt.Errorf("transform %q: %w", j.srcPath, err)
				}
				didChange, err := writeFileIfChanged(j.dstPath, []byte(out), j.mode)
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
func writeFileIfChanged(dst string, data []byte, mode fs.FileMode) (bool, error) {
	fi, err := os.Stat(dst)
	switch {
	case err == nil && fi.Mode().IsRegular():
		// Fast path: same size → compare bytes to avoid a rewrite.
		if fi.Size() == int64(len(data)) {
			f, err := os.Open(dst)
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
	case errors.Is(err, os.ErrNotExist):
		// new file → will write
	default:
		return false, err
	}

	// Ensure parent directory
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return false, err
	}

	// Atomic write (temp → fsync → rename → fsync dir)
	tmp := dst + ".tmp~"
	tf, err := os.OpenFile(tmp, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode)
	if err != nil {
		return false, err
	}
	if _, err := tf.Write(data); err != nil {
		tf.Close()
		_ = os.Remove(tmp)
		return false, err
	}
	if err := tf.Sync(); err != nil {
		tf.Close()
		_ = os.Remove(tmp)
		return false, err
	}
	if err := tf.Close(); err != nil {
		_ = os.Remove(tmp)
		return false, err
	}
	if err := os.Rename(tmp, dst); err != nil {
		_ = os.Remove(tmp)
		return false, err
	}

	// Best-effort: make directory entry durable on POSIX.
	if runtime.GOOS != "windows" {
		if df, err := os.Open(filepath.Dir(dst)); err == nil {
			_ = df.Sync()
			_ = df.Close()
		}
	}
	return true, nil
}
