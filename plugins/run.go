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

func Run(plugin Plugin) {
	var configHost = flag.String("config", "", "help message for flag n")
	flag.Parse()

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
			notified = true

			// notify config server
			err = notifyConfigServer(*configHost, `
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
		}
	}

}

func notifyConfigServer(host string, query string, input map[string]any) error {
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
		return fmt.Errorf("marshaling payload: %w", err)
	}

	// create a new POST request with JSON payload
	req, err := http.NewRequest(http.MethodPost, host, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}

	// set content type header
	req.Header.Set("Content-Type", "application/json")

	// send the request
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("sending request: %w", err)
	}
	defer resp.Body.Close()

	// read and parse response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, body)
	}

	return nil
}

// the hooks that a plugin defines dictate a set of events that the plugin must repond to
func pluginHooks(plugin Plugin) []string {
	hooks := map[string]bool{}
	if _, ok := plugin.(IncludeRuntime); ok {
		hooks["Generate"] = true
		http.Handle("/generate", EventHook(handleGenerate(plugin)))
	}
	if _, ok := plugin.(StaticRuntime); ok {
		hooks["AfterLoad"] = true
		http.Handle("/afterLoad", EventHook(handleAfterLoad(plugin)))
	}
	if _, ok := plugin.(TransformRuntime); ok {
		hooks["Generate"] = true
		http.Handle("/generate", EventHook(handleGenerate(plugin)))
	}
	if _, ok := plugin.(Config); ok {
		hooks["Config"] = true
	}
	if p, ok := plugin.(Environment); ok {
		hooks["Environment"] = true
		http.Handle("/environment", JSONHook(p.Environment))
	}
	if _, ok := plugin.(AfterLoad); ok {
		hooks["AfterLoad"] = true
		http.Handle("/afterLoad", EventHook(handleAfterLoad(plugin)))
	}
	if p, ok := plugin.(ExtractDocuments); ok {
		hooks["ExtractDocuments"] = true
		http.Handle("/extractDocuments", handleExtractDocuments(p))
	}
	if p, ok := plugin.(Schema); ok {
		hooks["Schema"] = true
		http.Handle("/schema", EventHook(p.Schema))
	}
	if p, ok := plugin.(BeforeValidate); ok {
		hooks["BeforeValidate"] = true
		http.Handle("/beforeValidate", EventHook(p.BeforeValidate))
	}
	if p, ok := plugin.(Validate); ok {
		hooks["Validate"] = true
		http.Handle("/validate", EventHook(p.Validate))
	}
	if p, ok := plugin.(AfterValidate); ok {
		hooks["AfterValidate"] = true
		http.Handle("/afterValidate", EventHook(p.AfterValidate))
	}
	if p, ok := plugin.(BeforeGenerate); ok {
		hooks["BeforeGenerate"] = true
		http.Handle("/beforeGenerate", EventHook(p.BeforeGenerate))
	}
	if _, ok := plugin.(Generate); ok {
		hooks["Generate"] = true
		http.Handle("/generate", EventHook(handleGenerate(plugin)))
	}
	if _, ok := plugin.(ArtifactData); ok {
		hooks["AfterGenerate"] = true
		http.Handle("/afterGenerate", EventHook(handleAfterGenerate(plugin)))
	}
	if _, ok := plugin.(Hash); ok {
		hooks["AfterGenerate"] = true
		http.Handle("/afterGenerate", EventHook(handleAfterGenerate(plugin)))
	}
	if _, ok := plugin.(GraphQLTagReturn); ok {
		hooks["AfterGenerate"] = true
		http.Handle("/afterGenerate", EventHook(handleAfterGenerate(plugin)))
	}
	if _, ok := plugin.(IndexFile); ok {
		hooks["AfterGenerate"] = true
		http.Handle("/afterGenerate", EventHook(handleAfterGenerate(plugin)))
	}
	if _, ok := plugin.(ArtifactEnd); ok {
		hooks["AfterGenerate"] = true
		http.Handle("/afterGenerate", EventHook(handleAfterGenerate(plugin)))
	}
	if p, ok := plugin.(ClientPlugins); ok {
		hooks["ClientPlugins"] = true
		http.Handle("/clientPlugins", JSONHook(p.ClientPlugins))
	}
	if p, ok := plugin.(TransformFile); ok {
		hooks["TransformFile"] = true
		http.Handle("/transformFile", handleTransformFile(p))
	}

	// get the unique hooks this plugin cares about
	hookStrs := []string{}
	for hook := range hooks {
		hookStrs = append(hookStrs, hook)
	}

	return hookStrs
}

func JSONHook[T any](hook func() (T, error)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// call the function
		data, err := hook()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// write the response
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(data)
	})

}

func EventHook(hook func() error) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// call the function
		err := hook()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// write the response
		w.WriteHeader(http.StatusOK)
	})

}

func handleGenerate(plugin Plugin) func() error {
	return func() error {
		// if the plugin defines a runtime to include
		if includeRuntime, ok := plugin.(IncludeRuntime); ok {
			runtimePath, err := includeRuntime.IncludeRuntime()
			if err != nil {
				return err
			}
			fmt.Println("include runtime", runtimePath)
		}

		// nothing went wrong
		return nil
	}
}

func handleAfterLoad(plugin Plugin) func() error {
	return func() error {
		// if the plugin defines a runtime to include
		if staticRuntime, ok := plugin.(StaticRuntime); ok {
			runtimePath, err := staticRuntime.StaticRuntime()
			if err != nil {
				return err
			}

			if _, ok := plugin.(TransformRuntime); ok {
				fmt.Println("transform runtime")
			}

			fmt.Println("static runtime", runtimePath)
		}

		if _, ok := plugin.(AfterLoad); ok {
			fmt.Println("after load")
		}

		// nothing went wrong
		return nil
	}
}

func handleExtractDocuments(plugin ExtractDocuments) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// the include and exclude paramters come as json in the request body
		payload := struct {
			Include string `json:"include"`
			Exclude string `json:"exclude"`
		}{}
		err := json.NewDecoder(r.Body).Decode(&payload)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// invoke the extraction logic
		err = plugin.ExtractDocuments(nil, nil)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	})
}

func handleTransformFile(plugin TransformFile) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// the include and exclude paramters come as json in the request body
		payload := struct {
			Filename string `json:"filename"`
			Source   string `json:"source"`
		}{}
		err := json.NewDecoder(r.Body).Decode(&payload)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// invoke the extraction logic
		updated, err := plugin.TransformFile(payload.Filename, payload.Source)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// send the string back over the endpoint
		result := map[string]string{
			"result": updated,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	})
}

func handleAfterGenerate(plugin Plugin) func() error {
	return func() error {
		// if the plugin defines a runtime to include
		if _, ok := plugin.(ArtifactData); ok {
			fmt.Println("artifact data")
		}

		if _, ok := plugin.(Hash); ok {
			fmt.Println("hash")
		}

		if _, ok := plugin.(GraphQLTagReturn); ok {
			fmt.Println("graphql tag return")
		}

		if _, ok := plugin.(IndexFile); ok {
			fmt.Println("index file")
		}

		if _, ok := plugin.(ArtifactEnd); ok {
			fmt.Println("artifact end")
		}

		// nothing went wrong
		return nil
	}
}
