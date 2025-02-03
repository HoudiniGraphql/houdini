package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/spf13/cobra"
)

var (
	configHost string = ""
)

var cmd = &cobra.Command{
	Use: "houdini-core",
	Run: func(cmd *cobra.Command, args []string) {
		// make sure we were given the location of the config server
		if configHost == "" {
			log.Fatal("You must provide a url for the config server")
			return
		}

		err := notifyConfigServer(`
			mutation($input: RegisterPluginInput!) {
				registerPlugin(input: $input)
			}
		`, map[string]interface{}{
			"input": map[string]interface{}{
				"plugin": "houdini-core",
				"port":   10,
			},
		})
		if err != nil {
			log.Fatal(err)
			return
		}
	},
}

func main() {
	cmd.PersistentFlags().StringVar(&configHost, "config", "", "The port of the locally running config server")
	cmd.Execute()
}

func notifyConfigServer(query string, input map[string]any) error {
	// Create a custom HTTP client with timeout
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	// Create request payload
	payload := map[string]any{
		"query":     query,
		"variables": input,
	}

	// Marshal payload to JSON
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshaling payload: %w", err)
	}

	// Create a new POST request with JSON payload
	req, err := http.NewRequest(http.MethodPost, configHost, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}

	// Set content type header
	req.Header.Set("Content-Type", "application/json")

	// Send the request
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("sending request: %w", err)
	}
	defer resp.Body.Close()

	// Read and parse response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, body)
	}

	return nil
}
