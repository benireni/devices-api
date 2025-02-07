package model

import (
	"time"

	"github.com/google/uuid"
)

type Device struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Brand     string    `json:"brand"`
	State     string    `json:"state"`
	CreatedAt time.Time `json:"created_at"`
}
