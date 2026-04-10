package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"log"
	"sort"
	"sync"
)

type Store struct {
	mu      sync.RWMutex
	players map[string]*RegisteredPlayer
	db      *sql.DB // nil = in-memory only
}

func NewStore(db *sql.DB) *Store {
	return &Store{players: make(map[string]*RegisteredPlayer), db: db}
}

// LoadAll bulk-inserts players at startup (from DB restore).
func (s *Store) LoadAll(players []*RegisteredPlayer) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, p := range players {
		s.players[p.ID] = p
	}
}

func (s *Store) Register(p *RegisteredPlayer) {
	if s.db != nil {
		if err := dbSave(s.db, p); err != nil {
			log.Printf("db save: %v", err)
		}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.players[p.ID] = p
}

// All returns all registry entries sorted by last active (newest first).
func (s *Store) All() []RegistryEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]RegistryEntry, 0, len(s.players))
	for _, p := range s.players {
		out = append(out, p.registryEntry())
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].LastActive.After(out[j].LastActive)
	})
	return out
}

// Get returns the full registered player by ID.
func (s *Store) Get(id string) (*RegisteredPlayer, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.players[id]
	return p, ok
}

// Search returns public profiles of players who play at least one target
// character, sorted by match score descending. Self is excluded by ID.
func (s *Store) Search(targets []string, excludeID string) []SearchResult {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var results []SearchResult
	for _, p := range s.players {
		if p.ID == excludeID {
			continue
		}
		if score := p.matchScore(targets); score > 0 {
			results = append(results, SearchResult{Profile: p.public(), MatchScore: score})
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

// NewPlayerID generates a short random ID like "rival-a3f2c1".
func NewPlayerID() string {
	b := make([]byte, 3)
	rand.Read(b)
	return "rival-" + hex.EncodeToString(b)
}
