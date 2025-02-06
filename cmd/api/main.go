package main

import (
	"fmt"
	"net/http"

	"device-api/internal/server"
)

func main() {
	server := server.NewServer()

	err := server.ListenAndServe()
	if err != nil && err != http.ErrServerClosed {
		panic(fmt.Sprintf("http server error: %s", err))
	}
}

// Start the server
// port := ":8080"
// log.Printf("Starting server on %s", port)
// err := http.ListenAndServe(port, finalHandler)
// if err != nil {
// 	log.Fatalf("Error starting server: %v", err)
// }
