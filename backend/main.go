package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

var (
	store  *Store
	rivals RivalsClient
)

func main() {
	if key := os.Getenv("RIVALS_API_KEY"); key != "" {
		rivals = NewLiveClient(key)
		log.Println("using live MarvelRivalsAPI client")
	} else {
		rivals = &MockRivalsClient{}
		log.Println("using mock rivals client (set RIVALS_API_KEY for live data)")
	}

	// Open PostgreSQL if DATABASE_URL is set; fall back to in-memory.
	var db *sql.DB
	if dbURL := os.Getenv("DATABASE_URL"); dbURL != "" {
		var err error
		db, err = openDB(dbURL)
		if err != nil {
			log.Printf("database connection failed: %v — running in-memory (data resets on restart)", err)
			db = nil
		}
	} else {
		log.Println("DATABASE_URL not set — running in-memory (data resets on restart)")
	}

	store = NewStore(db)

	// Restore players from DB if connected.
	if db != nil {
		players, err := dbLoad(db)
		if err != nil {
			log.Printf("load players from db: %v", err)
		} else {
			store.LoadAll(players)
			log.Printf("loaded %d players from database", len(players))
		}
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/characters", handleCharacters)
	mux.HandleFunc("POST /api/register", handleRegister)
	mux.HandleFunc("GET /api/players", handlePlayers)
	mux.HandleFunc("GET /api/search", handleSearch)
	mux.HandleFunc("POST /api/reveal/{id}", handleReveal)
	mux.HandleFunc("GET /api/player/{id}", handlePlayer)
	mux.HandleFunc("GET /api/health", handleHealth)

	rl := NewRateLimiter()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, cors(rateLimitMiddleware(rl)(mux))))
}

func cors(next http.Handler) http.Handler {
	origin := os.Getenv("ALLOWED_ORIGIN")
	if origin == "" {
		origin = "*"
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
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

// GET /api/health
func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]any{"status": "ok", "players": len(store.players)})
}

// GET /api/characters
func handleCharacters(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, allCharacters)
}

// GET /api/players — all registry entries, usernames visible
func handlePlayers(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, store.All())
}

// GET /api/search?characters=Storm,Hela&exclude=rival-xxxx
func handleSearch(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimSpace(r.URL.Query().Get("characters"))
	if raw == "" {
		writeError(w, "characters query param required", http.StatusBadRequest)
		return
	}
	var targets []string
	for _, p := range strings.Split(raw, ",") {
		if t := strings.TrimSpace(p); t != "" {
			targets = append(targets, t)
		}
	}
	exclude := strings.TrimSpace(r.URL.Query().Get("exclude"))
	writeJSON(w, store.Search(targets, exclude))
}

// POST /api/reveal/{id}
func handleReveal(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	username := store.Reveal(id)
	if username == "" {
		writeError(w, "player not found", http.StatusNotFound)
		return
	}
	writeJSON(w, map[string]string{"username": username})
}

// GET /api/player/{id}
func handlePlayer(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	p, ok := store.Get(id)
	if !ok {
		writeError(w, "player not found", http.StatusNotFound)
		return
	}
	writeJSON(w, p.public())
}

// POST /api/register
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

	profile, err := rivals.FindPlayer(req.Username)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(w, "player not found in Marvel Rivals", http.StatusNotFound)
		} else {
			writeError(w, "could not reach Marvel Rivals API: "+err.Error(), http.StatusBadGateway)
		}
		return
	}

	matches, err := rivals.FetchMatches(profile.UID, 20)
	if err != nil {
		log.Printf("fetch matches for %s: %v", req.Username, err)
		matches = nil
	}

	stats := AggregateStats(matches)

	// Use user-selected characters as mains if provided; otherwise auto-detect.
	mains := req.MainCharacters
	if len(mains) == 0 {
		mains = TopMains(stats, 3)
	}

	lastActive := time.Now()
	if len(matches) > 0 {
		lastActive = time.Unix(matches[0].Timestamp, 0)
	}

	p := &RegisteredPlayer{
		ID:         NewPlayerID(),
		Username:   profile.Name,
		UID:        profile.UID,
		Stats:      stats,
		MainChars:  mains,
		Rank:       strings.TrimSpace(req.Rank),
		Region:     strings.TrimSpace(req.Region),
		LastActive: lastActive,
	}
	store.Register(p)

	writeJSON(w, RegisterResponse{
		PlayerID:   p.ID,
		MainChars:  mains,
		Stats:      stats,
		LastActive: lastActive,
	})
}
