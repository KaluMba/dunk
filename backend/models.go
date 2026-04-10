package main

// Character represents a playable hero in Marvel Rivals.
type Character struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Role string `json:"role"` // vanguard | duelist | strategist
}

// Player is a registered user in the find-teammates pool.
type Player struct {
	Username   string   `json:"username"`
	Characters []string `json:"characters"` // ordered by priority
	Rank       string   `json:"rank"`
	Region     string   `json:"region"`
}

// matchScore returns how many of the target characters this player plays.
func (p *Player) matchScore(targets []string) int {
	index := make(map[string]bool, len(p.Characters))
	for _, c := range p.Characters {
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

// SearchResult is a player plus how closely they matched the search.
type SearchResult struct {
	Player     *Player `json:"player"`
	MatchScore int     `json:"matchScore"`
}

// RegisterRequest is the body for POST /api/register.
type RegisterRequest struct {
	Username   string   `json:"username"`
	Characters []string `json:"characters"`
	Rank       string   `json:"rank"`
	Region     string   `json:"region"`
}

// All characters in the Marvel Rivals roster (Season 0 / early 2025).
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
