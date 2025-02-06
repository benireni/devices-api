package server

import (
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	_ "github.com/joho/godotenv/autoload"
)

func NewServer() *http.Server {
	portNumber, _ := strconv.Atoi(os.Getenv("PORT"))
	portAddress := fmt.Sprintf(":%d", portNumber)

	server := &http.Server{
		Addr:         portAddress,
		Handler:      NewRequestHandler(),
		IdleTimeout:  time.Minute,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	return server
}
