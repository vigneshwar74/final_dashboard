# College Resource Utilization Dashboard

A full-stack PERN (PostgreSQL, Express, React, Node.js) web application for managing and monitoring college resources like classrooms, labs, computers, projectors, and other equipment with booking and utilization analytics.

## Tech Stack
- **Frontend:** React + HTML/CSS
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Auth:** JWT (access + refresh tokens)

## Project Structure
```
project/
├── client/            # React frontend
│   ├── public/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── context/
│       └── services/
├── server/            # Express backend
│   └── src/
│       ├── db/        # Migrations, seed, pool
│       ├── middleware/ # Auth, validation
│       ├── routes/    # API routes
│       └── index.js   # Entry point
└── README.md
```

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### 1. Database
```bash
createdb college_resources
```

### 2. Server
```bash
cd server
cp .env.example .env        # Edit with your DB credentials
npm install
npm run setup               # Runs migrations + seed
npm run dev
```

### 3. Client
```bash
cd client
cp .env.example .env
npm install
npm start
```

The app runs at `http://localhost:3000` with the API at `http://localhost:5000`.

## Default Users (from seed)
| Role    | Email              | Password  |
|---------|--------------------|-----------|
| Admin   | admin@college.edu  | admin123  |
| Staff   | staff@college.edu  | staff123  |
| Student | student@college.edu| student123|

## API Endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`

### Resources
- `GET /api/resources`
- `GET /api/resources/:id`
- `POST /api/resources` (admin)
- `PUT /api/resources/:id` (admin)
- `DELETE /api/resources/:id` (admin)

### Bookings
- `GET /api/bookings`
- `GET /api/bookings/:id`
- `POST /api/bookings` (staff+)
- `PUT /api/bookings/:id/status` (admin)
- `DELETE /api/bookings/:id`

### Analytics
- `GET /api/analytics/summary`
- `GET /api/analytics/by-type`
- `GET /api/analytics/trend`
- `GET /api/analytics/top-resources`
- `GET /api/analytics/export`
