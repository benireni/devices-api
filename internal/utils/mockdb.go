package utils

import (
	"device-api/internal/model"
	"fmt"
	"sync"

	"github.com/google/uuid"
)

type mockDB struct {
	devices map[uuid.UUID]model.Device
	mu      sync.RWMutex
}

func NewMockDB() model.DeviceDAO {
	return &mockDB{
		devices: make(map[uuid.UUID]model.Device),
	}
}

func (m *mockDB) Health() map[string]string {
	return map[string]string{
		"status":  "up",
		"message": "Mock DB is healthy",
	}
}

func (m *mockDB) Close() error {
	return nil
}

func (m *mockDB) CreateDevice(device model.Device) (model.Device, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.devices[device.ID]; exists {
		return model.Device{}, fmt.Errorf("device already exists")
	}

	m.devices[device.ID] = device
	return device, nil
}

func (m *mockDB) GetDeviceByID(id uuid.UUID) (*model.Device, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if device, exists := m.devices[id]; exists {
		return &device, nil
	}

	return nil, fmt.Errorf("device not found")
}

func (m *mockDB) UpdateDevice(device model.Device) (*model.Device, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.devices[device.ID]; !exists {
		return nil, fmt.Errorf("device not found")
	}

	m.devices[device.ID] = device
	return &device, nil
}

func (m *mockDB) DeleteDevice(id uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if device, exists := m.devices[id]; exists {
		if device.State == string(model.IN_USE) {
			return fmt.Errorf("cannot delete device in use")
		}
		delete(m.devices, id)
		return nil
	}

	return fmt.Errorf("device not found")
}

func (m *mockDB) ListDevices(state, brand string) ([]*model.Device, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var result []*model.Device
	for _, device := range m.devices {
		if state != "" && device.State != state {
			continue
		}
		if brand != "" && device.Brand != brand {
			continue
		}

		d := device
		result = append(result, &d)
	}

	return result, nil
}
