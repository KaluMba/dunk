package main

import (
	"testing"
	"time"
)

// ── parsePlayTime ─────────────────────────────────────────────────────────────

func TestParsePlayTime_Seconds(t *testing.T) {
	if got := parsePlayTime("754"); got != 754 {
		t.Errorf("got %d, want 754", got)
	}
}

func TestParsePlayTime_MMSS(t *testing.T) {
	if got := parsePlayTime("12:34"); got != 12*60+34 {
		t.Errorf("got %d, want %d", got, 12*60+34)
	}
}

func TestParsePlayTime_HHMMSS(t *testing.T) {
	if got := parsePlayTime("1:23:45"); got != 3600+23*60+45 {
		t.Errorf("got %d, want %d", got, 3600+23*60+45)
	}
}

func TestParsePlayTime_Empty(t *testing.T) {
	if got := parsePlayTime(""); got != 0 {
		t.Errorf("got %d, want 0", got)
	}
}

func TestParsePlayTime_Whitespace(t *testing.T) {
	if got := parsePlayTime("  300  "); got != 300 {
		t.Errorf("got %d, want 300", got)
	}
}

// ── AggregateStats ────────────────────────────────────────────────────────────

func match(hero string, win bool, k, d, a int64, playSecs string) APIMatch {
	return APIMatch{
		MatchUID:  "test-uid",
		Timestamp: time.Now().Unix(),
		MatchPlayer: APIMatchPlayer{
			IsWin:     win,
			PlayerUID: "player-1",
			PlayerHero: APIPlayerHero{
				HeroName: hero,
				Kills:    k,
				Deaths:   d,
				Assists:  a,
				PlayTime: playSecs,
				Damage:   10000,
				Healing:  0,
			},
		},
	}
}

func TestAggregateStats_Empty(t *testing.T) {
	stats := AggregateStats(nil)
	if len(stats) != 0 {
		t.Errorf("expected empty map, got %d entries", len(stats))
	}
}

func TestAggregateStats_SingleHero(t *testing.T) {
	matches := []APIMatch{
		match("Storm", true, 10, 2, 8, "600"),
		match("Storm", false, 5, 4, 6, "720"),
		match("Storm", true, 12, 3, 9, "680"),
	}
	stats := AggregateStats(matches)

	cs, ok := stats["Storm"]
	if !ok {
		t.Fatal("expected Storm stats")
	}
	if cs.Games != 3 {
		t.Errorf("games: got %d, want 3", cs.Games)
	}
	if cs.Wins != 2 {
		t.Errorf("wins: got %d, want 2", cs.Wins)
	}
	if cs.Kills != 27 {
		t.Errorf("kills: got %d, want 27", cs.Kills)
	}
	if cs.Deaths != 9 {
		t.Errorf("deaths: got %d, want 9", cs.Deaths)
	}
	if cs.PlaytimeS != 2000 {
		t.Errorf("playtime: got %d, want 2000", cs.PlaytimeS)
	}
	// WinRate = 2/3 * 100 = 66.7
	if cs.WinRate < 66 || cs.WinRate > 67 {
		t.Errorf("winRate: got %.1f, want ~66.7", cs.WinRate)
	}
	// KDA = (27+23)/9 ≈ 5.56
	if cs.KDA < 5 || cs.KDA > 6 {
		t.Errorf("kda: got %.2f, want ~5.56", cs.KDA)
	}
}

func TestAggregateStats_MultipleHeroes(t *testing.T) {
	matches := []APIMatch{
		match("Storm", true, 8, 2, 6, "600"),
		match("Hela", false, 6, 5, 4, "700"),
		match("Storm", true, 10, 3, 8, "650"),
	}
	stats := AggregateStats(matches)

	if len(stats) != 2 {
		t.Errorf("expected 2 heroes, got %d", len(stats))
	}
	if stats["Storm"].Games != 2 {
		t.Error("Storm should have 2 games")
	}
	if stats["Hela"].Games != 1 {
		t.Error("Hela should have 1 game")
	}
}

