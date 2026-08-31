# ERP Factory — Frontend

Independent React SPA that communicates with the backend API only (no shared code).

## Prerequisites

- Node.js 20+
- Backend API running at http://localhost:3000

## Setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

App: http://localhost:5173

## Environment

| Variable | Description |
|----------|-------------|
| VITE_API_URL | Backend API base URL (default: `http://localhost:3000/api/v1`) |

## API communication

All data flows through HTTP to the backend. Configure `VITE_API_URL` if the API runs on a different host/port.
