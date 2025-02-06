package server

import (
	"device-api/internal/middleware"
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
)

type Device struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	Brand        string    `json:"brand"`
	State        string    `json:"state"`
	CreationTime time.Time `json:"creation_time"`
}

var devices = make(map[uuid.UUID]Device)

func pingHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	response := map[string]string{"message": "pong"}
	json.NewEncoder(w).Encode(response)
}

func NewRequestHandler() http.Handler {
	serverConfig := http.NewServeMux()

	serverConfig.HandleFunc("GET /ping", pingHandler)

	middlewareStack := middleware.StackMiddlewares(
		middleware.LoggingMiddleware,
		middleware.RecoveryMiddleware,
	)

	wrappedHandler := middlewareStack(serverConfig)
	return wrappedHandler
}
