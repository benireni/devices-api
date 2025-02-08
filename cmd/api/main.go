package main

import (
	"fmt"
	"net/http"

	"device-api/internal/database"
	"device-api/internal/server"
)

func main() {
	deviceDatabase, databaseError := database.NewPostgresDB()
	if databaseError != nil {
		panic(fmt.Sprintf("Error connecting to database: %s", databaseError))
	}

	deviceAPIServer := server.NewServer(deviceDatabase)

	fmt.Println("Started Device API server on :8080")

	serverError := http.ListenAndServe(":8080", deviceAPIServer)
	if serverError != nil && serverError != http.ErrServerClosed {
		panic(fmt.Sprintf("http server error: %s", serverError))
	}
}