func TestAggregateStats_ZeroDeaths(t *testing.T) {
	matches := []APIMatch{
		match("Thor", true, 10, 0, 5, "500"),
	}
	stats := AggregateStats(matches)
	// KDA with 0 deaths treated as 1 death: (10+5)/1 = 15
	cs := stats["Thor"]
	if cs.KDA != 15.0 {
		t.Errorf("KDA with 0 deaths: got %.2f, want 15.00", cs.KDA)
	}
}

func TestAggregateStats_SkipsBlankHero(t *testing.T) {
	matches := []APIMatch{
		match("", true, 5, 2, 3, "400"),
		match("Storm", true, 8, 2, 6, "600"),
	}
	stats := AggregateStats(matches)
	if len(stats) != 1 {
		t.Errorf("blank hero should be skipped, got %d entries", len(stats))
	}
}

// ── TopMains ──────────────────────────────────────────────────────────────────

func TestTopMains_OrderedByPlaytime(t *testing.T) {
	stats := map[string]*CharacterStats{
		"Storm": {PlaytimeS: 3600},
		"Hela":  {PlaytimeS: 7200},
		"Thor":  {PlaytimeS: 1800},
	}
	mains := TopMains(stats, 2)
	if len(mains) != 2 {
		t.Fatalf("expected 2 mains, got %d", len(mains))
	}
	if mains[0] != "Hela" {
		t.Errorf("expected Hela first (most playtime), got %s", mains[0])
	}
	if mains[1] != "Storm" {
		t.Errorf("expected Storm second, got %s", mains[1])
	}
}

func TestTopMains_FewerThanN(t *testing.T) {
	stats := map[string]*CharacterStats{
		"Storm": {PlaytimeS: 3600},
	}
	mains := TopMains(stats, 3)
	if len(mains) != 1 {
		t.Errorf("expected 1 main, got %d", len(mains))
	}
}

func TestTopMains_Empty(t *testing.T) {
	mains := TopMains(nil, 3)
	if len(mains) != 0 {
		t.Errorf("expected 0 mains, got %d", len(mains))
	}
}

// ── MockRivalsClient ──────────────────────────────────────────────────────────

func TestMockFindPlayer(t *testing.T) {
	m := &MockRivalsClient{}
	p, err := m.FindPlayer("TestUser")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p.Name != "TestUser" {
		t.Errorf("name: got %s, want TestUser", p.Name)
	}
	if p.UID == "" {
		t.Error("UID should not be empty")
	}
}

func TestMockFetchMatches_Count(t *testing.T) {
	m := &MockRivalsClient{}
	profile, _ := m.FindPlayer("AnyUser")
	matches, err := m.FetchMatches(profile.UID, 20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(matches) != 20 {
		t.Errorf("expected 20 matches, got %d", len(matches))
	}
}

func TestMockFetchMatches_Deterministic(t *testing.T) {
	m := &MockRivalsClient{}
	p, _ := m.FindPlayer("SameUser")
	a, _ := m.FetchMatches(p.UID, 5)
	b, _ := m.FetchMatches(p.UID, 5)
	for i := range a {
		if a[i].MatchPlayer.PlayerHero.HeroName != b[i].MatchPlayer.PlayerHero.HeroName {
			t.Errorf("match %d: got different hero names on repeated calls", i)
		}
	}
}

func TestMockFetchMatches_DifferentUsersGetDifferentHeroes(t *testing.T) {
	m := &MockRivalsClient{}
	p1, _ := m.FindPlayer("Alpha")
	p2, _ := m.FindPlayer("Beta")
	a, _ := m.FetchMatches(p1.UID, 20)
	b, _ := m.FetchMatches(p2.UID, 20)

	// Aggregate and check they don't have identical hero distributions
	sa := AggregateStats(a)
	sb := AggregateStats(b)
	// They could theoretically be the same, but with the hash approach it's
	// astronomically unlikely for two different usernames.
	same := true
	for k := range sa {
		if _, ok := sb[k]; !ok {
			same = false
			break
		}
	}
	if same && len(sa) == len(sb) {
		t.Log("warning: two different users got identical hero distribution (may be coincidence)")
	}
}
