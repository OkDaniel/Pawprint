# Pawprint 

A desktop personal health tracker with a cat companion. The current vertical slice supports session authentication and a focused, mood-first Check-In wizard with customizable feelings, symptoms, and factor quick lists.

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

3. Create the MariaDB database and user named in `.env`, then initialize the non-destructive schema and built-in tracking libraries:

   ```bash
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS capstone CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   npm run db:migrate
   npm run db:seed
   npm run db:verify
   ```

   If your `DB_NAME` is not `capstone`, use that name in the SQL command. Grant the configured `DB_USER` access using your local MariaDB administration process.

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
- `npm run db:migrate` — apply only numbered migrations not previously recorded
- `npm run db:seed` — safely upsert the built-in factor, feeling, and symptom libraries
- `npm run db:verify` — verify tables, seed counts, and the factor-intensity column

## Environment

The server reads the repository-root `.env` file. For local MariaDB, configure `DB_HOST` and `DB_PORT`. On Turing, set `DB_SOCKET=/run/mysqld/mysqld.sock`; the connection utility prefers the socket when it is present. `APP_PORT` is configurable because production must use the administrator-assigned internal port. `APP_BASE_PATH` is reserved for the eventual Apache proxy path and defaults to `/`.

## Repository layout

```text
client/   React, TypeScript, Vite, React Router, CSS Modules
server/   Express, TypeScript, environment and MariaDB utilities
shared/   Types and validation shared across runtime boundaries
```

## Current milestone boundary

Authentication, normalized Check-In persistence, safe custom tracking items, customizable quick lists, factor intensity, and Recent Check-Ins are implemented. Sleep, analytics, medication, game rewards, sprites, and other game logic remain future milestones.
