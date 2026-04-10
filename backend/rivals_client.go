package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// RivalsClient is the interface for the MarvelRivalsAPI.com integration.
// Swap MockRivalsClient for LiveRivalsClient once you have an API key.
type RivalsClient interface {
	// VerifyPlayer checks that the username exists in Marvel Rivals.
	VerifyPlayer(username string) (bool, error)
}

// --- Mock implementation (no API key required) ---

type MockRivalsClient struct{}

func (m *MockRivalsClient) VerifyPlayer(username string) (bool, error) {
	// TODO: replace with real lookup
	return true, nil
}

// --- Live implementation (marvelrivalsapi.com) ---

type LiveRivalsClient struct {
	apiKey string
	http   *http.Client
}

func NewLiveRivalsClient(apiKey string) *LiveRivalsClient {
	return &LiveRivalsClient{
		apiKey: apiKey,
		http:   &http.Client{Timeout: 8 * time.Second},
	}
}

func (c *LiveRivalsClient) VerifyPlayer(username string) (bool, error) {
	url := fmt.Sprintf("https://marvelrivalsapi.com/api/v1/find-player/%s", username)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return false, err
	}
	req.Header.Set("x-api-key", c.apiKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return false, nil
	}
	if resp.StatusCode != http.StatusOK {
		return false, fmt.Errorf("rivals api returned %d", resp.StatusCode)
	}

	var body struct {
		UID  string `json:"uid"`
		Name string `json:"name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return false, err
	}
	return body.UID != "", nil
}
