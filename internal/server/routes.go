package server

import (
	"device-api/internal/database"
	"device-api/internal/middleware"
	"device-api/internal/model"
	"device-api/internal/service"
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
)

var devicesDB = database.New()

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
	device.CreatedAt = time.Now()

	validationError := service.ValidateNewDevice(device)
	if validationError != nil {
		http.Error(w, validationError.Error(), http.StatusBadRequest)
	}

	createdDevice, err := devicesDB.CreateDevice(device)
	if err != nil {
		http.Error(w, "Failed to create device", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(createdDevice)
}

func fetchDevice(w http.ResponseWriter, r *http.Request) {
	rawDeviceID := r.PathValue("id")
	deviceID, err := uuid.Parse(rawDeviceID)
	if err != nil {
		http.Error(w, "Invalid device ID", http.StatusBadRequest)
		return
	}

	device, err := devicesDB.GetDeviceByID(deviceID)
	if err != nil {
		http.Error(w, "Device not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(device)
}

func fetchDevices(w http.ResponseWriter, r *http.Request) {
	filters := r.URL.Query()

	targetBrand := filters.Get("brand")
	targetState := filters.Get("state")

	if targetState != "" && !service.IsValidState(targetState) {
		http.Error(w, "Invalid device state", http.StatusBadRequest)
		return
	}

	targetDevices, err := devicesDB.ListDevices(targetState, targetBrand)
	if err != nil {
		http.Error(w, "Failed to fetch devices", http.StatusInternalServerError)
		return
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

	var updatedDevice model.Device
	err = json.NewDecoder(r.Body).Decode(&updatedDevice)
	if err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	device, err := devicesDB.GetDeviceByID(deviceID)
	if err != nil {
		http.Error(w, "Device not found", http.StatusNotFound)
		return
	}

	validationError := service.ValidateDeviceUpdate(updatedDevice, *device)
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

	if updatedDevice.State != "" {
		device.State = updatedDevice.State
	}

	updatedPayload, err := devicesDB.UpdateDevice(*device)
	if err != nil {
		http.Error(w, "Failed to update device", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(updatedPayload)
}

func deleteDevice(w http.ResponseWriter, r *http.Request) {
	rawDeviceID := r.PathValue("id")
	deviceID, err := uuid.Parse(rawDeviceID)
	if err != nil {
		http.Error(w, "Invalid device ID", http.StatusBadRequest)
		return
	}

	device, err := devicesDB.GetDeviceByID(deviceID)
	if err != nil {
		http.Error(w, "Device not found", http.StatusNotFound)
		return
	}

	if device.State == string(model.IN_USE) {
		http.Error(w, "Cannot delete a device currently in use", http.StatusBadRequest)
		return
	}

	err = devicesDB.DeleteDevice(deviceID)
	if err != nil {
		http.Error(w, "Failed to delete device", http.StatusInternalServerError)
		return
	}

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
