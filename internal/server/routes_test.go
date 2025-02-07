package server

import (
	"bytes"
	"device-api/internal/model"
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

func setupTest(t *testing.T) {
	devices = make(map[uuid.UUID]model.Device)
	t.Cleanup(func() { devices = make(map[uuid.UUID]model.Device) })
}

func TestPingHandler(t *testing.T) {
	setupTest(t)

	handler := NewRequestHandler()

	req := httptest.NewRequest("GET", "/ping", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	expected := `{"message":"pong"}`
	responseBody := strings.TrimSpace(w.Body.String())

	assert.JSONEq(t, expected, responseBody)
}

func TestFetchDeviceHandler(t *testing.T) {
	setupTest(t)

	handler := NewRequestHandler()

	existingDevice := model.Device{
		ID:           uuid.New(),
		Name:         "Some Device",
		Brand:        "Some Brand",
		State:        string(model.AVAILABLE),
		CreationTime: time.Now(),
	}
	devices[existingDevice.ID] = existingDevice

	tests := []struct {
		name           string
		deviceID       string
		expectedStatus int
	}{
		{"User exists", existingDevice.ID.String(), http.StatusOK},
		{"User not found", uuid.New().String(), http.StatusNotFound},
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
	handler := NewRequestHandler()

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
		{"Invalid fields", `{"nmae": "Some Device", "brandy": "Some Brand"`, http.StatusBadRequest},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			setupTest(t)

			req := httptest.NewRequest("POST", "/devices", bytes.NewBufferString(tc.payload))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.ServeHTTP(w, req)

			assert.Equal(t, tc.expectedStatus, w.Code)
		})
	}
}

func TestDeleteDeviceHandler(t *testing.T) {
	setupTest(t)

	handler := NewRequestHandler()

	existingDevice := model.Device{ID: uuid.New(), Name: "Device", Brand: "Brand", State: string(model.AVAILABLE)}
	inUseDevice := model.Device{ID: uuid.New(), Name: "Someone's device", Brand: "Brand", State: string(model.IN_USE)}

	devices[existingDevice.ID] = existingDevice
	devices[inUseDevice.ID] = inUseDevice

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

			if tc.expectedStatus == http.StatusNoContent {
				_, exists := devices[existingDevice.ID]
				assert.False(t, exists)
			}
		})
	}
}

func TestFetchDevicesRoute(t *testing.T) {

	handler := NewRequestHandler()

	device1 := model.Device{ID: uuid.New(), Name: "Device1", Brand: "BrandA", State: string(model.AVAILABLE)}
	device2 := model.Device{ID: uuid.New(), Name: "Device2", Brand: "BrandB", State: string(model.IN_USE)}
	device3 := model.Device{ID: uuid.New(), Name: "Device3", Brand: "BrandA", State: string(model.IN_USE)}

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
			setupTest(t)

			devices[device1.ID] = device1
			devices[device2.ID] = device2
			devices[device3.ID] = device3

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

func TestPartiallyUpdateDeviceRoute(t *testing.T) {
	setupTest(t)
	handler := NewRequestHandler()

	baseDevice := model.Device{
		ID:           uuid.New(),
		Name:         "Some Device",
		Brand:        "Brandy Brand",
		State:        "AVAILABLE",
		CreationTime: time.Now(),
	}

	tests := []struct {
		name              string
		deviceID          string
		payload           string
		expectedStatus    int
		checkCreationTime bool
	}{
		{
			"Partially update device name",
			baseDevice.ID.String(),
			`{"name":"updated device name"}`,
			http.StatusOK,
			true,
		},
		{
			"Partially update device brand",
			baseDevice.ID.String(),
			`{"brand":"updated device brand"}`,
			http.StatusOK,
			true,
		},
		{
			"Partially update device state",
			baseDevice.ID.String(),
			`{"state":"in-use"}`,
			http.StatusOK,
			true,
		},
		{
			"Partially update everything",
			baseDevice.ID.String(),
			`{"name":"updated device name", "brand": "updated device brand", "state":"in-use"}`,
			http.StatusOK,
			true,
		},
		{
			"Cannot partially update device state to invalid value",
			baseDevice.ID.String(),
			`{"state":"INVALID_STATE"}`,
			http.StatusBadRequest,
			false,
		},
		{
			"Invalid device UUID",
			"invalid-uuid",
			`{"name":"NewDeviceName"}`,
			http.StatusBadRequest,
			false,
		},
		{
			"Non-existent device",
			uuid.NewString(),
			`{"name":"NewDeviceName"}`,
			http.StatusNotFound,
			false,
		},
		{
			"Do nothing with no attributes update",
			baseDevice.ID.String(),
			`{}`,
			http.StatusOK,
			false,
		},
		{
			"Invalid update payload JSON",
			baseDevice.ID.String(),
			`{"name":}`,
			http.StatusBadRequest,
			false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			setupTest(t)
			devices[baseDevice.ID] = baseDevice

			req := httptest.NewRequest("PATCH", fmt.Sprintf("/devices/%s", tc.deviceID), strings.NewReader(tc.payload))
			w := httptest.NewRecorder()

			handler.ServeHTTP(w, req)

			assert.Equal(t, tc.expectedStatus, w.Code)

			if tc.expectedStatus == http.StatusOK {
				var updatedDevice model.Device
				err := json.Unmarshal(w.Body.Bytes(), &updatedDevice)
				assert.NoError(t, err)

				assert.Equal(t, baseDevice.CreationTime.UTC(), updatedDevice.CreationTime.UTC())

				switch tc.payload {
				case `{"name":"updated device name"}`:
					assert.Equal(t, "updated device name", updatedDevice.Name)
				case `{"brand":"updated device brand"}`:
					assert.Equal(t, "updated device brand", updatedDevice.Brand)
				case `{"state":"in-use"}`:
					assert.Equal(t, "in-use", updatedDevice.State)
				case `{"name":"updated device name", "brand": "updated device brand", "state":"in-use"}`:
					assert.Equal(t, "updated device name", updatedDevice.Name)
					assert.Equal(t, "updated device brand", updatedDevice.Brand)
					assert.Equal(t, "in-use", updatedDevice.State)
				}

			}
		})
	}
}
