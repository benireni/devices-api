package service

import (
	"device-api/internal/model"
	"fmt"
	"strings"
)

func IsValidState(s string) bool {
	switch strings.ToLower(s) {
	case string(model.AVAILABLE), string(model.IN_USE), string(model.INACTIVE):
		return true
	default:
		return false
	}
}

func ValidateNewDevice(device model.Device) error {
	if device.Name == "" || device.Brand == "" {
		return fmt.Errorf("Name and brand are required")
	}

	return nil
}

func ValidateDeviceUpdate(deviceUpdate model.Device, device model.Device) error {
	updatingName := deviceUpdate.Name != "" && deviceUpdate.Name != device.Name
	updatingBrand := deviceUpdate.Brand != "" && deviceUpdate.Brand != device.Brand

	if device.State == string(model.IN_USE) {
		if updatingName || updatingBrand {
			return fmt.Errorf("Cannot update name or brand of a device currently in use")
		}
	}

	if deviceUpdate.State != "" && !IsValidState(deviceUpdate.State) {
		return fmt.Errorf("Invalid device state")
	}

	return nil
}
