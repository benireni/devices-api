package server

import (
	"device-api/internal/middleware"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

type State string

const (
	AVAILABLE State = "available"
	IN_USE    State = "in-use"
	INACTIVE  State = "inactive"
)

type Device struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	Brand        string    `json:"brand"`
	State        string    `json:"state"`
	CreationTime time.Time `json:"creation_time"`
}

func isValidState(s string) bool {
	switch strings.ToLower(s) {
	case string(AVAILABLE), string(IN_USE), string(INACTIVE):
		return true
	default:
		return false
	}
}

// Temporary in-memory storage (later will be replaced with a pg integration)
var devices = make(map[uuid.UUID]Device)

func ping(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	response := map[string]string{"message": "pong"}
	json.NewEncoder(w).Encode(response)
}

func createDevice(w http.ResponseWriter, r *http.Request) {
	var device Device
	err := json.NewDecoder(r.Body).Decode(&device)
	if err != nil {
		http.Error(w, "Invalid device payload", http.StatusBadRequest)
		return
	}

	device.ID = uuid.New()
	device.State = string(AVAILABLE)
	device.CreationTime = time.Now()

	// Save to DB - if it fails, drop a 5XX
	devices[device.ID] = device
	fmt.Printf("%+v\n", devices)

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(device)
}

func fetchDevice(w http.ResponseWriter, r *http.Request) {
	rawDeviceID := r.PathValue("id")
	deviceID, err := uuid.Parse(rawDeviceID)
	if err != nil {
		http.Error(w, "Invalid device ID", http.StatusBadRequest)
		return
	}

	device, exists := devices[deviceID]
	if !exists {
		http.Error(w, "Device not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(device)
}

func fetchDevices(w http.ResponseWriter, r *http.Request) {
	filters := r.URL.Query()

	targetBrand := filters.Get("brand")
	filterByBrand := targetBrand != ""

	targetState := filters.Get("state")
	filterByState := isValidState(targetState)

	var targetDevices []Device
	for _, device := range devices {
		if (filterByBrand && device.Brand != targetBrand) ||
			(filterByState && device.State != targetState) {
			continue
		}

		targetDevices = append(targetDevices, device)
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(targetDevices)
}

func updateDevice(w http.ResponseWriter, r *http.Request) {
	rawDeviceID := r.PathValue("id")
	deviceID, err := uuid.Parse(rawDeviceID)
	if err != nil {
		http.Error(w, "Invalid device ID", http.StatusBadRequest)
		return
	}

	var updatedDevice Device
	err = json.NewDecoder(r.Body).Decode(&updatedDevice)
	if err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	device, exists := devices[deviceID]
	if !exists {
		http.Error(w, "Device not found", http.StatusNotFound)
		return
	}

	if device.State != string(IN_USE) {
		if updatedDevice.Name != "" {
			device.Name = updatedDevice.Name
		}
		if updatedDevice.Brand != "" {
			device.Brand = updatedDevice.Brand
		}
	}

	if isValidState(updatedDevice.State) {
		device.State = updatedDevice.State
	}

	devices[deviceID] = device

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(device)
}

func deleteDevice(w http.ResponseWriter, r *http.Request) {
	rawDeviceID := r.PathValue("id")
	deviceID, err := uuid.Parse(rawDeviceID)
	if err != nil {
		http.Error(w, "Invalid device ID", http.StatusBadRequest)
		return
	}

	_, exists := devices[deviceID]
	if !exists {
		http.Error(w, "Device not found", http.StatusNotFound)
		return
	}

	delete(devices, deviceID)

	w.WriteHeader(http.StatusNoContent)
}

func NewRequestHandler() http.Handler {
	serverConfig := http.NewServeMux()

	serverConfig.HandleFunc("GET /ping", ping)

	serverConfig.HandleFunc("POST /devices", createDevice)

	serverConfig.HandleFunc("GET /devices/{id}", fetchDevice)
	serverConfig.HandleFunc("GET /devices", fetchDevices)

	serverConfig.HandleFunc("PATCH /devices/{id}", updateDevice)

	serverConfig.HandleFunc("DELETE /devices/{id}", deleteDevice)

	middlewareStack := middleware.StackMiddlewares(
		middleware.LoggingMiddleware,
		middleware.RecoveryMiddleware,
	)

	wrappedHandler := middlewareStack(serverConfig)
	return wrappedHandler
}
