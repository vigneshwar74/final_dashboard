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

## Deploying To Vercel

This repository is now set up so the React app can be deployed as the frontend and the Express API can run as a Vercel Function at `/api`.

### Before you deploy

You will need a hosted PostgreSQL database and these Vercel environment variables:

```bash
DATABASE_URL=your-hosted-postgres-connection-string
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
NODE_ENV=production
CORS_ORIGIN=https://your-vercel-domain.vercel.app
REACT_APP_API_URL=/api
```

If you later add a separate realtime server for Socket.IO, also set:

```bash
REACT_APP_SOCKET_URL=https://your-realtime-server.example.com
```

### Deploy steps

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. Import the repository into Vercel.
3. Keep the project root as the repository root.
4. Add the environment variables listed above in the Vercel dashboard.
5. Deploy.

### Important limitation

Vercel Functions do not support acting as a WebSocket server, so Socket.IO live notifications will not run directly on Vercel. The app will still work, but realtime notifications need a separate realtime host or provider if you want them in production.

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
