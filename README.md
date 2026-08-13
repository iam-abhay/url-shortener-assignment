# LinkLite — URL Shortener

A simple full-stack URL shortener built for the Round 1 assignment.

## Live Demo

> **Add your deployed URL here before submitting.**

`https://YOUR-FRONTEND.vercel.app`

## GitHub

`https://github.com/YOUR_USERNAME/url-shortener`

## Screenshot

![LinkLite screenshot](docs/screenshot.svg)

## Features

- Paste a long URL and create a short link.
- Redirect from the short link to the original URL.
- Increment click count on every redirect.
- List all shortened URLs and click counts.
- PostgreSQL persistence.
- React frontend.
- Express REST API.
- Input validation and clear error states.
- Responsive UI.
- Docker Compose for one-command local PostgreSQL.

## Tech Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL
- Driver: `pg`
- Deployment: Vercel/Netlify + Render/Railway

## Project Structure

```text
url-shortener/
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   └── db.js
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example
├── docs/
│   └── screenshot.svg
├── docker-compose.yml
├── render.yaml
├── vercel.json
├── .gitignore
└── README.md
```

## Prerequisites

- Node.js 18+
- npm
- Docker Desktop, or local PostgreSQL instance (Optional: SQLite fallback automatically works out of the box for local dev!)

## Quick Start

### Backend

```bash
cd backend
npm install
npm run dev
```

The backend runs on `http://localhost:5000`.

### Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`.

## Environment Variables

### Backend

```env
PORT=5000
DATABASE_URL=postgresql://shortener:shortener@localhost:5432/shortener
BASE_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5173
```

### Frontend

```env
VITE_API_URL=http://localhost:5000/api
```

## API Reference

### 1. Create a short URL

```http
POST /api/links
Content-Type: application/json

{
  "url": "https://example.com/some/very/long/path"
}
```

### 2. List all links

```http
GET /api/links
```

### 3. Redirect & Increment Clicks

```http
GET /:shortCode
```

### 4. Health Check

```http
GET /api/health
```

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS links (
  id SERIAL PRIMARY KEY,
  original_url TEXT NOT NULL,
  short_code VARCHAR(12) UNIQUE NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Deployment Guide

### Backend + PostgreSQL on Render

1. Push this repository to GitHub.
2. Create a PostgreSQL database on Render.
3. Create a Web Service from the repository with Root Directory `backend`.
4. Build command: `npm install`
5. Start command: `npm start`
6. Add environment variables:
   - `DATABASE_URL` (From Render Postgres)
   - `BASE_URL` (`https://<your-render-backend>.onrender.com`)
   - `FRONTEND_URL` (`https://<your-vercel-frontend>.vercel.app`)

### Frontend on Vercel

1. Import the GitHub repository on Vercel.
2. Set Root Directory to `frontend`.
3. Set Environment Variable: `VITE_API_URL` = `https://<your-render-backend>.onrender.com/api`
4. Deploy.

---

## Interview Walkthrough & Architecture Notes

Be ready to walk through every line of code during technical evaluation:

### 1. How React calls the Express API
React components use native async `fetch()` inside `App.jsx`. `loadLinks()` calls `GET /api/links` on mount, and `createShortLink()` posts `{ url }` to `/api/links`. `VITE_API_URL` manages target API endpoints between development (`localhost:5000`) and production (`Render`).

### 2. Why PostgreSQL is used over in-memory storage
In-memory structures reset whenever the server restarts or redeploys. PostgreSQL persists data across deployments, supports atomic concurrency, and enforces schema constraints.

### 3. How short codes are generated
Short codes are generated using Node.js `crypto.randomBytes(6).toString("base64url").slice(0, 8)`. This yields 8 URL-safe random characters ($64^8 \approx 280$ trillion combinations), avoiding predictability.

### 4. How the redirect endpoint increments clicks
`GET /:shortCode` executes an atomic SQL query:
`UPDATE links SET clicks = clicks + 1 WHERE short_code = $1 RETURNING original_url`.
This prevents race conditions when multiple users hit the short URL simultaneously.

### 5. Why `short_code` has a UNIQUE database constraint
The `UNIQUE` constraint ensures database-level integrity, preventing collisions and allowing index-accelerated $O(1)$ lookups.

### 6. Environment variable handling
Key parameters (`DATABASE_URL`, `BASE_URL`, `FRONTEND_URL`, `VITE_API_URL`) are isolated in environment variables using `dotenv` on backend and Vite `import.meta.env` on frontend, keeping code agnostic to deployment environments.

### 7. How to scale with Redis & Load Balancing
- **Caching:** Cache hot `shortCode -> originalUrl` mappings in Redis for sub-5ms redirects.
- **Click Aggregation:** Increment click counts in Redis using `INCR` and periodically sync counts back to Postgres in bulk via background jobs.
- **Horizontally Scalable App Nodes:** Run multiple stateless Express processes behind NGINX or ALB.

### 8. Malicious URL and Abuse Prevention
- **Rate Limiting:** Protect APIs with `express-rate-limit` per IP.
- **Safety Scanning:** Check submitted URLs against Google Safe Browsing API / VirusTotal API prior to database insertion.
- **SSRF Prevention:** Disallow private IP addresses and localhost destinations.

