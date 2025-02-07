package service_test

import (
	"device-api/internal/model"
	"device-api/internal/service"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsValidState(t *testing.T) {
	tests := []struct {
		state    string
		expected bool
	}{
		{string(model.AVAILABLE), true},
		{string(model.IN_USE), true},
		{string(model.INACTIVE), true},
		{"unknown", false},
		{"", false},
	}

	for _, tt := range tests {
		assert.Equal(t, tt.expected, service.IsValidState(tt.state), "State validation failed for: %s", tt.state)
	}
}

func TestValidateNewDevice(t *testing.T) {
	tests := []struct {
		device       model.Device
		expectsError bool
	}{
		{model.Device{Name: "Phone", Brand: "BrandX"}, false},
		{model.Device{Name: "", Brand: "BrandX"}, true},
		{model.Device{Name: "Phone", Brand: ""}, true},
		{model.Device{Name: "", Brand: ""}, true},
	}

	for _, tt := range tests {
		err := service.ValidateNewDevice(tt.device)
		if tt.expectsError {
			assert.Error(t, err, "Expected error but got none")
		} else {
			assert.NoError(t, err, "Unexpected error: %v", err)
		}
	}
}

func TestValidateDeviceUpdate(t *testing.T) {
	original := model.Device{
		Name:  "OldPhone",
		Brand: "BrandX",
		State: string(model.IN_USE),
	}

	tests := []struct {
		deviceUpdate model.Device
		expectsError bool
	}{
		{model.Device{Name: "NewPhone"}, true},
		{model.Device{Brand: "BrandY"}, true},
		{model.Device{State: "INVALID"}, true},
		{model.Device{State: string(model.AVAILABLE)}, false},
		{model.Device{}, false},
	}

	for _, tt := range tests {
		err := service.ValidateDeviceUpdate(tt.deviceUpdate, original)
		if tt.expectsError {
			assert.Error(t, err, "Expected error but got none")
		} else {
			assert.NoError(t, err, "Unexpected error: %v", err)
		}
	}
}
