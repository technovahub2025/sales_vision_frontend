# SaleVision Frontend

React + Vite frontend for SaleVision with realtime task updates.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

3. Run dev server:

```bash
npm run dev
```

## Runtime Config

- `VITE_API_BASE_URL`: backend host or API base; `/api` is appended automatically if missing
- `VITE_SOCKET_URL`: socket server base (default `http://localhost:5000`)
- `VITE_DEFAULT_WORKSPACE_ID`: workspace key/slug used for API and room join
- `VITE_DEFAULT_PROJECT_ID`: optional project fallback (auto-set by seed bootstrap)

## Realtime Flow

- App opens Socket.IO connection on startup.
- Core pages join workspace/project room via `workspace:join`.
- UI reacts to `task:updated`, `comment:created`, `board:refreshed`, and `dashboard:refreshed`.

## Core Dynamic Pages

- `/dashboard`
- `/project-board`
- `/task-detail`

All other pages remain static in this phase.
