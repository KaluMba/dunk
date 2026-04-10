package main

import (
	"sort"
	"sync"
)

// Store is a thread-safe in-memory registry of players.
// Replace with a real database when ready.
type Store struct {
	mu      sync.RWMutex
	players map[string]*Player
}

func NewStore() *Store {
	s := &Store{players: make(map[string]*Player)}
	s.seed()
	return s
}

func (s *Store) Register(p *Player) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.players[p.Username] = p
}

// Search returns all players who play at least one of the target characters,
// sorted by how many characters match (best match first).
func (s *Store) Search(targets []string, exclude string) []SearchResult {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var results []SearchResult
	for _, p := range s.players {
		if p.Username == exclude {
			continue
		}
		if score := p.matchScore(targets); score > 0 {
			results = append(results, SearchResult{Player: p, MatchScore: score})
		}
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].MatchScore > results[j].MatchScore
	})
	return results
}

// seed populates the store with mock players for development / demo.
func (s *Store) seed() {
	mock := []*Player{
		{Username: "NightCrawl3r", Characters: []string{"Psylocke", "Storm", "Black Widow"}, Rank: "Platinum III", Region: "NA-East"},
		{Username: "IronCore99", Characters: []string{"Iron Man", "Thor", "Star-Lord"}, Rank: "Gold I", Region: "NA-West"},
		{Username: "WolvieMain", Characters: []string{"Wolverine", "Winter Soldier", "Black Panther"}, Rank: "Diamond II", Region: "EU"},
		{Username: "StrangeLoop", Characters: []string{"Doctor Strange", "Loki", "Adam Warlock"}, Rank: "Celestial", Region: "EU"},
		{Username: "BigGreenMachine", Characters: []string{"Hulk", "The Thing", "Groot"}, Rank: "Silver I", Region: "NA-East"},
		{Username: "WebSlinger42", Characters: []string{"Spider-Man", "Moon Knight", "Squirrel Girl"}, Rank: "Gold III", Region: "NA-West"},
		{Username: "ChaosQueen", Characters: []string{"Scarlet Witch", "Storm", "Hela"}, Rank: "Platinum I", Region: "EU"},
		{Username: "HealBot5000", Characters: []string{"Mantis", "Luna Snow", "Cloak & Dagger"}, Rank: "Gold II", Region: "Asia"},
		{Username: "RocketMann", Characters: []string{"Rocket Raccoon", "Groot", "Star-Lord"}, Rank: "Platinum II", Region: "NA-East"},
		{Username: "MagnetoRises", Characters: []string{"Magneto", "Doctor Strange", "Captain America"}, Rank: "Diamond I", Region: "EU"},
		{Username: "JeffFan2025", Characters: []string{"Jeff the Land Shark", "Invisible Woman", "Luna Snow"}, Rank: "Gold I", Region: "Asia"},
		{Username: "PunkPeni", Characters: []string{"Peni Parker", "Venom", "The Punisher"}, Rank: "Platinum III", Region: "NA-West"},
		{Username: "HelaMains", Characters: []string{"Hela", "Scarlet Witch", "Storm"}, Rank: "Diamond III", Region: "NA-East"},
		{Username: "ThorHammer", Characters: []string{"Thor", "Captain America", "Hulk"}, Rank: "Gold II", Region: "EU"},
		{Username: "CosmicMantis", Characters: []string{"Mantis", "Adam Warlock", "Invisible Woman"}, Rank: "Platinum I", Region: "NA-West"},
	}
	for _, p := range mock {
		s.players[p.Username] = p
	}
}
