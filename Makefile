all: build test

build:
	@echo "Building application..."
	@go build -o main cmd/api/main.go

run:
	docker-compose up --build

test:
	@echo "Running application tests..."
	@go test ./... -v

clean:
	@echo "Running binaries cleanup..."
	@rm -f main
