package server

import (
	"device-api/internal/model"
	"net/http"
)

type Server struct {
	Database model.DeviceDAO
	Mux      *http.ServeMux
}

func NewServer(db model.DeviceDAO) *Server {
	server := &Server{
		Database: db,
		Mux:      http.NewServeMux(),
	}

	server.routes()
	return server
}

func (server *Server) routes() {

	server.Mux.HandleFunc("GET /ping", server.handlePing)

	server.Mux.HandleFunc("POST /devices", server.createDevice)

	server.Mux.HandleFunc("GET /devices/{id}", server.fetchDevice)
	server.Mux.HandleFunc("GET /devices", server.fetchDevices)

	server.Mux.HandleFunc("PATCH /devices/{id}", server.updateDevice)

	server.Mux.HandleFunc("DELETE /devices/{id}", server.deleteDevice)
}

func (server *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	server.Mux.ServeHTTP(w, r)
}
