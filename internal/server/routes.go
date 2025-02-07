package server

import (
	"device-api/internal/middleware"
	"device-api/internal/model"
	"device-api/internal/service"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
)

// Temporary in-memory storage (later will be replaced with a pg integration)
var devices = make(map[uuid.UUID]model.Device)

func ping(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	response := map[string]string{"message": "pong"}
	json.NewEncoder(w).Encode(response)
}

func createDevice(w http.ResponseWriter, r *http.Request) {
	var device model.Device
	err := json.NewDecoder(r.Body).Decode(&device)
	if err != nil {
		http.Error(w, "Invalid device payload", http.StatusBadRequest)
		return
	}

	device.ID = uuid.New()
	device.State = string(model.AVAILABLE)
	device.CreationTime = time.Now()

	validationError := service.ValidateNewDevice(device)
	if validationError != nil {
		http.Error(w, validationError.Error(), http.StatusBadRequest)
	}

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
	filterByState := service.IsValidState(targetState)

	// DB can do it by itself
	var targetDevices []model.Device
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

func partiallyUpdateDevice(w http.ResponseWriter, r *http.Request) {
	rawDeviceID := r.PathValue("id")
	deviceID, err := uuid.Parse(rawDeviceID)
	if err != nil {
		http.Error(w, "Invalid device ID", http.StatusBadRequest)
		return
	}

	var updatedDevice model.Device
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

	validationError := service.ValidateDeviceUpdate(updatedDevice, device)
	if validationError != nil {
		http.Error(w, validationError.Error(), http.StatusBadRequest)
		return
	}

	if updatedDevice.Name != "" {
		device.Name = updatedDevice.Name
	}

	if updatedDevice.Brand != "" {
		device.Brand = updatedDevice.Brand
	}

	device.State = updatedDevice.State

	devices[deviceID] = device

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(device)
}

func updateDevice(w http.ResponseWriter, r *http.Request) {
	rawDeviceID := r.PathValue("id")
	deviceID, err := uuid.Parse(rawDeviceID)
	if err != nil {
		http.Error(w, "Invalid device ID", http.StatusBadRequest)
		return
	}

	var updatedDevice model.Device
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

	validationError := service.ValidateDeviceUpdate(updatedDevice, device)
	if validationError != nil {
		http.Error(w, validationError.Error(), http.StatusBadRequest)
		return
	}

	updatedDevice.ID = device.ID
	updatedDevice.CreationTime = device.CreationTime

	devices[deviceID] = updatedDevice

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(updatedDevice)
}

func deleteDevice(w http.ResponseWriter, r *http.Request) {
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

	if device.State == string(model.IN_USE) {
		http.Error(w, "Cannot delete a device currently in use", http.StatusBadRequest)
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

	serverConfig.HandleFunc("PATCH /devices/{id}", partiallyUpdateDevice)
	serverConfig.HandleFunc("PUT /devices/{id}", updateDevice)

	serverConfig.HandleFunc("DELETE /devices/{id}", deleteDevice)

	middlewareStack := middleware.StackMiddlewares(
		middleware.LoggingMiddleware,
		middleware.RecoveryMiddleware,
		middleware.VersioningMiddleware,
	)

	wrappedHandler := middlewareStack(serverConfig)
	return wrappedHandler
}
