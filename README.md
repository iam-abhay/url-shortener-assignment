# LinkLite — Full-Stack URL Shortener

A simple, fast, and persistent full-stack URL shortener built for the Round 1 assignment.

## Live Submission Links

- **Live Demo (Frontend)**: [https://url-shortener-assignment-self.vercel.app/](https://url-shortener-assignment-self.vercel.app/)
- **Live Backend API**: [https://linklite-api-ekdk.onrender.com](https://linklite-api-ekdk.onrender.com)
- **Public GitHub Repository**: [https://github.com/iam-abhay/url-shortener-assignment](https://github.com/iam-abhay/url-shortener-assignment)

## Screenshot

![LinkLite screenshot](docs/screenshot.svg)

## Features

- **Shorten Long URLs**: Paste any HTTP or HTTPS URL to generate an 8-character cryptographically secure short code.
- **Smart Protocol Fix**: Automatically prepends `https://` if omitted (e.g. `github.com` -> `https://github.com`).
- **Atomic Click Tracking**: Redirecting via `/:shortCode` increments the click count atomically using single-query SQL updates to prevent race conditions.
- **Persistence**: Powered by PostgreSQL database on Render, with seamless zero-config SQLite fallback for offline local development.
- **Modern UI**: Styled with modern typography (*Space Grotesk* and *DM Sans*), dark mode hero header, live stats counters, and copy-to-clipboard feedback.

## Tech Stack

- **Frontend**: React 19 + Vite
- **Backend**: Node.js + Express 5
- **Database**: PostgreSQL (Driver: `pg`), SQLite fallback (`better-sqlite3`)
- **Deployment**: Vercel (Frontend) + Render (Backend Web Service & PostgreSQL)

## Project Structure

```text
url-shortener/
├── backend/
│   ├── src/
│   │   ├── server.js    # Express REST API routes & app configuration
│   │   └── db.js        # Dual-mode database interface (PostgreSQL / SQLite)
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx      # Main React UI component
│   │   ├── main.jsx     # React DOM entry point
│   │   └── index.css    # Custom CSS design system
│   ├── package.json
│   ├── vite.config.js
│   ├── vercel.json      # Client-side SPA routing config
│   └── .env.example
├── docs/
│   └── screenshot.svg
├── docker-compose.yml
├── render.yaml
├── .gitignore
└── README.md
```

## Quick Start (Local Development)

### 1. Backend

```bash
cd backend
npm install
npm run dev
```

The backend runs on `http://localhost:5000`.

*(Note: If no PostgreSQL `DATABASE_URL` is set locally, the backend automatically uses an offline SQLite database stored in `backend/links.db`.)*

### 2. Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`.

---

## Environment Variables

### Backend (`backend/.env`)

```env
PORT=5000
DATABASE_URL=postgresql://shortener:shortener@localhost:5432/shortener
BASE_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5173
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5000/api
```

---

## API Reference

### 1. Create a short URL

```http
POST /api/links
Content-Type: application/json

{
  "url": "https://github.com/iam-abhay/url-shortener-assignment"
}
```

**Response (201 Created):**

```json
{
  "id": 1,
  "originalUrl": "https://github.com/iam-abhay/url-shortener-assignment",
  "shortCode": "avuftRF1",
  "shortUrl": "https://linklite-api-ekdk.onrender.com/avuftRF1",
  "clicks": 0,
  "createdAt": "2026-08-13T16:56:01.701Z"
}
```

### 2. List all links

```http
GET /api/links
```

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": 1,
      "originalUrl": "https://github.com/iam-abhay/url-shortener-assignment",
      "shortCode": "avuftRF1",
      "shortUrl": "https://linklite-api-ekdk.onrender.com/avuftRF1",
      "clicks": 1,
      "createdAt": "2026-08-13T16:56:01.701Z"
    }
  ]
}
```

### 3. Redirect & Increment Clicks

```http
GET /:shortCode
```

**Response:** `302 Found` redirecting to `originalUrl`.

### 4. Health Check

```http
GET /api/health
```

**Response (200 OK):**

```json
{
  "status": "ok",
  "database": "pg"
}
```

---

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

---

## Submission Checklist

- [x] Public GitHub repository with README setup steps
- [x] Live Demo URL (Frontend deployed on Vercel)
- [x] Live Backend API (Express deployed on Render)
- [x] Live PostgreSQL database hosted on Render
- [x] Short URL creation & input validation
- [x] Atomic click counter incrementing on redirect
- [x] Persistent storage after page refresh
- [x] Responsive React frontend UI with copy button

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
