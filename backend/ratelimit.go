package main

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// RateLimiter tracks per-IP request counts in fixed time windows.
// No external dependencies — pure standard library.
type RateLimiter struct {
	mu      sync.Mutex
	windows map[string]*ipWindow
}

type ipWindow struct {
	count   int
	resetAt time.Time
}

func NewRateLimiter() *RateLimiter {
	rl := &RateLimiter{windows: make(map[string]*ipWindow)}
	// Periodically evict expired windows to prevent unbounded memory growth.
	go func() {
		for range time.Tick(5 * time.Minute) {
			rl.evict()
		}
	}()
	return rl
}

// allow checks whether the given key (ip or ip+endpoint bucket) is within its limit.
func (rl *RateLimiter) allow(key string, limit int, window time.Duration) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	w, ok := rl.windows[key]
	if !ok || now.After(w.resetAt) {
		rl.windows[key] = &ipWindow{count: 1, resetAt: now.Add(window)}
		return true
	}
	if w.count >= limit {
		return false
	}
	w.count++
	return true
}

func (rl *RateLimiter) evict() {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	for ip, w := range rl.windows {
		if now.After(w.resetAt) {
			delete(rl.windows, ip)
		}
	}
}

// realIP extracts the client IP, respecting Railway's X-Forwarded-For header.
func realIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// X-Forwarded-For can be a comma-separated list; take the first (client) IP.
		return strings.TrimSpace(strings.SplitN(xff, ",", 2)[0])
	}
	if xri := r.Header.Get("X-Real-Ip"); xri != "" {
		return xri
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// rateLimitMiddleware applies per-IP rate limits.
// /api/register is stricter (protects MarvelRivalsAPI quota).
// Everything else gets a generous general limit.
func rateLimitMiddleware(rl *RateLimiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}
			ip := realIP(r)
			// Each endpoint bucket is tracked separately so /api/register's
			// strict limit doesn't consume quota from general endpoints.
			key, limit, window := ip, 60, time.Minute
			if r.URL.Path == "/api/register" {
				key, limit = ip+"|reg", 10 // 10 registrations/min per IP
			}
			if !rl.allow(key, limit, window) {
				writeError(w, "rate limit exceeded — slow down", http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
