package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"time"

	_ "github.com/lib/pq"
)

func openDB(url string) (*sql.DB, error) {
	db, err := sql.Open("postgres", url)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		return nil, err
	}
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS players (
			id          TEXT PRIMARY KEY,
			username    TEXT NOT NULL UNIQUE,
			uid         TEXT NOT NULL DEFAULT '',
			main_chars  TEXT NOT NULL DEFAULT '[]',
			stats       TEXT NOT NULL DEFAULT '{}',
			rank        TEXT NOT NULL DEFAULT '',
			region      TEXT NOT NULL DEFAULT '',
			last_active TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		return nil, err
	}
	log.Println("database connected")
	return db, nil
}

func dbSave(db *sql.DB, p *RegisteredPlayer) error {
	mj, _ := json.Marshal(p.MainChars)
	sj, _ := json.Marshal(p.Stats)
	_, err := db.Exec(`
		INSERT INTO players (id, username, uid, main_chars, stats, rank, region, last_active)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		ON CONFLICT (id) DO UPDATE SET
			main_chars  = EXCLUDED.main_chars,
			stats       = EXCLUDED.stats,
			rank        = EXCLUDED.rank,
			region      = EXCLUDED.region,
			last_active = EXCLUDED.last_active
	`, p.ID, p.Username, p.UID, string(mj), string(sj), p.Rank, p.Region, p.LastActive)
	return err
}

func dbLoad(db *sql.DB) ([]*RegisteredPlayer, error) {
	rows, err := db.Query(
		`SELECT id, username, uid, main_chars, stats, rank, region, last_active
		 FROM players ORDER BY last_active DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*RegisteredPlayer
	for rows.Next() {
		var p RegisteredPlayer
		var mj, sj string
		var la time.Time
		if err := rows.Scan(&p.ID, &p.Username, &p.UID, &mj, &sj, &p.Rank, &p.Region, &la); err != nil {
			log.Printf("db scan: %v", err)
			continue
		}
		p.LastActive = la
		json.Unmarshal([]byte(mj), &p.MainChars)
		json.Unmarshal([]byte(sj), &p.Stats)
		out = append(out, &p)
	}
	return out, rows.Err()
}
