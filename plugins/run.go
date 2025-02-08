package plugins

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"zombiezen.com/go/sqlite/sqlitex"
)

var (
	configHost   string = ""
	databasePath string = ""
)

func ParseFlags() {
	flag.StringVar(&databasePath, "database", "", "")
	flag.Parse()

	// make sure a database path is provided
	if databasePath == "" {
		flag.Usage()
		log.Fatal("database path is required")
	}
}

func Run(plugin HoudiniPlugin) {
	ParseFlags()

	// connect to the database
	db, err := ConnectDB()
	if err != nil {
		log.Fatal(err)
	}

	// If the plugin supports injection, set its DB.
	plugin.SetDatabase(db)

	hooks := pluginHooks(plugin)

	listener, err := net.Listen("tcp", ":0")
	if err != nil {
		log.Fatal(err)
	}

	port := listener.Addr().(*net.TCPAddr).Port

	// create server instance so we can shut it down gracefully
	srv := &http.Server{}

	// create context that we'll cancel on shutdown signal
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// set up signal handling
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	// channel for server errors
	serverErr := make(chan error, 1)

	addr := fmt.Sprintf("localhost:%d", port)

	// start server in a goroutine
	go func() {
		if err := srv.Serve(listener); err != http.ErrServerClosed {
			serverErr <- err
		}
	}()

	// test connection to ensure server is listening
	for i := 0; i < 10; i++ {
		conn, err := net.Dial("tcp", addr)
		if err == nil {
			conn.Close()
			break
		}
		// check if server failed
		select {
		case err := <-serverErr:
			log.Fatal("server failed to start:", err)
			return
		default:
			time.Sleep(1 * time.Millisecond)
			continue
		}
	}

	// check one final time for any server startup errors
	select {
	case err := <-serverErr:
		log.Fatal("server failed to start:", err)
		return
	default:
		// server started successfully
	}

	// wait for shutdown signal or server error
	notified := false
	for {
		select {
		case <-sigChan:
			// give outstanding requests a chance to complete
			shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer shutdownCancel()

			if err := srv.Shutdown(shutdownCtx); err != nil {
			}
			return
		case <-serverErr:
			return
		case <-ctx.Done():
			return
		default:
			// only notify once
			if notified {
				continue
			}
			notified = true

			// register plugin with database
			err = sqlitex.ExecuteTransient(db.Conn,
				`INSERT INTO plugins (name, hooks, port, plugin_order) VALUES (?, ?, ?, ?)`,
				&sqlitex.ExecOptions{
					Args: []interface{}{
						plugin.Name(),
						strings.Join(hooks, ","),
						port,
						plugin.Order(),
					},
				},
			)
			if err != nil {
				log.Fatal(err)
			}
		}
	}
}
