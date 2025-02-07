package server

import (
	"device-api/internal/model"
	"encoding/json"
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
