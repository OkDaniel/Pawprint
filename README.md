# Pawprint 

A desktop personal health tracker with a cat companion. The current vertical slice supports session authentication and a focused, mood-first Check-In wizard with customizable feelings, symptoms, and factor quick lists.

## Prerequisites

- Node.js 24 or newer
- npm 11 or newer
- MariaDB (locally verified with 11.8.6; verify the hosted server before deployment)

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
- `npm run test:db-phase3` — run the disposable-user Phase 3 integration suite against the configured MariaDB schema
- `npm run db:migrate` — apply only numbered migrations not previously recorded
- `npm run db:seed` — safely upsert the built-in factor, feeling, and symptom libraries
- `npm run db:verify` — inspect the live schema, seed counts, onboarding fields, and Phase 3 wallet/coat/floor integrity
- `npm run db:verify-phase3` — run fresh-install and 001–006 upgrade checks in disposable prefixed MariaDB tables
- `npm run db:seed-demo` — reset and regenerate deterministic local History data for only `pawprint_demo`
- `npm run db:repair-rewards -- <user-id> <start> <end> --confirm` — repair an explicit post-launch range of at most 31 logical dates

## Development demo data

After migrations and built-in seeds are current, run:

```bash
npm run db:seed-demo
```

This development-only command refuses to run when `NODE_ENV=production`. It deletes and recreates only the exact dedicated username `pawprint_demo`; it never resets another account. The recreated account is onboarding-complete, owns only its equipped coat, has a zero-coin wallet, and receives 45 logical days of deterministic, intentionally incomplete Check-In and Sleep history. Synthetic history never grants coins.

The local default password is `pawprint-demo-only`. Set `DEMO_USER_PASSWORD` in the uncommitted `.env` file to override it. Rerunning the command safely replaces the same synthetic account and produces the same relative pattern for the current ending logical date.

## Environment

The server reads the repository-root `.env` file. For local MariaDB, configure `DB_HOST` and `DB_PORT`. On Turing, set `DB_SOCKET=/run/mysqld/mysqld.sock`; the connection utility prefers the socket when it is present. `APP_PORT` is configurable because production must use the administrator-assigned internal port. `APP_BASE_PATH` is reserved for the eventual Apache proxy path and defaults to `/`. `APP_TIME_ZONE` is the application-wide IANA timezone used for the 4:00 AM logical-day boundary and defaults to `America/Chicago`. `ECONOMY_REWARDS_START_AT` must be an immutable ISO-8601 UTC instant ending in `Z`; unset means rewards are disabled. `ENABLE_DEV_COIN_GRANTS` defaults to `false`, and production excludes the endpoint even if it is true. `DEMO_USER_PASSWORD` is used only by the development demo-data command.

## Repository layout

```text
client/   React, TypeScript, Vite, React Router, CSS Modules
server/   Express, TypeScript, environment and MariaDB utilities
shared/   Types and validation shared across runtime boundaries
```

## Current milestone boundary

Authentication, onboarding, normalized idempotent Check-In persistence, daily Sleep, History, the 30-day Mood Trend, the animated Mochi companion, and the complete Phase 3 Store/Inventory/Build loop are implemented. The lower-right Home Store action opens `/app/store`, with server-priced purchases, individual decoration instances and finishes, owned-coat equipment, and a local-draft floor editor that saves the complete arrangement for Home and subsequent sign-ins. The shared Home/Build scene uses the frozen 16-family/74-finish catalog and authoritative 16×16 placement contract. Wallet/ledger rewards and game failures remain isolated from tracking. Wall placement, medication, and final economy balancing remain future milestones.
