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

	"code.houdinigraphql.com/packages/houdini-core/config"
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

func Run(plugin HoudiniPlugin[config.PluginConfig]) error {
	ParseFlags()

	// create context that we'll cancel on shutdown signal
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// connect to the database
	db, err := NewPool[config.PluginConfig]()
	if err != nil {
		return err
	}
	defer db.Close()

	_pluginName = plugin.Name()

	// If the plugin supports injection, set its DB.
	plugin.SetDatabase(db)

	// load both of the config values
	db.ReloadPluginConfig(ctx)
	db.ReloadProjectConfig(ctx)

	hooks := pluginHooks(ctx, plugin)

	listener, err := net.Listen("tcp", ":0")
	if err != nil {
		return err
	}

	port := listener.Addr().(*net.TCPAddr).Port

	// create server instance so we can shut it down gracefully
	srv := &http.Server{}

	// set up signal handling
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	// channel for server errors
	serverErr := make(chan error, 1)

	// start server in a goroutine
	go func() {
		if err := srv.Serve(listener); err != http.ErrServerClosed {
			serverErr <- err
		}
	}()

	// wait for shutdown signal or server error
	notified := false
	for {
		select {
		case <-sigChan:
			// give outstanding requests a chance to complete
			shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer shutdownCancel()

			if err := srv.Shutdown(shutdownCtx); err != nil {
				return fmt.Errorf("server shutdown failed: %w", err)
			}

			// nothing went wrong
			return nil
		case err := <-serverErr:
			return err
		case <-ctx.Done():
			return nil
		default:
			// only notify once
			if notified {
				continue
			}
			notified = true

			// register plugin with database
			conn, err := db.Take(ctx)
			if err != nil {
				return err
			}
			err = sqlitex.ExecuteTransient(conn,
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
			db.Put(conn)
			if err != nil {
				log.Fatal(err)
			}
		}
	}
}
