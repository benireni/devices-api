package server_test

import (
	"bytes"
	"device-api/internal/model"
	"device-api/internal/server"
	"device-api/internal/utils"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func setupTest() model.DeviceDAO {
	return utils.NewMockDB()
}

func TestPingHandler(t *testing.T) {
	mockDB := setupTest()
	handler := server.NewServer(mockDB)
	req := httptest.NewRequest("GET", "/ping", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	expected := `{"message":"pong"}`
	responseBody := strings.TrimSpace(w.Body.String())
	assert.JSONEq(t, expected, responseBody)
}

func TestFetchDeviceHandler(t *testing.T) {
	mockDB := setupTest()
	handler := server.NewServer(mockDB)
	existingDevice := model.Device{
		ID:        uuid.New(),
		Name:      "Some Device",
		Brand:     "Some Brand",
		State:     string(model.AVAILABLE),
		CreatedAt: time.Now(),
	}
	_, err := mockDB.CreateDevice(existingDevice)
	assert.NoError(t, err)

	tests := []struct {
		name           string
		deviceID       string
		expectedStatus int
	}{
		{"Device exists", existingDevice.ID.String(), http.StatusOK},
		{"Device not found", uuid.New().String(), http.StatusNotFound},
		{"Invalid UUID", "invalid-uuid", http.StatusBadRequest},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/devices/"+tc.deviceID, nil)
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)
			assert.Equal(t, tc.expectedStatus, w.Code)
			if tc.expectedStatus == http.StatusOK {
				var fetchedDevice model.Device
				err := json.Unmarshal(w.Body.Bytes(), &fetchedDevice)
				assert.NoError(t, err)
				assert.Equal(t, existingDevice.ID, fetchedDevice.ID)
				assert.Equal(t, existingDevice.Name, fetchedDevice.Name)
			}
		})
	}
}

func TestCreateDeviceHandler(t *testing.T) {
	tests := []struct {
		name           string
		payload        string
		expectedStatus int
	}{
		{"Valid device creation", `{"name": "Some Device", "brand": "Some Brand"}`, http.StatusCreated},
		{"Missing name", `{"brand": "Some Brand"}`, http.StatusBadRequest},
		{"Missing brand", `{"name": "Some Device"}`, http.StatusBadRequest},
		{"Missing both name and brand", `{}`, http.StatusBadRequest},
		{"Invalid JSON", `{"name": "Some Device", "brand": "Some Brand"`, http.StatusBadRequest},
		{"Invalid fields", `{"nmae": "Some Device", "brandy": "Some Brand"}`, http.StatusBadRequest},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			mockDB := setupTest()
			handler := server.NewServer(mockDB)
			req := httptest.NewRequest("POST", "/devices", bytes.NewBufferString(tc.payload))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)
			assert.Equal(t, tc.expectedStatus, w.Code)
		})
	}
}

func TestDeleteDeviceHandler(t *testing.T) {
	mockDB := setupTest()
	handler := server.NewServer(mockDB)
	existingDevice := model.Device{
		ID:    uuid.New(),
		Name:  "Device",
		Brand: "Brand",
		State: string(model.AVAILABLE),
	}
	inUseDevice := model.Device{
		ID:    uuid.New(),
		Name:  "Someone's device",
		Brand: "Brand",
		State: string(model.IN_USE),
	}
	_, err := mockDB.CreateDevice(existingDevice)
	assert.NoError(t, err)
	_, err = mockDB.CreateDevice(inUseDevice)
	assert.NoError(t, err)

	tests := []struct {
		name           string
		deviceID       string
		expectedStatus int
	}{
		{"Device exists", existingDevice.ID.String(), http.StatusNoContent},
		{"Cannot delete in-use devices", inUseDevice.ID.String(), http.StatusBadRequest},
		{"Device not found", uuid.New().String(), http.StatusNotFound},
		{"Invalid UUID", "invalid-uuid", http.StatusBadRequest},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("DELETE", "/devices/"+tc.deviceID, nil)
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)
			assert.Equal(t, tc.expectedStatus, w.Code)
		})
	}
}

