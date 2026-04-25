# CampusBook - Smart Campus Resource Booking Platform

## Project Overview

CampusBook is a unified platform for managing campus facility reservations including study rooms, laboratories, sports facilities, and seminar halls. It provides real-time availability search, booking with pessimistic conflict prevention, QR code check-in with TTL auto-release, waitlist management, and analytics dashboards.

## Key Features

- Zero double-bookings through pessimistic locking under concurrent load
- QR code check-in with 15-minute auto-release for no-shows
- Automatic waitlist promotion when slots become available
- Real-time availability updates via WebSocket
- Role-based access control (Student, Faculty, Admin, Facilities)

## Technology Stack

### Backend
- FastAPI - Modern async web framework
- SQLAlchemy - Async ORM with PostgreSQL
- Redis - Caching, pub/sub, and TTL-based auto-release
- PostgreSQL - Primary relational database
- JWT - Token-based authentication

### Frontend
- React 19 - UI library
- TypeScript - Type-safe JavaScript
- Vite - Build tool and dev server
- Tailwind CSS - Utility-first styling
- React Router - Client-side routing

---

## Architecture

```
CampusBook/
|-- backend/
|   |-- app/
|   |   |-- adapters/       # Resource-specific availability adapters
|   |   |-- auth/          # JWT middleware and RBAC
|   |   |-- builders/      # Domain object builders
|   |   |-- db/           # Database models and configuration
|   |   |-- models/       # Domain models
|   |   |-- repositories/ # Data access layer
|   |   |-- routes/      # API endpoints
|   |   |-- services/    # Business logic
|   |   |-- strategies/  # Validation strategies by resource type
|   |   |-- websocket/   # Real-time updates hub
|   |   |-- exceptions.py # Shared exceptions
|   |   |-- dependencies.py # Dependency injection
|   |   |-- main.py      # FastAPI entry point
|   |-- tests/          # Unit and integration tests
|   |-- requirements.txt
|   |-- Dockerfile
|   |-- pytest.ini
|
|-- frontend/
|   |-- src/
|   |   |-- components/  # Reusable UI components
|   |   |-- context/    # Auth context provider
|   |   |-- pages/      # Page components
|   |   |-- services/   # API client
|   |   |-- types/     # TypeScript definitions
|   |-- package.json
|   |-- Dockerfile
|
|-- docker-compose.yml
|-- openapi.json
```

---

## Database Models

### ResourceRow - Bookable campus resources
- id, name, type (STUDY_ROOM, LAB, SPORTS, SEMINAR), capacity, location, amenities

### BookingRow - Reservation records
- id, user_id, resource_id, slot_start, slot_end, state, qr_token, requires_approval, notes, expires_at

### WaitlistRow - Queue entries for unavailable slots
- id, resource_id, slot_start, slot_end, user_id, position, joined_at

### DomainEventRow - Audit trail
- id, event_type, payload, occurred_at

---

## User Roles

| Role | Permissions |
|------|-------------|
| ROLE_STUDENT | Book STUDY_ROOM, LAB, SPORTS |
| ROLE_FACULTY | Book SEMINAR, LAB |
| ROLE_DEPT_ADMIN | Approve/reject bookings, view analytics, cancel any booking |
| ROLE_FACILITIES | View analytics dashboards |

---

## API Endpoints

### Authentication
- `POST /api/auth/login` - Get JWT token

### Bookings
- `POST /api/bookings/` - Create booking
- `GET /api/bookings/user/me` - User's bookings
- `GET /api/bookings/{id}` - Booking details
- `DELETE /api/bookings/{id}` - Cancel own booking
- `PATCH /api/bookings/{id}/approve` - Admin approve
- `PATCH /api/bookings/{id}/reject` - Admin reject
- `DELETE /api/bookings/{id}/admin-cancel` - Admin cancel

### Resources
- `GET /api/resources` - Search with filters (type, capacity, location)
- `GET /api/resources/{id}` - Resource details
- `GET /api/resources/{id}/availability?date=YYYY-MM-DD` - 14-slot availability grid

### Check-In
- `POST /api/checkin/{qr_token}` - QR code check-in

### Waitlist
- `POST /api/waitlist` - Join waitlist
- `GET /api/waitlist/me` - User's waitlist entries

### Admin
- `GET /api/admin/room-overview` - Active bookings overview

### Analytics
- `GET /api/analytics/utilization` - 7-day stats per resource
- `GET /api/analytics/heatmap` - 7x14 booking density grid

### WebSocket
- `WS /api/ws/{resource_id}` - Real-time availability updates

---

## Setup Instructions

### Prerequisites
- Docker
- Docker Compose

### Running the Application

1. Navigate to the repository:
```bash
cd CampusBook
```

2. Start all services:
```bash
docker-compose up --build
```

This starts four containers:
- postgres (port 5432)
- redis (port 6379)
- api (port 8000)
- frontend (port 5173)

3. Access the application:
- Frontend: http://localhost:5173
- API Docs: http://localhost:8000/docs

Note: Use the login page in the frontend application to authenticate.

---

## Running Tests

### Backend Tests
```bash
docker-compose exec api python -m pytest tests/ -v
```

### Frontend Tests
```bash
cd frontend
npm test
```

### Test Categories
```bash
# Unit tests only
pytest -m "not integration"

# Integration tests only
pytest -m integration
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_URL | postgresql+asyncpg://campusbook:xxx@postgres/campusbook | Async DB connection |
| DATABASE_SYNC_URL | postgresql+psycopg2://campusbook:xxx@postgres/campusbook | Sync DB connection |
| REDIS_URL | redis://redis:6379 | Redis connection |
| JWT_SECRET | dev-secret-change-in-production | Token signing key |

Note: xxx is a placeholder password - update for production deployments.

---

## Error Response Format

All API errors follow a standardized format:
```json
{
  "success": false,
  "error": {
    "code": "HTTP_422",
    "message": "Validation error details",
    "details": null
  },
  "request_id": "uuid",
  "timestamp": "ISO8601"
}
```

---

## Project Structure Details

### Backend Services
- **BookingService** - Core booking logic with pessimistic locking
- **CatalogueService** - Resource search and availability
- **CheckInService** - QR validation and TTL listener
- **NotificationService** - Email/SMS/WebSocket notifications with circuit breaker

### Frontend Pages
- **LoginPage** - Authentication
- **ResourceSearch** - Resource discovery
- **ResourceDetailPage** - Availability grid and booking
- **StudentDashboard** - User bookings and waitlist
- **AdminDashboard** - Approval queue and room overview
- **FacilitiesDashboard** - Analytics and heatmaps

### Validation Strategies
- **StudyValidationStrategy** - Students max 3 hours
- **LabValidationStrategy** - Labs max 4 hours
- **SportsValidationStrategy** - Sports max 2 hours
- **SeminarValidationStrategy** - Seminars require approval