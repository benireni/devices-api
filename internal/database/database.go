package database

import (
	"context"
	"database/sql"
	"device-api/internal/model"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"
	_ "github.com/joho/godotenv/autoload"
)

type Service interface {
	Health() map[string]string
	Close() error
	CreateDevice(device model.Device) (model.Device, error)
	GetDeviceByID(id uuid.UUID) (*model.Device, error)
	UpdateDevice(updatedDevice model.Device) (*model.Device, error)
	DeleteDevice(id uuid.UUID) error
	ListDevices(state, brand string) ([]*model.Device, error)
}

type postgresDB struct {
	database *sql.DB
}

var (
	database = os.Getenv("DB_DATABASE")
	password = os.Getenv("DB_PASSWORD")
	username = os.Getenv("DB_USERNAME")
	port     = os.Getenv("DB_PORT")
	host     = os.Getenv("DB_HOST")
	schema   = os.Getenv("DB_SCHEMA")
)

func NewPostgresDB() (Service, error) {
	connStr := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable&search_path=%s",
		username, password, host, port, database, schema)

	database, err := sql.Open("pgx", connStr)
	if err != nil {
		return nil, err
	}

	postgresDatabase := &postgresDB{database: database}
	postgresDatabase.initializeSchema()

	log.Printf("Connected to database: %s", os.Getenv("DB_DATABASE"))

	return postgresDatabase, nil
}

func (p *postgresDB) Health() map[string]string {
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	stats := make(map[string]string)
	if err := p.database.PingContext(ctx); err != nil {
		stats["status"] = "DOWN"
		stats["error"] = fmt.Sprintf("db down: %v", err)
		log.Fatalf("db down: %v", err)
		return stats
	}

	stats["status"] = "UP"
	stats["message"] = "healthy DB"

	return stats
}

func (p *postgresDB) Close() error {
	log.Printf("Disconnected from database: %s", os.Getenv("DB_DATABASE"))
	return p.database.Close()
}

func (p *postgresDB) initializeSchema() {
	query := `CREATE TABLE IF NOT EXISTS devices (
		id UUID PRIMARY KEY,
		name TEXT NOT NULL,
		brand TEXT NOT NULL,
		state TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT NOW()
	);`

	if _, err := p.database.Exec(query); err != nil {
		log.Fatalf("Error initializing schema: %v", err)
	}
}

func (p *postgresDB) CreateDevice(device model.Device) (model.Device, error) {

	_, err := p.database.Exec(
		"INSERT INTO devices (id, name, brand, state, created_at) VALUES ($1, $2, $3, $4, $5)",
		device.ID, device.Name, device.Brand, device.State, device.CreatedAt)
	if err != nil {
		return model.Device{}, fmt.Errorf("POSTGRES: failure inserting device: %w", err)
	}

	return device, nil
}

func (p *postgresDB) GetDeviceByID(id uuid.UUID) (*model.Device, error) {
	query := "SELECT id, name, brand, state, created_at FROM devices WHERE id = $1"
	device := &model.Device{}

	if err := p.database.QueryRow(
		query, id,
	).Scan(
		&device.ID,
		&device.Name,
		&device.Brand,
		&device.State,
		&device.CreatedAt,
	); err != nil {
		return nil, fmt.Errorf("device not found: %v", err)
	}

	return device, nil
}

func (p *postgresDB) UpdateDevice(device model.Device) (*model.Device, error) {
	query := "UPDATE devices SET name = $1, brand = $2, state = $3 WHERE id = $4 RETURNING id, name, brand, state, created_at"
	updatedDevice := &model.Device{}

	if err := p.database.QueryRow(query,
		device.Name,
		device.Brand,
		device.State,
		device.ID,
	).Scan(
		&updatedDevice.ID,
		&updatedDevice.Name,
		&updatedDevice.Brand,
		&updatedDevice.State,
		&updatedDevice.CreatedAt,
	); err != nil {
		return nil, fmt.Errorf("failed to update device: %v", err)
	}

	return updatedDevice, nil
}

func (p *postgresDB) DeleteDevice(id uuid.UUID) error {
	query := "DELETE FROM devices WHERE id = $1"
	if _, err := p.database.Exec(query, id); err != nil {
		return fmt.Errorf("failed to delete device: %v", err)
	}

	return nil
}

func (p *postgresDB) ListDevices(state, brand string) ([]*model.Device, error) {
	query := "SELECT id, name, brand, state, created_at FROM devices WHERE 1=1"
	var args []interface{}
	argCount := 1

	if state != "" {
		query += fmt.Sprintf(" AND state = $%d", argCount)
		args = append(args, state)
		argCount++
	}

	if brand != "" {
		query += fmt.Sprintf(" AND brand = $%d", argCount)
		args = append(args, brand)
		argCount++
	}

	rows, err := p.database.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list devices: %v", err)
	}
	defer rows.Close()

	var devices []*model.Device
	for rows.Next() {
		device := &model.Device{}
		if err := rows.Scan(
			&device.ID,
			&device.Name,
			&device.Brand,
			&device.State,
			&device.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan device: %v", err)
		}

		devices = append(devices, device)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate devices: %v", err)
	}

	return devices, nil
}
