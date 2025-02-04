package plugins

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

func Run(plugin Plugin) {
	var configHost = flag.String("config", "", "help message for flag n")
	flag.Parse()

	// make sure we were given the location of the config server
	if configHost == nil {
		log.Fatal("You must provide a url for the config server")
		return
	}

	// notify the config server that we are running
	err := notifyConfigServer(*configHost, `
			mutation($input: RegisterPluginInput!) {
				registerPlugin(input: $input)
			}
		`, map[string]interface{}{
		"input": map[string]interface{}{
			"plugin": plugin.Name(),
			"port":   10,
		},
	})
	if err != nil {
		log.Fatal(err)
		return
	}

	fmt.Println("hello!")
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
