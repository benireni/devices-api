# Device API Documentation

Welcome to the Device API documentation. This will shortly guide you on building, testing, running and understanding the project.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Building the Project](#building-the-project)
3. [Running the Project](#running-the-project)
4. [Testing the Project](#testing-the-project)
5. [API Endpoints](#api-endpoints)
6. [Code Design Overview](#code-design-overview)

## Getting Started

Before you begin, ensure you have the following installed:

- **Docker**: [Download and install Docker](https://docs.docker.com/get-docker/)
- **Postman** (Optional for API manual testing): [Download and install Postman](https://www.postman.com/downloads/)
- **Golang**: The project uses Go 1.23 [Download and install Go](https://golang.org/dl/)
- **Make**:
  - Linux: `sudo apt install make`
  - MacOS: `brew install make`
  - Windows: [Install Make](https://gnuwin32.sourceforge.net/packages/make.htm)

*Ensure your Docker engine is running before executing any commands.*

## Building & Testing

- **Build the Application**:

  ```bash
  make build
  ```

- **Run Unit Tests**:

  ```bash
  make test
  ```

- **Build and Test the Application**:

  ```bash
  make all
  ```

- **Clean Up Binary**:

  ```bash
  make clean
  ```

## Running the Project

There is just a single step for running the application:

```bash
make run
```

This will up both docker-compose descripted containers: the *http/net* API Server and the *Postgres* database.

The endpoint is accessible through `http://localhost:8080/`

## API Endpoints

The *Postman Collection file* is in the project's root - it contains all API requests and can be imported in **Postman**. The Device API provides the following endpoints:

1. **Ping**: Check the health of the API.

   - **Endpoint**: `GET /ping`
   - **Response**:
     - `200 OK`: Returns `{"message": "pong"}`

2. **Create Device**: Add a new device.

   - **Endpoint**: `POST /devices`
   - **Example Request Body**:

     ```json
     {
       "name": "Device Name",
       "brand": "Device Brand"
     }
     ```

   - **Response**:
     - `201 Created`: Returns the created device object.
     - `400 Bad Request`: If the request payload is invalid.

3. **Fetch Device**: Retrieve a single device by its ID.

   - **Endpoint**: `GET /devices/{id}`
   - **Response**:
     - `200 OK`: Returns the device object.
     - `400 Bad Request`: If the device ID is invalid.
     - `404 Not Found`: If the device is not found.

4. **Fetch Devices**: Retrieve devices with optional filters: one can see all devices by passing no filter, list by brand passing brand as query parameter, list by state passing `state` as query parameter, and list filtering by brand and state by passing them both. An example of this last case is represented in the documented endpoint:

   - **Endpoint**: `GET /devices?brand=any-brand&state=available`
   - **Query Parameters**:
     - `brand` (optional): Filter by device brand.
     - `state` (optional): Filter by device state (`available`, `in-use`, `inactive`).
   - **Response**:
     - `200 OK`: Returns a list of devices matching the filters.
     - `400 Bad Request`: If the state filter is invalid.

5. **Update Device**: Update an existing device.

   - **Endpoint**: `PATCH /devices/{id}`
   - **Example Request Body**:

     ```json
     {
       "name": "Updated Device Name",
       "brand": "Updated Device Brand",
       "state": "in-use"
     }
     ```

   - **Response**:
     - `200 OK`: Returns the updated device object.
     - `400 Bad Request`: If the request payload is invalid or if attempting to update a device currently in use.
     - `404 Not Found`: If the device is not found.

6. **Delete Device**: Remove a device by its ID.

   - **Endpoint**: `DELETE /devices/{id}`
   - **Response**:
     - `204 No Content`: If the device is successfully deleted.
     - `400 Bad Request`: If attempting to delete a device currently in use.
     - `404 Not Found`: If the device is not found.

## Code Design Overview

The Device API is structured to promote modularity, scalability, and maintainability. Here's an overview of the code design:

- **Main Application**:

  - **`main.go`**: The entry point of the application. It initializes the database connection and starts the HTTP server.

- **Internal Packages**:

  - **`database`**: Contains the database connection and the DAO implementation.

  - **`model`**: Defines the data structures used in the application, such as the `Device` struct.

  - **`server`**: Contains the HTTP server setup and route handlers for the API endpoints.

  - **`service`**: Includes business logic and validation functions for devices.

  - **`middleware`**: Provides middleware functions for logging and error recovery.

- **Configuration**:

  - **Environment Variables**: The application uses environment variables for configuration, such as database credentials. These are loaded from a `.env` file - even though the best approach facing a production environment would be not to store them in the microservice itself. A good alternative would be to store them in AWS Parameter Store.

- **Testing**:

  - **Router Tests**: Ensure all requests are being processed as expected.

  - **Validator Tests**: Ensure the defined validation constraints are met.

- **Error Handling**:

  - The application uses structured error handling to provide meaningful messages and compatible HTTP status codes.

- **Logging**:

  - Middleware is used to log incoming requests and errors, aiding in debugging and monitoring.

## What would be the next steps if I had more time

### Improve project layer organization
The first thing I would do with more time is certainly delegate almost all checks and business rules from the `routes.go` to the `service` layer. Doing this allows me to cut the connection between the server and the database, which DAO would only be accessible to `service`. Router->Service->Repository design, even taking a little more time, would make the project more maintainable and extensible - which are even more urgent if we are thinking about a long-term project with many involved engineers.

### Missing Tests
I would write the test cases for the `Device DAO` - aren't many, but there are some that would be valuable. This would cover the need of *integration tests* of this project. I would also deeply test the `service` layer I mentioned before.

### Database Indexes
Having the functional requirements in mind, I think it would be proper to index `State` and `Brand` aiming to speed up our filtering for our Postgres database.

### API Versioning
I would add a single more middleware to the API Server: a versioning one. It would use a `.env` attribute to determine the prefix of the endpoints URIs. It would ease a possible migration/version bump of the Devices API in the future, avoiding issues with active users.

### Metrics & Monitoring
A Prometheus Scrapper would fit greatly here. We could export some relevant usage data and plor in Graphana dashboards, create alarms in slack channels, etc.


*Thank you!*
