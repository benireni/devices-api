package server

import (
	"device-api/internal/model"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

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
