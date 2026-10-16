# FlowDesk — Service Request Management System

FlowDesk is a responsive service-request dashboard backed by a Node.js and Express REST API. It includes a Kanban board, request search and filters, status totals, validated CRUD operations, and an in-memory example dataset.

> **Learning version:** Requests are stored in memory. All changes, including newly created requests, reset to the example dataset whenever the server restarts. Use a persistent database before relying on this application for production data.

## Live Demo
https://service-request-690v.onrender.com/
## Requirements

- Node.js 20 or newer
- npm

## Run locally

```bash
npm install
Copy-Item .env.example .env
npm start
```

Open [http://localhost:3000](http://localhost:3000). The server uses port `3000` by default; set `PORT` in `.env` to use a different port.

To use the dashboard from a static preview such as VS Code Live Server, start the FlowDesk API with `npm start`, open **Settings** in the preview, and enter the API server origin (for example, `http://localhost:3000`) in **FlowDesk API server URL**. Save the setting to load existing requests and enable creating, editing, archiving, and restoring requests. This URL is saved in that browser. If port 3000 is already in use, configure another port with `PORT` and enter that port in Settings.

For automatic restarts while developing:

```bash
npm run dev
```

## Run with Docker

```bash
docker build -t flowdesk .
docker run --rm -p 3000:3000 flowdesk
```

The container runs as a non-root user and includes a health check against `GET /health`.

## Tests

```bash
npm test
```

## API

All request and response bodies use JSON. The API enables CORS and returns validation errors as JSON. Request bodies are limited to 100 KB.

| Method | Path | Description | Success |
| --- | --- | --- | --- |
| `GET` | `/health` | Liveness check | `200` |
| `GET` | `/api/requests` | List and optionally filter requests | `200` |
| `GET` | `/api/requests/archived` | List archived requests | `200` |
| `GET` | `/api/requests/:id` | Get one request | `200` |
| `POST` | `/api/requests/:id/restore` | Restore an archived request | `200` |
| `POST` | `/api/requests` | Create a request | `201` |
| `PUT` | `/api/requests/:id` | Replace request fields | `200` |
| `PATCH` | `/api/requests/:id` | Partially update a request | `200` |
| `DELETE` | `/api/requests/:id` | Move a request to the archive | `200` |

`GET /api/requests` accepts optional `q`, `status`, and `priority` query parameters. Search checks the request ID, title, description, category, and requester. Archived requests are excluded from this endpoint and can be listed with `GET /api/requests/archived`. Deleting a request archives it with a `deletedAt` timestamp; restore it with `POST /api/requests/:id/restore`. Status values are `open`, `in progress`, `resolved`, and `closed`; priority values are `low`, `medium`, `high`, and `urgent`.

Create and replace requests require non-empty `title`, `category`, `description`, and `requester`, along with a valid `priority` and `status`. Optional fields are `requesterEmail`, `assignee`, `date` (`YYYY-MM-DD`), and `progress` (integer from 0 to 100). Patch requests accept one or more of these fields.

### Example

```bash
curl -X POST http://localhost:3000/api/requests `
  -H "Content-Type: application/json" `
  -d '{"title":"Laptop replacement","category":"IT Support","description":"Battery no longer charges.","requester":"Alex Morgan","priority":"high","status":"open"}'
```

Errors return JSON with an `error` message and an appropriate HTTP status (`400` invalid input, `404` missing resource, `413` oversized JSON, or `500` unexpected server error).

## Project structure

```text
src/app.js          Express app, routes, validation, and example data
src/server.js       Environment configuration and HTTP listener
public/             Responsive dashboard
test/api.test.js    Automated API tests
Dockerfile          Production Node.js container
```
