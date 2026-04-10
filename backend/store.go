package main

import (
	"crypto/rand"
	"encoding/hex"
	"sort"
	"sync"
	"time"
)

// Store is a thread-safe in-memory registry.
// Replace the map with a real database (Postgres, SQLite, etc.) when ready.
type Store struct {
	mu      sync.RWMutex
	players map[string]*RegisteredPlayer // keyed by player ID
}

func NewStore() *Store {
	return &Store{players: make(map[string]*RegisteredPlayer)}
}

func (s *Store) Register(p *RegisteredPlayer) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.players[p.ID] = p
}

// Search returns public profiles of players who play at least one target
// character, sorted by match score (descending). Self is excluded by ID.
func (s *Store) Search(targets []string, excludeID string) []SearchResult {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var results []SearchResult
	for _, p := range s.players {
		if p.ID == excludeID {
			continue
		}
		if score := p.matchScore(targets); score > 0 {
			results = append(results, SearchResult{
				Profile:    p.public(),
				MatchScore: score,
			})
		}
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].MatchScore > results[j].MatchScore
	})
	return results
}

// Reveal returns the username for a given player ID, or "" if not found.
func (s *Store) Reveal(id string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if p, ok := s.players[id]; ok {
		return p.Username
	}
	return ""
}

// Get returns the full registered player by ID.
func (s *Store) Get(id string) (*RegisteredPlayer, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.players[id]
	return p, ok
}

// NewPlayerID generates a short random ID like "rival-a3f2c1".
func NewPlayerID() string {
	b := make([]byte, 3)
	rand.Read(b)
	return "rival-" + hex.EncodeToString(b)
}

// Seed populates the store with mock players using the provided client.
// Called at startup when no real data is available.
func (s *Store) Seed(client RivalsClient) {
	seeds := []struct {
		username string
		rank     string
		region   string
	}{
		{"NightCrawl3r", "Platinum III", "NA-East"},
		{"IronCore99", "Gold I", "NA-West"},
		{"WolvieMain", "Diamond II", "EU"},
		{"StrangeLoop", "Celestial", "EU"},
		{"BigGreenMachine", "Silver I", "NA-East"},
		{"WebSlinger42", "Gold III", "NA-West"},
		{"ChaosQueen", "Platinum I", "EU"},
		{"HealBot5000", "Gold II", "Asia"},
		{"RocketMann", "Platinum II", "NA-East"},
		{"MagnetoRises", "Diamond I", "EU"},
		{"JeffFan2025", "Gold I", "Asia"},
		{"PunkPeni", "Platinum III", "NA-West"},
		{"HelaMains", "Diamond III", "NA-East"},
		{"ThorHammer", "Gold II", "EU"},
		{"CosmicMantis", "Platinum I", "NA-West"},
	}

	for _, seed := range seeds {
		profile, err := client.FindPlayer(seed.username)
		if err != nil {
			continue
		}
		matches, err := client.FetchMatches(profile.UID, 20)
		if err != nil {
			continue
		}
		stats := AggregateStats(matches)
		mains := TopMains(stats, 3)
		lastActive := time.Now()
		if len(matches) > 0 {
			lastActive = time.Unix(matches[0].Timestamp, 0)
		}

		s.Register(&RegisteredPlayer{
			ID:         NewPlayerID(),
			Username:   seed.username,
			UID:        profile.UID,
			Stats:      stats,
			MainChars:  mains,
			Rank:       seed.rank,
			Region:     seed.region,
			LastActive: lastActive,
		})
	}
}
