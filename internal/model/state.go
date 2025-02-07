package model

type State string

const (
	AVAILABLE State = "available"
	IN_USE    State = "in-use"
	INACTIVE  State = "inactive"
)
