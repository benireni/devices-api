# Device API

explain core concepts here

## Getting Started

just ask for docker/postman downloading
talk about golang versioning (using alpine 1.23 go)

## Running the Project

Run build and tests
```bash
make all
```

Just build the application
```bash
make build
```

Run the application locally
```bash
make run
```
Create and run containers (DB and API)
```bash
make docker-run
```

Shutdown all containers
```bash
make docker-down
```

Run DB integrations tests:
```bash
make itest
```

Run unit tests:
```bash
make test
```

Clean up binary:
```bash
make clean
```


# Notes

- I'm uploading the env file to the git repository to make the project run easier. I believe a good approach would be to access this data through a third-party such as AWS Parameter Store - secure, easy implementation and maintenance (but with an extra network hit in the system's bootstrap).
- The docker image I used for Golang is **golang:1.23-alpine**, as requested in the document.
- One can check the server's helath through /ping