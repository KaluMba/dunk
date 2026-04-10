package main

import (
	"encoding/json"
	"fmt"
	"hash/fnv"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

// ── Interface ────────────────────────────────────────────────────────────────

// RivalsClient abstracts the MarvelRivalsAPI.com integration.
// Swap MockRivalsClient for LiveRivalsClient once you have an API key.
type RivalsClient interface {
	FindPlayer(username string) (*apiFindPlayerResp, error)
	FetchMatches(uid string, limit int) ([]APIMatch, error)
}

// AggregateStats computes per-character stats from raw match history.
// Pure function — easy to unit-test independently of HTTP.
func AggregateStats(matches []APIMatch) map[string]*CharacterStats {
	stats := make(map[string]*CharacterStats)

	for _, m := range matches {
		h := m.MatchPlayer.PlayerHero
		name := strings.TrimSpace(h.HeroName)
		if name == "" {
			continue
		}
		cs, ok := stats[name]
		if !ok {
			cs = &CharacterStats{Name: name}
			stats[name] = cs
		}
		cs.Games++
		if m.MatchPlayer.IsWin {
			cs.Wins++
		}
		cs.Kills += h.Kills
		cs.Deaths += h.Deaths
		cs.Assists += h.Assists
		cs.PlaytimeS += parsePlayTime(h.PlayTime)
		cs.Damage += h.Damage
		cs.Healing += h.Healing
	}

	for _, cs := range stats {
		cs.compute()
	}
	return stats
}

// TopMains returns hero names ordered by playtime descending, capped at n.
func TopMains(stats map[string]*CharacterStats, n int) []string {
	type kv struct {
		name string
		pt   int64
	}
	pairs := make([]kv, 0, len(stats))
	for name, cs := range stats {
		pairs = append(pairs, kv{name, cs.PlaytimeS})
	}
	sort.Slice(pairs, func(i, j int) bool { return pairs[i].pt > pairs[j].pt })

	out := make([]string, 0, n)
	for i := 0; i < len(pairs) && i < n; i++ {
		out = append(out, pairs[i].name)
	}
	return out
}

// parsePlayTime converts the play_time string from the API (seconds as string,
// or HH:MM:SS) into a total number of seconds.
func parsePlayTime(s string) int64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	// Plain integer (seconds)
	if n, err := strconv.ParseInt(s, 10, 64); err == nil {
		return n
	}
	// HH:MM:SS or MM:SS
	parts := strings.Split(s, ":")
	var total int64
	for _, p := range parts {
		n, _ := strconv.ParseInt(strings.TrimSpace(p), 10, 64)
		total = total*60 + n
	}
	return total
}

// ── Mock implementation ───────────────────────────────────────────────────────

// MockRivalsClient returns realistic deterministic fake data — no API key needed.
type MockRivalsClient struct{}

var mockHeroPool = []string{
	"Storm", "Iron Man", "Thor", "Hela", "Spider-Man", "Wolverine",
	"Doctor Strange", "Mantis", "Luna Snow", "Scarlet Witch",
	"Hulk", "Venom", "Winter Soldier", "Black Panther",
	"Rocket Raccoon", "Psylocke", "Magneto", "Peni Parker",
}

func (m *MockRivalsClient) FindPlayer(username string) (*apiFindPlayerResp, error) {
	return &apiFindPlayerResp{
		Name: username,
		UID:  fmt.Sprintf("mock-%d", hash32(username)),
	}, nil
}

func (m *MockRivalsClient) FetchMatches(uid string, limit int) ([]APIMatch, error) {
	h := hash32(uid)

	// Pick 2–3 mains deterministically from uid hash
	n := 2 + int(h%2)
	heroes := make([]string, 0, n)
	used := map[int]bool{}
	for i := 0; i < n; i++ {
		idx := int((h >> uint(i*4)) % uint32(len(mockHeroPool)))
		for used[idx] {
			idx = (idx + 1) % len(mockHeroPool)
		}
		heroes = append(heroes, mockHeroPool[idx])
		used[idx] = true
	}

	baseWin := 0.45 + float64(h%23)/100.0 // 45–68% win rate
	baseKD := 1.8 + float64(h%25)/10.0   // 1.8–4.3 KD

	matches := make([]APIMatch, limit)
	for i := range matches {
		// ~70% main hero, ~20% secondary, ~10% third
		var hero string
		r := (h >> uint(i%16)) % 100
		switch {
		case r < 70 || len(heroes) < 2:
			hero = heroes[0]
		case r < 90 || len(heroes) < 3:
			hero = heroes[1]
		default:
			hero = heroes[2]
		}

		isWin := float64(i%10) < baseWin*10
		kills := int64(baseKD*4) + int64(i%3)
		deaths := int64(4)
		assists := int64(baseKD*3) + int64(i%4)

		matches[i] = APIMatch{
			MatchUID:  fmt.Sprintf("%s-%d", uid, i),
			Timestamp: time.Now().Add(-time.Duration(i*3) * time.Hour).Unix(),
			MatchPlayer: APIMatchPlayer{
				IsWin:     isWin,
				PlayerUID: uid,
				PlayerHero: APIPlayerHero{
					HeroName: hero,
					Kills:    kills,
					Deaths:   deaths,
					Assists:  assists,
					PlayTime: fmt.Sprintf("%d", 600+i*40), // ~10–23 min
					Damage:   int64(20000 + i*800),
					Healing:  int64(i * 200),
				},
			},
		}
	}
	return matches, nil
}

func hash32(s string) uint32 {
	h := fnv.New32a()
	h.Write([]byte(s))
	return h.Sum32()
}

// ── Live implementation ───────────────────────────────────────────────────────

// LiveRivalsClient calls the real MarvelRivalsAPI.com endpoints.
// Get an API key at https://marvelrivalsapi.com/dashboard
type LiveRivalsClient struct {
	apiKey string
	http   *http.Client
}

func NewLiveClient(apiKey string) *LiveRivalsClient {
	return &LiveRivalsClient{
		apiKey: apiKey,
		http:   &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *LiveRivalsClient) get(url string, out any) error {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("x-api-key", c.apiKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return fmt.Errorf("not found")
	}
	if resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf("invalid API key")
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("api returned %d", resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func (c *LiveRivalsClient) FindPlayer(username string) (*apiFindPlayerResp, error) {
	var r apiFindPlayerResp
	url := fmt.Sprintf("https://marvelrivalsapi.com/api/v1/find-player/%s", username)
	if err := c.get(url, &r); err != nil {
		return nil, err
	}
	return &r, nil
}

func (c *LiveRivalsClient) FetchMatches(uid string, limit int) ([]APIMatch, error) {
	url := fmt.Sprintf(
		"https://marvelrivalsapi.com/api/v1/player/%s/match-history?season=1&skip=%d",
		uid, limit,
	)
	var r apiMatchHistoryResp
	if err := c.get(url, &r); err != nil {
		return nil, err
	}
	return r.MatchHistory, nil
}
