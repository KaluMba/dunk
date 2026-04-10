package main

import (
	"math"
	"time"
)

// ── Public types (sent in API responses) ────────────────────────────────────

// CharacterStats holds computed performance metrics for one hero.
type CharacterStats struct {
	Name          string  `json:"name"`
	Games         int     `json:"games"`
	Wins          int     `json:"wins"`
	Kills         int64   `json:"kills"`
	Deaths        int64   `json:"deaths"`
	Assists       int64   `json:"assists"`
	PlaytimeS     int64   `json:"playtimeSeconds"`
	Damage        int64   `json:"damage"`
	Healing       int64   `json:"healing"`
	WinRate       float64 `json:"winRate"`       // percentage, e.g. 58.3
	KDA           float64 `json:"kda"`           // e.g. 2.85
	PlaytimeHours float64 `json:"playtimeHours"` // e.g. 4.2
}

func (s *CharacterStats) compute() {
	if s.Games > 0 {
		s.WinRate = math.Round(float64(s.Wins)/float64(s.Games)*1000) / 10
	}
	d := s.Deaths
	if d == 0 {
		d = 1
	}
	s.KDA = math.Round(float64(s.Kills+s.Assists)/float64(d)*100) / 100
	s.PlaytimeHours = math.Round(float64(s.PlaytimeS)/3600*10) / 10
}

// PublicProfile is what search results expose — no username.
type PublicProfile struct {
	ID         string                     `json:"id"`
	MainChars  []string                   `json:"mainCharacters"`
	Stats      map[string]*CharacterStats `json:"stats"`
	Rank       string                     `json:"rank,omitempty"`
	Region     string                     `json:"region,omitempty"`
	LastActive time.Time                  `json:"lastActive"`
}

// SearchResult wraps a profile with how many searched characters matched.
type SearchResult struct {
	Profile    PublicProfile `json:"profile"`
	MatchScore int           `json:"matchScore"`
}

// ── Internal types (never sent as JSON) ─────────────────────────────────────

// RegisteredPlayer is the full record stored in the registry.
type RegisteredPlayer struct {
	ID         string
	Username   string // kept secret until revealed
	UID        string // Marvel Rivals UID from API
	Stats      map[string]*CharacterStats
	MainChars  []string
	Rank       string
	Region     string
	LastActive time.Time
}

func (p *RegisteredPlayer) public() PublicProfile {
	return PublicProfile{
		ID:         p.ID,
		MainChars:  p.MainChars,
		Stats:      p.Stats,
		Rank:       p.Rank,
		Region:     p.Region,
		LastActive: p.LastActive,
	}
}

// matchScore returns how many of the target characters appear in this player's mains.
func (p *RegisteredPlayer) matchScore(targets []string) int {
	index := make(map[string]bool, len(p.MainChars))
	for _, c := range p.MainChars {
		index[c] = true
	}
	score := 0
	for _, t := range targets {
		if index[t] {
			score++
		}
	}
	return score
}

// ── HTTP request/response bodies ────────────────────────────────────────────

type RegisterRequest struct {
	Username string `json:"username"`
	Rank     string `json:"rank"`
	Region   string `json:"region"`
}

type RegisterResponse struct {
	PlayerID   string                     `json:"playerId"`
	MainChars  []string                   `json:"mainCharacters"`
	Stats      map[string]*CharacterStats `json:"stats"`
	LastActive time.Time                  `json:"lastActive"`
}

// ── MarvelRivalsAPI.com response shapes ─────────────────────────────────────
// Verified against https://docs.marvelrivalsapi.com

type apiFindPlayerResp struct {
	Name string `json:"name"`
	UID  string `json:"uid"`
}

type apiMatchHistoryResp struct {
	MatchHistory []APIMatch `json:"match_history"`
}

type APIMatch struct {
	MatchUID        string         `json:"match_uid"`
	Timestamp       int64          `json:"match_time_stamp"`
	MatchPlayer     APIMatchPlayer `json:"match_player"`
}

type APIMatchPlayer struct {
	IsWin      bool          `json:"is_win"`
	PlayerUID  string        `json:"player_uid"`
	PlayerHero APIPlayerHero `json:"player_hero"`
}

type APIPlayerHero struct {
	HeroName  string `json:"hero_name"`
	Kills     int64  `json:"kills"`
	Deaths    int64  `json:"deaths"`
	Assists   int64  `json:"assists"`
	PlayTime  string `json:"play_time"` // string — see parsePlayTime
	Damage    int64  `json:"total_hero_damage"`
	Healing   int64  `json:"total_hero_heal"`
}

// ── Character roster ─────────────────────────────────────────────────────────

// Character is a playable hero shown in the picker.
type Character struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Role string `json:"role"` // vanguard | duelist | strategist
}

var allCharacters = []Character{
	// Vanguards
	{ID: "captain-america", Name: "Captain America", Role: "vanguard"},
	{ID: "doctor-strange", Name: "Doctor Strange", Role: "vanguard"},
	{ID: "groot", Name: "Groot", Role: "vanguard"},
	{ID: "hulk", Name: "Hulk", Role: "vanguard"},
	{ID: "magneto", Name: "Magneto", Role: "vanguard"},
	{ID: "peni-parker", Name: "Peni Parker", Role: "vanguard"},
	{ID: "the-thing", Name: "The Thing", Role: "vanguard"},
	{ID: "thor", Name: "Thor", Role: "vanguard"},
	{ID: "venom", Name: "Venom", Role: "vanguard"},
	// Duelists
	{ID: "black-panther", Name: "Black Panther", Role: "duelist"},
	{ID: "black-widow", Name: "Black Widow", Role: "duelist"},
	{ID: "hawkeye", Name: "Hawkeye", Role: "duelist"},
	{ID: "hela", Name: "Hela", Role: "duelist"},
	{ID: "human-torch", Name: "Human Torch", Role: "duelist"},
	{ID: "iron-man", Name: "Iron Man", Role: "duelist"},
	{ID: "moon-knight", Name: "Moon Knight", Role: "duelist"},
	{ID: "mr-fantastic", Name: "Mister Fantastic", Role: "duelist"},
	{ID: "namor", Name: "Namor", Role: "duelist"},
	{ID: "psylocke", Name: "Psylocke", Role: "duelist"},
	{ID: "scarlet-witch", Name: "Scarlet Witch", Role: "duelist"},
	{ID: "spider-man", Name: "Spider-Man", Role: "duelist"},
	{ID: "squirrel-girl", Name: "Squirrel Girl", Role: "duelist"},
	{ID: "star-lord", Name: "Star-Lord", Role: "duelist"},
	{ID: "storm", Name: "Storm", Role: "duelist"},
	{ID: "the-punisher", Name: "The Punisher", Role: "duelist"},
	{ID: "winter-soldier", Name: "Winter Soldier", Role: "duelist"},
	{ID: "wolverine", Name: "Wolverine", Role: "duelist"},
	// Strategists
	{ID: "adam-warlock", Name: "Adam Warlock", Role: "strategist"},
	{ID: "cloak-dagger", Name: "Cloak & Dagger", Role: "strategist"},
	{ID: "invisible-woman", Name: "Invisible Woman", Role: "strategist"},
	{ID: "jeff", Name: "Jeff the Land Shark", Role: "strategist"},
	{ID: "loki", Name: "Loki", Role: "strategist"},
	{ID: "luna-snow", Name: "Luna Snow", Role: "strategist"},
	{ID: "mantis", Name: "Mantis", Role: "strategist"},
	{ID: "rocket-raccoon", Name: "Rocket Raccoon", Role: "strategist"},
}
