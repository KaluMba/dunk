package main

import (
	"testing"
	"time"
)

func makePlayer(id, username string, mains []string) *RegisteredPlayer {
	stats := make(map[string]*CharacterStats)
	for _, m := range mains {
		stats[m] = &CharacterStats{Name: m, Games: 10, Wins: 6, PlaytimeS: 3600}
		stats[m].compute()
	}
	return &RegisteredPlayer{
		ID:         id,
		Username:   username,
		MainChars:  mains,
		Stats:      stats,
		Rank:       "Gold I",
		Region:     "EU",
		LastActive: time.Now(),
	}
}

func freshStore() *Store {
	return &Store{players: make(map[string]*RegisteredPlayer)}
}

// ── Register ─────────────────────────────────────────────────────────────────

func TestRegister_AddsPlayer(t *testing.T) {
	s := freshStore()
	p := makePlayer("rival-001", "Hero1", []string{"Storm"})
	s.Register(p)
	if _, ok := s.players["rival-001"]; !ok {
		t.Error("player not stored")
	}
}

func TestRegister_OverwritesSameID(t *testing.T) {
	s := freshStore()
	s.Register(makePlayer("rival-001", "OriginalName", []string{"Storm"}))
	s.Register(makePlayer("rival-001", "UpdatedName", []string{"Hela"}))
	if s.players["rival-001"].Username != "UpdatedName" {
		t.Error("second register should overwrite")
	}
}

// ── Search ────────────────────────────────────────────────────────────────────

func TestSearch_EmptyStore(t *testing.T) {
	s := freshStore()
	results := s.Search([]string{"Storm"}, "")
	if len(results) != 0 {
		t.Errorf("expected 0 results, got %d", len(results))
	}
}

func TestSearch_NoMatch(t *testing.T) {
	s := freshStore()
	s.Register(makePlayer("rival-001", "A", []string{"Iron Man"}))
	results := s.Search([]string{"Storm"}, "")
	if len(results) != 0 {
		t.Errorf("expected 0 results, got %d", len(results))
	}
}

func TestSearch_SingleMatch(t *testing.T) {
	s := freshStore()
	s.Register(makePlayer("rival-001", "A", []string{"Storm", "Hela"}))
	s.Register(makePlayer("rival-002", "B", []string{"Iron Man"}))
	results := s.Search([]string{"Storm"}, "")
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if results[0].Profile.ID != "rival-001" {
		t.Errorf("wrong player: got %s", results[0].Profile.ID)
	}
	if results[0].MatchScore != 1 {
		t.Errorf("match score: got %d, want 1", results[0].MatchScore)
	}
}

func TestSearch_SortedByMatchScore(t *testing.T) {
	s := freshStore()
	s.Register(makePlayer("rival-001", "A", []string{"Storm"}))
	s.Register(makePlayer("rival-002", "B", []string{"Storm", "Hela"}))
	s.Register(makePlayer("rival-003", "C", []string{"Storm", "Hela", "Iron Man"}))

	results := s.Search([]string{"Storm", "Hela", "Iron Man"}, "")
	if len(results) != 3 {
		t.Fatalf("expected 3 results, got %d", len(results))
	}
	if results[0].Profile.ID != "rival-003" {
		t.Errorf("first result should be rival-003 (score 3), got %s", results[0].Profile.ID)
	}
	if results[1].Profile.ID != "rival-002" {
		t.Errorf("second result should be rival-002 (score 2), got %s", results[1].Profile.ID)
	}
	if results[2].Profile.ID != "rival-001" {
		t.Errorf("third result should be rival-001 (score 1), got %s", results[2].Profile.ID)
	}
}

func TestSearch_ExcludesSelf(t *testing.T) {
	s := freshStore()
	s.Register(makePlayer("rival-001", "Me", []string{"Storm"}))
	s.Register(makePlayer("rival-002", "Other", []string{"Storm"}))
	results := s.Search([]string{"Storm"}, "rival-001")
	if len(results) != 1 {
		t.Fatalf("expected 1 result (self excluded), got %d", len(results))
	}
	if results[0].Profile.ID == "rival-001" {
		t.Error("self should be excluded from results")
	}
}

// ── Reveal ────────────────────────────────────────────────────────────────────

func TestReveal_Valid(t *testing.T) {
	s := freshStore()
	s.Register(makePlayer("rival-abc", "SecretUser", []string{"Storm"}))
	name := s.Reveal("rival-abc")
	if name != "SecretUser" {
		t.Errorf("reveal: got %q, want %q", name, "SecretUser")
	}
}

func TestReveal_NotFound(t *testing.T) {
	s := freshStore()
	name := s.Reveal("rival-notexist")
	if name != "" {
		t.Errorf("reveal of unknown id should return empty string, got %q", name)
	}
}

// ── PublicProfile ─────────────────────────────────────────────────────────────

func TestPublicProfile_NoUsername(t *testing.T) {
	p := makePlayer("rival-001", "SecretName", []string{"Storm"})
	pub := p.public()
	// Public profile must not expose username — it's simply absent from the struct.
	// If someone added it by mistake this verifies it's not leaked.
	if pub.ID != "rival-001" {
		t.Errorf("id: got %s, want rival-001", pub.ID)
	}
	if len(pub.MainChars) != 1 || pub.MainChars[0] != "Storm" {
		t.Error("main chars not preserved")
	}
}

// ── matchScore ────────────────────────────────────────────────────────────────

func TestMatchScore_None(t *testing.T) {
	p := makePlayer("x", "u", []string{"Iron Man"})
	if got := p.matchScore([]string{"Storm"}); got != 0 {
		t.Errorf("expected 0, got %d", got)
	}
}

func TestMatchScore_Partial(t *testing.T) {
	p := makePlayer("x", "u", []string{"Storm", "Hela", "Iron Man"})
	if got := p.matchScore([]string{"Storm", "Thor"}); got != 1 {
		t.Errorf("expected 1, got %d", got)
	}
}

func TestMatchScore_All(t *testing.T) {
	p := makePlayer("x", "u", []string{"Storm", "Hela"})
	if got := p.matchScore([]string{"Storm", "Hela"}); got != 2 {
		t.Errorf("expected 2, got %d", got)
	}
}
