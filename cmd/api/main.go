package main

import (
	"fmt"
	"net/http"

	"device-api/internal/server"
)

func main() {
	server := server.NewServer()

	fmt.Printf("Starting Device API server on %s\n", server.Addr)

	err := server.ListenAndServe()
	if err != nil && err != http.ErrServerClosed {
		panic(fmt.Sprintf("http server error: %s", err))
	}
}