func TestFetchDevicesHandler(t *testing.T) {
	tests := []struct {
		name           string
		queryParams    string
		expectedStatus int
		expectedCount  int
	}{
		{"Get all devices", "", http.StatusOK, 3},
		{"Filter by brand", "?brand=BrandA", http.StatusOK, 2},
		{"Filter by state", "?state=in-use", http.StatusOK, 2},
		{"Filter by both brand & state", "?brand=BrandA&state=in-use", http.StatusOK, 1},
		{"Invalid state filter", "?state=INVALID_STATE", http.StatusBadRequest, 0},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			mockDB := setupTest()
			handler := server.NewServer(mockDB)
			device1 := model.Device{
				ID:        uuid.New(),
				Name:      "Device1",
				Brand:     "BrandA",
				State:     string(model.AVAILABLE),
				CreatedAt: time.Now(),
			}
			device2 := model.Device{
				ID:        uuid.New(),
				Name:      "Device2",
				Brand:     "BrandB",
				State:     string(model.IN_USE),
				CreatedAt: time.Now(),
			}
			device3 := model.Device{
				ID:        uuid.New(),
				Name:      "Device3",
				Brand:     "BrandA",
				State:     string(model.IN_USE),
				CreatedAt: time.Now(),
			}
			_, _ = mockDB.CreateDevice(device1)
			_, _ = mockDB.CreateDevice(device2)
			_, _ = mockDB.CreateDevice(device3)

			req := httptest.NewRequest("GET", "/devices"+tc.queryParams, nil)
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)
			assert.Equal(t, tc.expectedStatus, w.Code)
			if tc.expectedStatus == http.StatusOK {
				var fetchedDevices []model.Device
				err := json.Unmarshal(w.Body.Bytes(), &fetchedDevices)
				assert.NoError(t, err, "Error parsing response JSON")
				assert.Equal(t, tc.expectedCount, len(fetchedDevices))
			} else {
				responseBody := strings.TrimSpace(w.Body.String())
				assert.NotEmpty(t, responseBody, "Expected error message")
			}
		})
	}
}

func TestUpdateDeviceRoute(t *testing.T) {
	tests := []struct {
		name           string
		deviceID       string
		payload        string
		expectedStatus int
		expectedName   string
		expectedBrand  string
		expectedState  string
		checkCreatedAt bool
	}{
		{
			"Partially update device name", "", `{"name":"updated device name"}`,
			http.StatusOK, "updated device name", "Brandy Brand", "AVAILABLE", true,
		},
		{
			"Partially update device brand", "", `{"brand":"updated device brand"}`,
			http.StatusOK, "Some Device", "updated device brand", "AVAILABLE", true,
		},
		{
			"Partially update device state", "", `{"state":"in-use"}`,
			http.StatusOK, "Some Device", "Brandy Brand", "in-use", true,
		},
		{
			"Fully update device (PUT-alike)", "", `{"name":"updated device name", "brand": "updated device brand", "state":"in-use"}`,
			http.StatusOK, "updated device name", "updated device brand", "in-use", true,
		},
		{
			"Cannot partially update device state to invalid value", "", `{"state":"INVALID_STATE"}`,
			http.StatusBadRequest, "Some Device", "Brandy Brand", "AVAILABLE", false,
		},
		{
			"Invalid device UUID", "invalid-uuid", `{"name":"NewDeviceName"}`,
			http.StatusBadRequest, "", "", "", false,
		},
		{
			"Non-existent device", "", `{"name":"NewDeviceName"}`,
			http.StatusNotFound, "", "", "", false,
		},
		{
			"Do nothing with no attributes update", "", `{}`,
			http.StatusOK, "Some Device", "Brandy Brand", "AVAILABLE", false,
		},
		{
			"Invalid update payload JSON", "", `{"name":}`,
			http.StatusBadRequest, "", "", "", false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			mockDB := setupTest()
			handler := server.NewServer(mockDB)

			baseDevice := model.Device{
				ID:        uuid.New(),
				Name:      "Some Device",
				Brand:     "Brandy Brand",
				State:     "AVAILABLE",
				CreatedAt: time.Now(),
			}
			deviceID := baseDevice.ID.String()
			if tc.deviceID != "" {
				deviceID = tc.deviceID
			}
			_, _ = mockDB.CreateDevice(baseDevice)

			if tc.name == "Non-existent device" {
				deviceID = uuid.New().String()
			}
			url := fmt.Sprintf("/devices/%s", deviceID)
			req := httptest.NewRequest("PATCH", url, strings.NewReader(tc.payload))
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)
			assert.Equal(t, tc.expectedStatus, w.Code)
			if tc.expectedStatus == http.StatusOK {
				var updatedDevice model.Device
				err := json.Unmarshal(w.Body.Bytes(), &updatedDevice)
				assert.NoError(t, err)

				assert.Equal(t, baseDevice.CreatedAt.UTC().Format(time.RFC3339), updatedDevice.CreatedAt.UTC().Format(time.RFC3339))
				assert.Equal(t, tc.expectedName, updatedDevice.Name)
				assert.Equal(t, tc.expectedBrand, updatedDevice.Brand)
				assert.Equal(t, tc.expectedState, updatedDevice.State)
			}
		})
	}
}
