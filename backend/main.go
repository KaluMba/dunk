package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
)

var (
	store  = NewStore()
	rivals RivalsClient
)

func main() {
	// Use live client if RIVALS_API_KEY is set, otherwise mock.
	if key := os.Getenv("RIVALS_API_KEY"); key != "" {
		rivals = NewLiveRivalsClient(key)
		log.Println("using live MarvelRivalsAPI client")
	} else {
		rivals = &MockRivalsClient{}
		log.Println("using mock rivals client (set RIVALS_API_KEY for live data)")
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/characters", handleCharacters)
	mux.HandleFunc("POST /api/register", handleRegister)
	mux.HandleFunc("GET /api/search", handleSearch)
	mux.HandleFunc("POST /api/invite/{player}", handleInvite)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	handler := cors(mux)
	log.Printf("listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}

// cors adds permissive CORS headers for local development.
// Tighten this for production by checking the Origin header.
func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("writeJSON: %v", err)
	}
}

func writeError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// GET /api/characters — full roster with roles
func handleCharacters(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, allCharacters)
}

// POST /api/register — add yourself to the matchmaking pool
func handleRegister(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" {
		writeError(w, "username is required", http.StatusBadRequest)
		return
	}
	if len(req.Characters) == 0 {
		writeError(w, "select at least one character", http.StatusBadRequest)
		return
	}

	// Optionally verify the player exists in Marvel Rivals.
	// On failure we still register — verification is best-effort.
	if ok, err := rivals.VerifyPlayer(req.Username); err != nil {
		log.Printf("verify player %q: %v", req.Username, err)
	} else if !ok {
		writeError(w, "player not found in Marvel Rivals", http.StatusNotFound)
		return
	}

	store.Register(&Player{
		Username:   req.Username,
		Characters: req.Characters,
		Rank:       strings.TrimSpace(req.Rank),
		Region:     strings.TrimSpace(req.Region),
	})

	writeJSON(w, map[string]string{"status": "registered"})
}

// GET /api/search?characters=Iron+Man,Storm&exclude=MyUsername
func handleSearch(w http.ResponseWriter, r *http.Request) {
	raw := r.URL.Query().Get("characters")
	if raw == "" {
		writeError(w, "characters query param required", http.StatusBadRequest)
		return
	}
	targets := strings.Split(raw, ",")
	for i, t := range targets {
		targets[i] = strings.TrimSpace(t)
	}
	exclude := strings.TrimSpace(r.URL.Query().Get("exclude"))

	results := store.Search(targets, exclude)
	writeJSON(w, results)
}

// POST /api/invite/{player} — invites aren't possible via any public API,
// so we return instructions for the caller to handle in the UI.
func handleInvite(w http.ResponseWriter, r *http.Request) {
	player := r.PathValue("player")
	writeJSON(w, map[string]string{
		"status":  "manual",
		"message": "In-game invites can't be sent via API. Copy this username and search for them in Marvel Rivals.",
		"username": player,
	})
}
