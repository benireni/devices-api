package model

import "github.com/google/uuid"

type DeviceDAO interface {
	Health() map[string]string
	Close() error
	CreateDevice(device Device) (Device, error)
	GetDeviceByID(id uuid.UUID) (*Device, error)
	UpdateDevice(updatedDevice Device) (*Device, error)
	DeleteDevice(id uuid.UUID) error
	ListDevices(state, brand string) ([]*Device, error)
}
