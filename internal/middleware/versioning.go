package middleware

import (
	"net/http"
	"os"
	"strings"
)

func VersioningMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		versionPrefix := os.Getenv("API_VERSION")
		if !strings.HasPrefix(r.URL.Path, versionPrefix) {
			http.NotFound(w, r)
			return
		}
		r.URL.Path = strings.TrimPrefix(r.URL.Path, versionPrefix)
		next.ServeHTTP(w, r)
	})
}
