package plugins

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

var (
	configHost   string = ""
	databasePath string = ""
)

func ParseFlags() {
	flag.StringVar(&configHost, "config", "", "")
	flag.StringVar(&databasePath, "database", "", "")
	flag.Parse()
}

func Run(plugin Plugin) {

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
			if notified {
				continue
			}

			// notify config server
			_, err = QueryConfigServer[struct {
				RegisterPlugin bool `json:"registerPlugin"`
			}](`
            mutation($input: RegisterPluginInput!) {
                registerPlugin(input: $input)
            }
        `, map[string]interface{}{
				"input": map[string]interface{}{
					"plugin": plugin.Name(),
					"order":  plugin.Order(),
					"port":   port,
					"hooks":  hooks,
				},
			})
			if err != nil {
				log.Fatal(err)
				return
			}
			notified = true
		}
	}

}

func QueryConfigServer[Response any](query string, input map[string]any) (*Response, error) {
	if configHost == "" {
		return nil, nil
	}

	// create a custom HTTP client with timeout
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	// create request payload
	payload := map[string]any{
		"query":     query,
		"variables": input,
	}

	// marshal payload to JSON
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshaling payload: %w", err)
	}

	// create a new POST request with JSON payload
	req, err := http.NewRequest(http.MethodPost, configHost, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}

	// set content type header
	req.Header.Set("Content-Type", "application/json")

	// send the request
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("sending request: %w", err)
	}
	defer resp.Body.Close()

	// read and parse response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, body)
	}

	// parse response
	response := struct {
		Data Response `json:"data"`
	}{}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("unmarshaling response: %w", err)
	}

	return &response.Data, nil
}
