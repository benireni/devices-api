all: build test

build:
	@echo "Building application..."
	@go build -o main cmd/api/main.go

run:
	@go run cmd/api/main.go

docker-run:
	docker-compose up --build

test:
	@echo "Running application tests..."
	@go test ./... -v

itest:
	@echo "Running DB integration tests..."
	@go test ./internal/database -v

clean:
	@echo "Running binaries cleanup..."
	@rm -f main
