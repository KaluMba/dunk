package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// testSetup resets globals and returns a ServeMux wired the same way as main().
func testSetup() http.Handler {
	rivals = &MockRivalsClient{}
	store = &Store{players: make(map[string]*RegisteredPlayer)}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/characters", handleCharacters)
	mux.HandleFunc("POST /api/register", handleRegister)
	mux.HandleFunc("GET /api/search", handleSearch)
	mux.HandleFunc("POST /api/reveal/{id}", handleReveal)
	mux.HandleFunc("GET /api/player/{id}", handlePlayer)
	mux.HandleFunc("GET /api/health", handleHealth)
	return mux
}

func post(handler http.Handler, path string, body any) *httptest.ResponseRecorder {
	b, _ := json.Marshal(body)
	req := httptest.NewRequest("POST", path, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	return w
}

func get(handler http.Handler, path string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("GET", path, nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	return w
}

// ── /api/health ───────────────────────────────────────────────────────────────

func TestHandleHealth(t *testing.T) {
	h := testSetup()
	w := get(h, "/api/health")
	if w.Code != 200 {
		t.Errorf("status: got %d, want 200", w.Code)
	}
}

// ── /api/characters ───────────────────────────────────────────────────────────

func TestHandleCharacters_ReturnsList(t *testing.T) {
	h := testSetup()
	w := get(h, "/api/characters")
	if w.Code != 200 {
		t.Fatalf("status: got %d, want 200", w.Code)
	}
	var chars []Character
	if err := json.Unmarshal(w.Body.Bytes(), &chars); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(chars) == 0 {
		t.Error("expected non-empty character list")
	}
}

func TestHandleCharacters_HasRoles(t *testing.T) {
	h := testSetup()
	w := get(h, "/api/characters")
	var chars []Character
	json.Unmarshal(w.Body.Bytes(), &chars)

	roles := map[string]bool{}
	for _, c := range chars {
		roles[c.Role] = true
	}
	for _, role := range []string{"vanguard", "duelist", "strategist"} {
		if !roles[role] {
			t.Errorf("missing role: %s", role)
		}
	}
}

// ── /api/register ─────────────────────────────────────────────────────────────

func TestHandleRegister_Valid(t *testing.T) {
	h := testSetup()
	w := post(h, "/api/register", RegisterRequest{
		Username: "TestPlayer",
		Rank:     "Gold I",
		Region:   "EU",
	})
	if w.Code != 200 {
		t.Fatalf("status: got %d, want 200 — body: %s", w.Code, w.Body.String())
	}
	var resp RegisterResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.PlayerID == "" {
		t.Error("playerID should not be empty")
	}
	if len(resp.MainChars) == 0 {
		t.Error("expected at least one detected main")
	}
	if len(resp.Stats) == 0 {
		t.Error("expected stats to be populated")
	}
}

func TestHandleRegister_MissingUsername(t *testing.T) {
	h := testSetup()
	w := post(h, "/api/register", RegisterRequest{Username: "  "})
	if w.Code != 400 {
		t.Errorf("status: got %d, want 400", w.Code)
	}
}

func TestHandleRegister_StoresPlayer(t *testing.T) {
	h := testSetup()
	w := post(h, "/api/register", RegisterRequest{Username: "StoredUser"})
	var resp RegisterResponse
	json.Unmarshal(w.Body.Bytes(), &resp)

	if _, ok := store.players[resp.PlayerID]; !ok {
		t.Error("player not found in store after registration")
	}
}

func TestHandleRegister_StatsAreSane(t *testing.T) {
	h := testSetup()
	w := post(h, "/api/register", RegisterRequest{Username: "SaneStats"})
	var resp RegisterResponse
	json.Unmarshal(w.Body.Bytes(), &resp)

	for name, cs := range resp.Stats {
		if cs.Games <= 0 {
			t.Errorf("%s: games should be > 0, got %d", name, cs.Games)
		}
		if cs.WinRate < 0 || cs.WinRate > 100 {
			t.Errorf("%s: winRate out of range: %.1f", name, cs.WinRate)
		}
		if cs.KDA < 0 {
			t.Errorf("%s: KDA should be >= 0, got %.2f", name, cs.KDA)
		}
	}
}

// ── /api/search ───────────────────────────────────────────────────────────────

func TestHandleSearch_MissingCharacters(t *testing.T) {
	h := testSetup()
	w := get(h, "/api/search")
	if w.Code != 400 {
		t.Errorf("status: got %d, want 400", w.Code)
	}
}

func TestHandleSearch_NoResults(t *testing.T) {
	h := testSetup()
	w := get(h, "/api/search?characters=Thanos") // not a real character
	if w.Code != 200 {
		t.Fatalf("status: got %d, want 200", w.Code)
	}
	var results []SearchResult
	json.Unmarshal(w.Body.Bytes(), &results)
	if len(results) != 0 {
		t.Errorf("expected 0 results, got %d", len(results))
	}
}

func TestHandleSearch_ReturnsMatches(t *testing.T) {
	h := testSetup()
	// Register a player whose mains we know (mock is deterministic for "KnownUser")
	post(h, "/api/register", RegisterRequest{Username: "KnownUser"})

	// Get what their mains are
	var reg RegisterResponse
	w := post(h, "/api/register", RegisterRequest{Username: "KnownUser2"})
	json.Unmarshal(w.Body.Bytes(), &reg)

	if len(reg.MainChars) == 0 {
		t.Skip("no mains detected, skipping search test")
	}

	// Search for their first main
	w2 := get(h, "/api/search?characters="+reg.MainChars[0])
	if w2.Code != 200 {
		t.Fatalf("status: got %d, want 200", w2.Code)
	}
	var results []SearchResult
	json.Unmarshal(w2.Body.Bytes(), &results)
	if len(results) == 0 {
		t.Errorf("expected results for %s, got 0", reg.MainChars[0])
	}
}

func TestHandleSearch_NoUsername(t *testing.T) {
	h := testSetup()
	post(h, "/api/register", RegisterRequest{Username: "HiddenUser"})

	// Search — response should not contain any username field
	w := get(h, "/api/search?characters=Storm")
	raw := w.Body.String()

	// PublicProfile doesn't have username field by design,
	// but double-check the raw JSON doesn't accidentally include it
	var results []SearchResult
	if err := json.Unmarshal(w.Body.Bytes(), &results); err != nil {
		t.Fatalf("decode: %v", err)
	}
	// We can't check for "username" absence via the struct since it's not there.
	// At least verify the raw JSON doesn't contain "HiddenUser".
	if len(raw) > 0 && containsString(raw, "HiddenUser") {
		t.Error("search response should not expose username")
	}
}

func containsString(haystack, needle string) bool {
	return len(haystack) > 0 && len(needle) > 0 &&
		bytes.Contains([]byte(haystack), []byte(needle))
}

// ── /api/reveal ───────────────────────────────────────────────────────────────

func TestHandleReveal_Valid(t *testing.T) {
	h := testSetup()
	// Register a player and get their ID
	w := post(h, "/api/register", RegisterRequest{Username: "RevealMe"})
	var reg RegisterResponse
	json.Unmarshal(w.Body.Bytes(), &reg)

	// Reveal
	w2 := post(h, "/api/reveal/"+reg.PlayerID, nil)
	if w2.Code != 200 {
		t.Fatalf("status: got %d, want 200 — body: %s", w2.Code, w2.Body.String())
	}
	var resp map[string]string
	json.Unmarshal(w2.Body.Bytes(), &resp)
	if resp["username"] != "RevealMe" {
		t.Errorf("username: got %q, want %q", resp["username"], "RevealMe")
	}
}

func TestHandleReveal_NotFound(t *testing.T) {
	h := testSetup()
	w := post(h, "/api/reveal/rival-notexist", nil)
	if w.Code != 404 {
		t.Errorf("status: got %d, want 404", w.Code)
	}
}

// ── /api/player ───────────────────────────────────────────────────────────────

func TestHandlePlayer_Valid(t *testing.T) {
	h := testSetup()
	w := post(h, "/api/register", RegisterRequest{Username: "ProfileUser"})
	var reg RegisterResponse
	json.Unmarshal(w.Body.Bytes(), &reg)

	w2 := get(h, "/api/player/"+reg.PlayerID)
	if w2.Code != 200 {
		t.Fatalf("status: got %d, want 200", w2.Code)
	}
	var profile PublicProfile
	json.Unmarshal(w2.Body.Bytes(), &profile)
	if profile.ID != reg.PlayerID {
		t.Errorf("id: got %s, want %s", profile.ID, reg.PlayerID)
	}
}

func TestHandlePlayer_NotFound(t *testing.T) {
	h := testSetup()
	w := get(h, "/api/player/rival-ghost")
	if w.Code != 404 {
		t.Errorf("status: got %d, want 404", w.Code)
	}
}
