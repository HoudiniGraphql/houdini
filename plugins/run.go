package plugins

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"zombiezen.com/go/sqlite/sqlitex"

	"code.houdinigraphql.com/packages/houdini-core/config"
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
	hooksStr, err := json.Marshal(hooks)
	if err != nil {
		return fmt.Errorf("failed to marshal hooks: %w", err)
	}

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

			// if the plugin requires a runtime then we should write that to the database too
			var includeRuntime any
			if includer, ok := plugin.(IncludeRuntime); ok {
				includeRuntime, err = includer.IncludeRuntime(ctx)
				if err != nil {
					return err
				}
			}

			var configModule any
			if configurer, ok := plugin.(Config); ok {
				configModule, err = configurer.Config(ctx)
				if err != nil {
					return err
				}
			}

			var clientPlugins any
			if clientProvider, ok := plugin.(ClientPlugins); ok {
				pluginConfig, err := clientProvider.ClientPlugins(ctx)
				if err != nil {
					return err
				}
				stringified, err := json.Marshal(pluginConfig)
				if err != nil {
					return err
				}
				clientPlugins = string(stringified)
			}

			// insert the plugin metadata
			err = sqlitex.ExecuteTransient(
				conn,
				`
					INSERT INTO plugins (
						name, hooks, port, plugin_order, include_runtime, config_module, client_plugins
					) VALUES 
						(?, ?, ?, ?, ?, ?, ?)
				`,
				&sqlitex.ExecOptions{
					Args: []any{
						plugin.Name(),
						string(hooksStr),
						port,
						plugin.Order(),
						includeRuntime,
						configModule,
						clientPlugins,
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
