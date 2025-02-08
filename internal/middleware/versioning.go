package middleware

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
)

func VersioningMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		versionPrefix := fmt.Sprintf("/v%s", os.Getenv("API_VERSION"))
		log.Default().Println(versionPrefix)
		if !strings.HasPrefix(r.URL.Path, versionPrefix) {
			http.NotFound(w, r)
			return
		}
		r.URL.Path = strings.TrimPrefix(r.URL.Path, versionPrefix)
		next.ServeHTTP(w, r)
	})
}
