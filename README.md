# Pawprint 

A desktop personal health tracker with a cat companion. This repo has only the initial skeleton.

## Prerequisites

- Node.js 24 or newer
- npm 11 or newer
- MariaDB 10.11 or a compatible MySQL server

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and replace the database placeholders:

   ```bash
   cp .env.example .env
   ```

3. Create the MariaDB database named by `DB_NAME` and grant the configured user access. Phase 1 verifies connectivity but does not create application tables yet.

4. Start the client, server, and shared-package watcher:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:5173`. Vite proxies `/api` requests to the Express server at `http://localhost:3001` by default.

Check the API directly at `http://localhost:3001/api/health`.

## Commands

- `npm run dev` — run all workspaces in watch mode
- `npm run build` — produce client, shared, and server builds
- `npm run start` — run the compiled Express server
- `npm run lint` — lint all workspaces
- `npm run typecheck` — type-check all workspaces
- `npm test` — run the test suites once

## Environment

The server reads the repository-root `.env` file. For local MariaDB, configure `DB_HOST` and `DB_PORT`. On Turing, set `DB_SOCKET=/run/mysqld/mysqld.sock`; the connection utility prefers the socket when it is present. `APP_PORT` is configurable because production must use the administrator-assigned internal port. `APP_BASE_PATH` is reserved for the eventual Apache proxy path and defaults to `/`.

## Repository layout

```text
client/   React, TypeScript, Vite, React Router, CSS Modules
server/   Express, TypeScript, environment and MariaDB utilities
shared/   Types and validation shared across runtime boundaries
```

## Current milestone boundary

This milestone has no authentication, schema migrations, tracking forms, analytics, sprites, or game logic. Routes other than Home are only placeholders for later development and deployment.