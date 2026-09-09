# Pawprint Codebase Explanations

This guide explains the current Pawprint repository as a learning reference. It follows the order in which the pieces fit together: repository configuration, shared contracts, server, client, project specifications, and visual references.

Generated dependencies (`node_modules`), compiled output (`dist`), caches, lockfiles, and TypeScript build metadata are intentionally excluded. Secrets from `.env` are also never reproduced.

## Table of contents

- [Concepts glossary](#concepts-glossary)
- [Mental model of the application](#mental-model-of-the-application)
- [Root files and tooling](#root-files-and-tooling)
- [Shared package](#shared-package)
- [Server package](#server-package)
- [Client package](#client-package)
- [Project documentation](#project-documentation)
- [UI reference image inventory](#ui-reference-image-inventory)
- [Commands and tooling used](#commands-and-tooling-used)
- [Major choices: why this, not that](#major-choices-why-this-not-that)
- [How the files connect during one request](#how-the-files-connect-during-one-request)
- [Full POST request walkthrough](#full-post-request-walkthrough)
- [Troubleshooting and common errors](#troubleshooting-and-common-errors)
- [How to reproduce this yourself](#how-to-reproduce-this-yourself)

Within the package sections, every file has its own `##` heading. Most Markdown renderers automatically add a link icon beside a heading, so you can also copy a direct link to any individual file explanation.

## Concepts glossary

Read this once before the file walkthrough. The definitions are intentionally practical: they explain what each term means *in this repository*.

### Application and web concepts

- **API (Application Programming Interface):** a defined way for programs to communicate. Pawprint's browser sends HTTP requests to routes beginning with `/api`; Express returns JSON.
- **Client/frontend:** code running in the user's browser. Here that is the `client` workspace containing React.
- **Server/backend:** code running on the host machine rather than in the browser. Here that is the Express application in `server`.
- **HTTP:** the request/response protocol used by browsers and servers. A request has a method, URL, headers, and optionally a body; a response has a status, headers, and body.
- **GET:** an HTTP method for reading data without changing it. `/api/health` is a GET route.
- **POST:** an HTTP method commonly used to create data. A future `POST /api/check-ins` will create a check-in.
- **JSON:** a text data format made from objects, arrays, strings, numbers, booleans, and `null`. Pawprint's API request and response bodies use JSON.
- **Route/endpoint:** a method-plus-path handled by the server, such as `GET /api/health`. On the client, “route” can also mean a URL-to-component mapping such as `/app/history`.
- **SPA (Single-Page Application):** an application that loads one HTML document and changes views in the browser. React Router swaps pages without requesting a new HTML file for every click.
- **Proxying:** forwarding a request through an intermediary. During development, Vite forwards `/api` to Express, letting browser code use one relative URL and avoid cross-origin setup.
- **Reverse proxy:** a public web server that forwards incoming traffic to an internal application. Production uses Apache in front of Express.
- **Origin/CORS:** an origin is the scheme, host, and port combination. Browsers restrict cross-origin requests unless the server grants permission through CORS headers. Vite's proxy keeps development requests effectively same-origin.
- **Status code:** a numeric HTTP result. `200` means success, `400` means a bad request, `401` means unauthenticated, `404` means not found, and `500` means an unexpected server error.
- **Liveness vs readiness:** liveness asks whether the process responds; readiness asks whether dependencies such as MariaDB are usable. `/api/health` is intentionally only liveness.

### JavaScript, TypeScript, and module concepts

- **JavaScript runtime:** the program executing JavaScript. Browsers execute client code; Node.js executes server and tooling code.
- **Node.js:** the server-side JavaScript runtime used by Express, Vite's tooling, tests, and scripts.
- **npm:** Node's package manager. It downloads libraries, records project commands, and links workspaces.
- **Package/dependency:** a reusable library declared in `package.json`. A runtime dependency is needed by the application; a development dependency is needed only to build, test, or lint it.
- **Semantic version range:** notation such as `^5.1.0`. The caret permits compatible updates within the same major version while avoiding an automatic major-version jump.
- **ESM (ECMAScript Modules):** modern JavaScript modules using `import` and `export`. Pawprint selects ESM with `"type": "module"`.
- **CommonJS:** Node's older module system using `require()` and `module.exports`. Pawprint does not mix it into application code because ESM works naturally with TypeScript and Vite.
- **Import/export:** `export` makes a value or type available to other files; `import` names and uses it elsewhere.
- **Type-only import:** `import type` brings in information only for TypeScript checking and disappears from emitted JavaScript.
- **TypeScript:** JavaScript with compile-time type checking. Types catch mistakes before execution but do not validate unknown data at runtime by themselves.
- **Interface:** a TypeScript declaration describing an object's expected shape, such as `HealthResponse`.
- **Literal type:** a type allowing one exact value, such as `'ok'`, rather than every string.
- **Type narrowing/validation:** proving an unknown value has a safer type. TypeScript narrows known code paths; Zod validates untrusted runtime input.
- **TypeScript project references:** a way to split a codebase into coordinated TypeScript projects. The client references browser and tool configurations separately, and the shared workspace emits declarations consumed by others.
- **Declaration file (`.d.ts`):** a file describing types without implementation. Shared builds create declarations; `vite-env.d.ts` adds types supplied by Vite/CSS Modules.
- **Source map:** metadata mapping compiled JavaScript back to original TypeScript for useful debugger locations and stack traces.
- **Strict mode (TypeScript):** TypeScript's `strict` family of checks, which treats uncertain/null/optional values cautiously.
- **React `StrictMode`:** a different feature with the same phrase. It runs extra development checks and may repeat some behavior to reveal unsafe side effects; it does not change production output.
- **Unchecked indexed access:** looking up a key in an object/array may return nothing. `noUncheckedIndexedAccess` forces code to acknowledge that possibility.
- **Non-null assertion (`!`):** tells TypeScript “I know this value exists.” It does not add a runtime check, so it should be used only when an external system guarantees the value.
- **ES2022/ESNext:** JavaScript language targets. ES2022 is a stable runtime target; ESNext lets build tools understand the newest module syntax before bundling.

### React and browser concepts

- **React:** a library for describing UI as components derived from state and props.
- **Component:** a reusable function returning UI, such as `HomePage` or `PlaceholderPage`.
- **Props:** input values passed from a parent component to a child, such as `title="Insights"`.
- **JSX:** HTML-like syntax embedded in JavaScript/TypeScript. It is transformed into JavaScript function calls before execution.
- **JSX transform:** the compiler step converting JSX to JavaScript. The modern `react-jsx` transform removes the need to import a `React` variable solely for JSX.
- **DOM (Document Object Model):** the browser's in-memory tree of HTML elements. React updates this tree.
- **Mount/root:** attaching React to a real DOM element. Pawprint mounts into `<div id="root">`.
- **React Router:** the client routing library mapping URLs to components.
- **Nested route/Outlet:** child routes render within a parent layout's `<Outlet>` placeholder.
- **Browser history:** the browser's Back/Forward stack. `BrowserRouter` reads and changes it.
- **Accessibility semantics:** HTML roles, labels, headings, and focus behavior that help keyboard and assistive-technology users.
- **jsdom:** a simulated browser DOM used so Node-based tests can render React without launching Chrome.
- **Hot Module Replacement/Fast Refresh:** development behavior that updates changed UI modules quickly, often preserving component state.

### CSS concepts

- **CSS Module:** a `.module.css` file whose local class names are transformed into unique generated names. Components import a `styles` object, preventing accidental collisions.
- **CSS custom property/design token:** a named reusable value such as `--accent-strong`. Tokens centralize colors and shadows.
- **Cascade:** CSS's rules for deciding which style wins. Global foundations load once; component modules add local styles.
- **Flexbox/Grid:** CSS layout systems. Flexbox is useful for one-dimensional rows/columns; Grid is useful for two-dimensional placement and concise centering.
- **Responsive function (`min`, `clamp`, `calc`):** CSS functions that combine fixed limits with viewport-relative sizing.
- **Pseudo-class:** a selector for a state, such as `:focus-visible`; an attribute selector such as `[aria-current='page']` targets semantic markup.

### Server and database concepts

- **Express:** a small Node HTTP framework that composes routes and middleware.
- **Middleware:** a function in the request pipeline that can inspect/change a request or response, end the response, or pass control onward. Error middleware has four parameters so Express recognizes it.
- **Handler/controller:** the function that turns an HTTP request into a response, usually by validating input and calling business logic.
- **Service layer:** functions containing business rules independent of HTTP details.
- **Repository/data-access layer:** functions containing SQL and mapping database rows to application records.
- **MariaDB:** the relational SQL database that persists Pawprint data.
- **SQL:** the language used to query and modify relational databases.
- **ORM (Object-Relational Mapper):** a library that generates/abstracts SQL through objects or a schema language. Pawprint intentionally uses direct parameterized SQL for transparency and reduced scope.
- **Connection:** one live communication channel to a database.
- **Connection pooling:** keeping a bounded reusable set of database connections. Reuse avoids the cost and resource pressure of reconnecting for every request.
- **Unix socket vs TCP:** two transports for database communication. Local development normally uses host/port TCP; Turing can use a filesystem socket.
- **Transaction:** a group of database operations that all commit or all roll back. Check-in creation needs one so partial child rows are never left behind.
- **Parameterized SQL:** SQL with values passed separately from the statement, reducing SQL-injection risk.
- **Migration:** a versioned database schema change that can be applied predictably.
- **Session:** server-side login state associated with a browser cookie. The cookie carries an opaque session identifier, not the password.
- **Password hashing:** a slow one-way transformation used before storing passwords. A salt and work factor make stolen hashes harder to attack.

### Validation, testing, and tooling concepts

- **Zod schema validation:** defining a runtime schema and parsing unknown input through it. Success returns typed values; failure returns structured issues.
- **Coercion:** intentionally converting one representation to another, such as environment text `'3001'` to number `3001`.
- **Fail fast:** stop startup immediately when configuration is invalid rather than fail later in a confusing request.
- **Vite:** the frontend development server and production bundler.
- **Bundling:** resolving many imported browser modules into optimized deployable assets.
- **Transpilation:** converting source syntax (TypeScript/JSX) into runnable JavaScript without necessarily changing program behavior.
- **ESLint:** static analysis that flags suspicious or inconsistent code without running it.
- **Vitest:** Vite-compatible test runner used for unit and integration tests.
- **Supertest:** a library that sends test requests directly to an Express application without opening a public port.
- **React Testing Library:** utilities that test rendered UI through user-facing roles/text rather than component internals.
- **Smoke test:** a small test proving a critical path starts and renders/responds.
- **Integration test:** a test covering multiple pieces together, such as Express app plus router.
- **npm workspace:** npm's built-in way to manage several linked packages from one repository.
- **Monorepo:** one repository containing multiple related packages/applications.
- **Watch mode:** a long-running tool that detects file changes and reruns/rebuilds automatically.
- **Environment variable:** configuration supplied outside source code, useful for ports, modes, and secrets.
- **PM2:** the production process manager that keeps compiled Node running and restarts it when needed.

## Mental model of the application

```text
Browser
  -> Vite development server (during development)
  -> React application and React Router
  -> /api requests proxied to Express
  -> Express routes
  -> MariaDB connection pool (when database features use it)

Production:
Browser -> Apache -> Express -> React build and /api routes -> MariaDB
```

The repository is an npm workspace. The root coordinates three packages:

- `shared`: TypeScript contracts used across application boundaries.
- `server`: Express, environment validation, and MariaDB access.
- `client`: React, routing, CSS, and browser tests.

# Root files and tooling

## `package.json`

**Purpose.** This is the root npm manifest. It names the project, declares the workspaces, and provides one command surface for the whole repository.

**Actual code/configuration.** This is the current file being explained:

```json
{
  "name": "pawprint-capstone",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "client",
    "server",
    "shared"
  ],
  "scripts": {
    "dev": "npm run build --workspace=@capstone/shared && concurrently -n shared,server,client -c yellow,blue,green \"npm run dev --workspace=@capstone/shared\" \"npm run dev --workspace=@capstone/server\" \"npm run dev --workspace=@capstone/client\"",
    "build": "npm run build --workspace=@capstone/shared && npm run build --workspace=@capstone/client && npm run build --workspace=@capstone/server",
    "start": "npm run start --workspace=@capstone/server",
    "lint": "npm run lint --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present"
  },
  "devDependencies": {
    "concurrently": "^9.2.1"
  },
  "engines": {
    "node": ">=24"
  }
}
```

- `name` identifies the root project to npm.
- `version` starts at `0.1.0`, a conventional early-development version.
- `private: true` prevents accidentally publishing the capstone to npm.
- `workspaces` tells npm to install and link the three local packages together. For example, `@capstone/server` can depend on `@capstone/shared` without publishing it online.

The scripts are the main developer interface:

- `dev` first builds `shared`, then uses `concurrently` to watch `shared`, run Express, and run Vite together. Shared must build first because the other packages import its compiled exports.
- `build` compiles shared, client, and server in dependency order.
- `start` delegates to the server package and runs compiled production JavaScript.
- `lint`, `test`, and `typecheck` ask every workspace that provides the corresponding script to run it. `--if-present` avoids failing if a future workspace does not need one.
- `devDependencies.concurrently` is root-only because its job is coordinating packages, not running application code.
- `engines.node >=24` documents the runtime expected locally and on Turing.

**Why Node 24 or newer?** The verified Turing host provides Node 24, so matching it locally prevents “works on my machine” differences. Node 24 also has current ESM, test/tooling, and security support. Requiring it is not permission to use every new feature casually; it establishes one predictable runtime target.

**Versioning rationale.** The project is `0.1.0` because it is an early, non-public application whose interfaces can still change. Caret dependency ranges accept compatible minor/patch fixes while holding major versions stable. In a production deployment, a committed lockfile should pin the exact resolved dependency graph for reproducibility; lockfiles are excluded from this teaching guide because they are generated machine data, not because they are unimportant.

**Connections.** npm reads each workspace's `package.json` from here. The commands eventually invoke the configurations described below.

## `tsconfig.base.json`

**Purpose.** This is the shared TypeScript safety baseline. Each workspace extends it instead of repeating the same rules.

**Actual code/configuration.** This is the current file being explained:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}

```

- `strict` enables TypeScript's family of strict correctness checks.
- `noUncheckedIndexedAccess` makes an indexed lookup such as `styles[name]` possibly `undefined`. That is why known CSS-module properties use `styles.room!`: the `!` says this known generated class exists.
- `exactOptionalPropertyTypes` distinguishes “property omitted” from “property explicitly set to undefined.”
- `forceConsistentCasingInFileNames` prevents imports that work on one filesystem but fail on a case-sensitive server.
- `skipLibCheck` skips rechecking dependency declaration files, reducing build time while still checking Pawprint's code.

**Connections.** `client/tsconfig.app.json`, `client/tsconfig.node.json`, `server/tsconfig.json`, and `shared/tsconfig.json` all extend this file.

## `.env.example`

**Purpose.** This is a safe template showing which environment variables a developer must configure. Unlike `.env`, it is intended to be committed.

**Actual code/configuration.** This is the current file being explained:

```dotenv
NODE_ENV=development
APP_PORT=3001
APP_BASE_PATH=/

# Local development normally uses host/port. On Turing, set DB_SOCKET and it
# will take precedence over DB_HOST and DB_PORT.
DB_HOST=127.0.0.1
DB_PORT=3306
DB_SOCKET=
DB_USER=capstone_user
DB_PASSWORD=change-me
DB_NAME=capstone

# Reserved for the authentication milestone. Use a long random value.
SESSION_SECRET=change-me-to-a-long-random-value

```

- `NODE_ENV` selects development, test, or production behavior.
- `APP_PORT` controls the internal Express port rather than hard-coding one.
- `APP_BASE_PATH` lets Vite support a future Apache proxy subpath.

The database block provides host/port settings for local development and `DB_SOCKET` for Turing. A configured socket takes priority because Turing exposes MariaDB through `/run/mysqld/mysqld.sock`. `DB_USER`, `DB_PASSWORD`, and `DB_NAME` identify the database account and schema. `SESSION_SECRET` is reserved for signed sessions in the authentication milestone.

**Connections.** Copy this file to `.env`; `server/src/config/env.ts` loads and validates those values, while `client/vite.config.ts` reads the app port/base path.

## `.env`

**Purpose.** This is the developer's real local configuration. It has the same keys as `.env.example`, but may contain passwords and must never be committed or quoted in documentation.

**Actual configuration shape (values redacted).** Real local values are deliberately not reproduced:

```dotenv
NODE_ENV=development
APP_PORT=3001
APP_BASE_PATH=/

# Local development normally uses host/port. On Turing, set DB_SOCKET and it
# will take precedence over DB_HOST and DB_PORT.
DB_HOST=127.0.0.1
DB_PORT=3306
DB_SOCKET=
DB_USER=capstone_user
DB_PASSWORD=change-me
DB_NAME=capstone

# Reserved for the authentication milestone. Use a long random value.
SESSION_SECRET=change-me-to-a-long-random-value

```

The significant blocks are application mode/port/base path, MariaDB transport and credentials, and the future session secret. Empty `DB_SOCKET` means use TCP host/port. The file exists locally so `npm run dev` can work without manually exporting variables every time.

**Why are sessions and password hashing deferred?** The present milestone has no user table or protected feature, so adding a half-connected login layer would create security-looking code with nothing meaningful to protect. Authentication is the next deliberate vertical slice: password hashing, session regeneration, secure cookies, a persistent session store, and ownership checks must arrive together before real user data routes are considered complete. The development default secret is convenience only and must be replaced by a long random production secret.

**Connections.** Loaded by `dotenv` in `server/src/config/env.ts`; read by Vite through `loadEnv`. Ignored by `.gitignore` for security.

## `.gitignore`

**Purpose.** Tells Git which local/generated files do not belong in source control.

**Actual code/configuration.** This is the current file being explained:

```gitignore
node_modules/
dist/
.env
*.log
.DS_Store
coverage/
*.tsbuildinfo
.pnpm-data/
.pnpm-home/
.pnpm-store/
```

- `node_modules/` excludes downloaded dependencies.
- `dist/` excludes compiled client/server/shared output because it is reproducible with `npm run build`.
- `.env` excludes secrets.
- `*.log`, `.DS_Store`, and `coverage/` exclude logs, macOS metadata, and generated test coverage.
- `*.tsbuildinfo` excludes incremental TypeScript build state.
- `.pnpm-*` entries exclude temporary package-manager caches used by the development environment.

**Connections.** This protects every workspace and keeps review diffs focused on source files.

## `.vscode/launch.json`

**Purpose.** Defines a VS Code browser-debug launch profile.

**Actual code/configuration.** This is the current file being explained:

```json
{
    // Use IntelliSense to learn about possible attributes.
    // Hover to view descriptions of existing attributes.
    // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
    "version": "0.2.0",
    "configurations": [
        {
            "type": "chrome",
            "request": "launch",
            "name": "Launch Chrome against localhost",
            "url": "http://localhost:8080",
            "webRoot": "${workspaceFolder}"
        }
    ]
}
```

- `version: 0.2.0` is the VS Code debug schema version.
- The single configuration asks VS Code to launch Chrome.
- `request: launch` starts a new browser instead of attaching to one.
- `url` is currently `http://localhost:8080`. Pawprint's Vite port is `5173`, so this profile should be changed to `http://localhost:5173` before using it.
- `webRoot: ${workspaceFolder}` lets source maps resolve browser code back to project files.

**Connections.** This file is used only by VS Code; it does not affect `npm run dev` or production.

## `README.md`

**Purpose.** The short operational entry point for a new developer.

The title and opening paragraph identify Pawprint and its current stage. “Project documentation” links to the six source-of-truth specifications and the UI reference rule. “Prerequisites” records required versions. “Local setup” gives the install, environment, database, and startup sequence. “Commands” explains the root scripts. “Environment” describes local TCP versus Turing socket behavior. “Repository layout” explains the three workspaces, and “Current milestone boundary” prevents the skeleton from being mistaken for implemented product features.

**Connections.** Links to every specification in `docs/` and reflects the scripts in the root `package.json`.

## `EXPLANATIONS.md`

**Purpose.** This file is the detailed learning companion to the concise README. README tells a developer what to do; this guide explains how and why the pieces work.

Its sections follow application dependency order, quote only significant snippets, describe imports and data flow, record tooling commands, and end with a from-scratch reproduction sequence. Update this guide when architecture or foundational files materially change.

# Shared package

## `shared/package.json`

**Purpose.** Declares the local `@capstone/shared` package that holds contracts used by both client and server.

**Actual code/configuration.** This is the current file being explained:

```json
{
  "name": "@capstone/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  "scripts": {
    "dev": "tsc -w --preserveWatchOutput",
    "build": "tsc -p tsconfig.json",
    "lint": "eslint .",
    "test": "vitest run --passWithNoTests",
    "typecheck": "tsc -p tsconfig.json --noEmit --pretty false"
  },
  "devDependencies": {
    "@eslint/js": "^9.34.0",
    "eslint": "^9.34.0",
    "globals": "^16.3.0",
    "typescript": "^5.9.2",
    "typescript-eslint": "^8.41.0",
    "vitest": "^3.2.4"
  }
}

```

- `type: module` selects ECMAScript modules (`import`/`export`).
- `main` points JavaScript consumers to `dist/index.js`.
- `types` points TypeScript to `dist/index.d.ts`.
- `exports` makes the public package surface explicit and supplies separate runtime and type locations.
- `dev` runs TypeScript in watch mode, `build` emits output, `lint` checks style/errors, `test` currently permits zero tests, and `typecheck` verifies types without writing files.
- Tooling is in `devDependencies` because it is needed to build the package but not by production code.

**Connections.** Root scripts build this package first. `server/src/routes/health.ts` imports its `HealthResponse` type.

## `shared/tsconfig.json`

**Purpose.** Controls compilation of shared TypeScript.

**Actual code/configuration.** This is the current file being explained:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"]
}

```

- It extends the strict root settings.
- `target: ES2022` chooses modern JavaScript output.
- `NodeNext` module and resolution rules match Node's ESM behavior.
- `rootDir: src` and `outDir: dist` define input/output boundaries.
- `declaration: true` produces `.d.ts` type files for consumers.
- `sourceMap: true` maps built code back to TypeScript during debugging.
- `include` limits compilation to TypeScript source.

## `shared/eslint.config.js`

**Purpose.** Configures ESLint for shared TypeScript.

**Actual code/configuration.** This is the current file being explained:

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);

```

It imports base JavaScript and TypeScript-aware recommended rules, ignores reproducible `dist` output, and combines the configs with the flat-config API. This catches likely mistakes without a legacy `.eslintrc` file.

## `shared/src/index.ts`

**Purpose.** Defines the shared health-response contract.

**Actual code/configuration.** This is the current file being explained:

```ts
export interface HealthResponse {
  data: {
    status: 'ok';
    service: 'capstone-api';
    timestamp: string;
  };
}
```

- `export interface` makes this compile-time shape importable by other workspaces.
- The `data` wrapper follows the API response convention in `ARCHITECTURE.md`.
- Literal types (`'ok'` and `'capstone-api'`) are stricter than plain `string`; an accidental spelling change fails type-checking.
- `timestamp` is a string because JSON has no native `Date` type. The server sends ISO 8601 text.

**Connections.** `server/src/routes/health.ts` promises that its response matches this shape. The interface produces no runtime JavaScript behavior; it protects development through TypeScript.

# Server package

## `server/package.json`

**Purpose.** Declares the Express workspace, runtime dependencies, and server commands.

**Actual code/configuration.** This is the current file being explained:

```json
{
  "name": "@capstone/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "lint": "eslint .",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit --pretty false"
  },
  "dependencies": {
    "@capstone/shared": "0.1.0",
    "dotenv": "^17.2.1",
    "express": "^5.1.0",
    "mysql2": "^3.14.4",
    "zod": "^4.1.5"
  },
  "devDependencies": {
    "@eslint/js": "^9.34.0",
    "@types/express": "^5.0.3",
    "@types/node": "^24.3.0",
    "@types/supertest": "^6.0.3",
    "eslint": "^9.34.0",
    "globals": "^16.3.0",
    "supertest": "^7.1.4",
    "tsx": "^4.20.5",
    "typescript": "^5.9.2",
    "typescript-eslint": "^8.41.0",
    "vitest": "^3.2.4"
  }
}

```

- `dev` uses `tsx watch` so Node can execute TypeScript directly and restart when source changes.
- `build` compiles TypeScript into `server/dist`.
- `start` runs compiled JavaScript, which is what PM2 should run in production.
- `lint`, `test`, and `typecheck` provide focused verification.
- Runtime dependencies: `dotenv` loads `.env`, `express` handles HTTP, `mysql2` connects to MariaDB, `zod` validates configuration, and `@capstone/shared` supplies contracts.
- Development dependencies provide TypeScript types, ESLint, Vitest, Supertest, and the `tsx` development runner.

## `server/tsconfig.json`

**Purpose.** Compiles server source into Node-compatible ESM.

**Actual code/configuration.** This is the current file being explained:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "sourceMap": true,
    "declaration": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}

```

- `NodeNext` matches the package's `type: module` setting and explains why local imports end in `.js`: TypeScript resolves them to `.ts` during development but emits valid Node imports.
- `rootDir`/`outDir` keep source and builds separate.
- Source maps and declarations improve debugging and future reuse.
- Node types provide definitions for `process`, paths, signals, and other runtime APIs.
- Tests are excluded from production output but still checked when Vitest runs them.

## `server/eslint.config.js`

**Purpose.** Applies JavaScript and TypeScript recommended rules in a Node environment.

**Actual code/configuration.** This is the current file being explained:

```js
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
);
```

`globals.node` tells ESLint that Node globals are valid. The unused-argument rule ignores names beginning with `_`; Express middleware sometimes requires positional parameters such as `_next` even when this implementation does not read them.

## `server/src/config/env.ts`

**Purpose.** Loads environment variables once, validates them, applies safe defaults, and exports a typed configuration object.

**Actual code/configuration.** This is the current file being explained:

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotEnv } from 'dotenv';
import { z } from 'zod';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
loadDotEnv({ path: path.join(repositoryRoot, '.env') });

const emptyStringToUndefined = (value: unknown) => value === '' ? undefined : value;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_PORT: z.coerce.number().int().positive().max(65535).default(3001),
  APP_BASE_PATH: z.string().default('/'),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().max(65535).default(3306),
  DB_SOCKET: z.preprocess(emptyStringToUndefined, z.string().optional()),
  DB_USER: z.string().min(1).default('capstone_user'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().min(1).default('capstone'),
  SESSION_SECRET: z.string().default('development-only-change-me'),
});

export const env = envSchema.parse(process.env);

```

The imports use Node path/URL utilities, `dotenv`, and Zod. Because ESM does not provide CommonJS `__dirname`, the `repositoryRoot` and `loadDotEnv` lines convert `import.meta.url` into a real path, walk up to the repository root, and load its `.env` file.

`emptyStringToUndefined` makes `DB_SOCKET=` behave as “not configured.” Without preprocessing, an empty string would be truthy/valid in some validation patterns but unusable as a socket path.

`envSchema` defines every accepted variable. `z.coerce.number()` converts text environment variables to numbers, then checks integer, positive, and port-range constraints. `NODE_ENV` accepts only three known modes. Required names must contain at least one character. Defaults make the skeleton easy to run while `.env.example` teaches proper configuration.

Finally, `envSchema.parse(process.env)` fails fast during startup if configuration is invalid and exports fully typed `env` values.

**Connections.** Imported by `server.ts`, `app.ts`, and `db/pool.ts`. Centralization prevents scattered `process.env` reads and inconsistent parsing.

## `server/src/db/pool.ts`

**Purpose.** Owns the MariaDB connection pool and its lifecycle.

**Actual code/configuration.** This is the current file being explained:

```ts
import mysql, { type Pool, type PoolOptions } from 'mysql2/promise';
import { env } from '../config/env.js';

let pool: Pool | undefined;

function connectionOptions(): PoolOptions {
  const transport = env.DB_SOCKET
    ? { socketPath: env.DB_SOCKET }
    : { host: env.DB_HOST, port: env.DB_PORT };

  return {
    ...transport,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    connectionLimit: 10,
    timezone: 'Z',
  };
}

export function getDatabasePool(): Pool {
  pool ??= mysql.createPool(connectionOptions());
  return pool;
}

export async function checkDatabaseConnection(): Promise<void> {
  await getDatabasePool().query('SELECT 1');
}

export async function closeDatabasePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

```

- `mysql2/promise` provides promise-based SQL methods suitable for `async`/`await`.
- Module-level `pool` holds one shared pool instead of opening a new connection for every request.
- `connectionOptions` chooses a Unix socket when `DB_SOCKET` exists; otherwise it uses local/network host and port. It then adds credentials, schema, a ten-connection limit, and UTC handling.
- `getDatabasePool` uses nullish assignment (`??=`) for lazy initialization. No real database connection is needed merely to import the app or test `/api/health`.
- `checkDatabaseConnection` runs the minimal `SELECT 1` readiness query.
- `closeDatabasePool` ends all connections during shutdown and clears the variable so tests or later startup can create a fresh pool.

**Connections.** `server.ts` closes the pool on process signals. Future repositories/services will call `getDatabasePool()` for parameterized SQL.

## `server/src/routes/health.ts`

**Purpose.** Implements the liveness endpoint at `GET /api/health`.

**Actual code/configuration.** This is the current file being explained:

```ts
import { Router } from 'express';
import type { HealthResponse } from '@capstone/shared';

export const healthRouter: Router = Router();

healthRouter.get('/', (_request, response) => {
  const body: HealthResponse = {
    data: {
      status: 'ok',
      service: 'capstone-api',
      timestamp: new Date().toISOString(),
    },
  };

  response.json(body);
});
```

`Router()` creates a small route module rather than putting every endpoint in `app.ts`. The imported `HealthResponse` is type-only, so it is erased from JavaScript.

The GET handler ignores the request, constructs a typed response with fixed status/service values and a fresh ISO timestamp, and sends JSON. It deliberately does not query MariaDB: liveness answers “is the HTTP process running?” A future readiness endpoint can separately test dependencies.

**Connections.** Mounted at `/api/health` by `app.ts`; verified by `app.test.ts`.

## `server/src/middleware/errorHandler.ts`

**Purpose.** Provides one final handler for unexpected Express errors.

**Actual code/configuration.** This is the current file being explained:

```ts
import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error('Unexpected request error', error);
  response.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    },
  });
};

```

The `ErrorRequestHandler` type guarantees Express's four-argument error-middleware signature. It logs the real error on the server, then returns a stable JSON error code and safe message. It does not expose stack traces, SQL details, or secrets to the browser. Underscored unused arguments preserve the required signature while satisfying lint rules.

**Connections.** Registered last in `app.ts`, so earlier middleware/routes can pass errors to it.

## `server/src/app.ts`

**Purpose.** Constructs and configures the Express application without opening a network port. Separating creation from listening makes integration tests easy.

**Actual code/configuration.** This is the current file being explained:

```ts
import express, { type Express } from 'express';
import path from 'node:path';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { env } from './config/env.js';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/health', healthRouter);

  if (env.NODE_ENV === 'production') {
    const clientDist = path.resolve(process.cwd(), 'client/dist');
    app.use(express.static(clientDist));
    app.get(/^(?!\/api(?:\/|$)).*/, (_request, response) => {
      response.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
```

The function disables the identifying `X-Powered-By` header and limits JSON request bodies to 1 MB. It mounts health routes before static/fallback handling so API requests cannot accidentally receive HTML.

In production, it resolves `client/dist`, serves hashed static assets, and uses a regular-expression fallback for all non-API routes. Sending `index.html` for `/app/history` allows React Router to decide which page to render after a browser refresh.

The error handler is last. Returning the app lets `server.ts` listen normally while Supertest calls it directly without occupying a port.

**Connections.** Imports configuration, routes, and middleware. Used by both `server.ts` and `app.test.ts`.

## `server/src/server.ts`

**Purpose.** This is the executable server entry point.

**Actual code/configuration.** This is the current file being explained:

```ts
import { createApp } from './app.js';
import { env } from './config/env.js';
import { closeDatabasePool } from './db/pool.js';

const app = createApp();
const server = app.listen(env.APP_PORT, '127.0.0.1', () => {
  console.log(`Capstone API listening on http://127.0.0.1:${env.APP_PORT}`);
});

async function shutDown(signal: string) {
  console.log(`${signal} received; shutting down.`);
  server.close(async () => {
    await closeDatabasePool();
    process.exit(0);
  });
}

process.on('SIGINT', () => { void shutDown('SIGINT'); });
process.on('SIGTERM', () => { void shutDown('SIGTERM'); });

```

- It creates the Express app and listens on configured `APP_PORT` at `127.0.0.1`. Binding to loopback fits the documented Apache reverse-proxy architecture rather than exposing an arbitrary Node port publicly.
- The callback logs where the API is listening.
- `shutDown` stops accepting requests, waits for the HTTP server to close, closes MariaDB connections, and exits cleanly.
- `SIGINT` handles Ctrl+C; `SIGTERM` handles process-manager shutdown. `void` explicitly discards the returned Promise inside the synchronous event callback.

**Connections.** PM2 ultimately runs compiled `server/dist/server.js`. It composes `app.ts`, `env.ts`, and `db/pool.ts`.

## `server/src/app.test.ts`

**Purpose.** Integration-tests the health route and its response contract.

**Actual code/configuration.** This is the current file being explained:

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('GET /api/health', () => {
  it('returns the service health envelope', async () => {
    const response = await request(createApp()).get('/api/health').expect(200);
    expect(response.body.data).toMatchObject({ status: 'ok', service: 'capstone-api' });
    expect(response.body.data.timestamp).toEqual(expect.any(String));
  });
});

```

Supertest sends a request directly to `createApp()` without starting a real port. Vitest's `describe` groups the behavior and `it` names the expected outcome. `.expect(200)` checks HTTP success. `toMatchObject` checks stable fields without caring about the changing timestamp, while `expect.any(String)` confirms a timestamp exists.

**Connections.** Protects `app.ts` and `health.ts`; run by `npm test` or the server workspace test script.

# Client package

## `client/package.json`

**Purpose.** Declares the browser workspace and its commands.

**Actual code/configuration.** This is the current file being explained:

```json
{
  "name": "@capstone/client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "test": "vitest run",
    "typecheck": "tsc -b --pretty false"
  },
  "dependencies": {
    "@capstone/shared": "0.1.0",
    "@vitejs/plugin-react": "^5.0.2",
    "vite": "^7.1.4",
    "typescript": "^5.9.2",
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "react-router-dom": "^7.8.2"
  },
  "devDependencies": {
    "@eslint/js": "^9.34.0",
    "@testing-library/jest-dom": "^6.8.0",
    "@testing-library/react": "^16.3.0",
    "@types/react": "^19.1.12",
    "@types/react-dom": "^19.1.9",
    "eslint": "^9.34.0",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.20",
    "globals": "^16.3.0",
    "jsdom": "^26.1.0",
    "typescript-eslint": "^8.41.0",
    "vitest": "^3.2.4"
  }
}

```

- `dev: vite` runs the development server with hot module replacement.
- `build` type-checks project references and then asks Vite for optimized static assets.
- `lint`, `test`, and `typecheck` run client-specific quality checks.
- Runtime dependencies provide React, DOM rendering, routing, and the local shared package. Vite, its React plugin, and TypeScript are currently listed with dependencies so the workspace can always build; testing and lint packages are development-only.
- React Testing Library tests what a user can find in the rendered DOM. jsdom supplies a simulated browser to Node-based Vitest.

**Connections.** Invoked by the root workspace scripts. `vite.config.ts` and the client TypeScript/ESLint files configure these tools.

## `client/tsconfig.json`

**Purpose.** Acts as a TypeScript project-reference coordinator rather than compiling files itself.

**Actual code/configuration.** This is the current file being explained:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}

```

`files: []` means the root client project has no direct source. Its references split browser application settings (`tsconfig.app.json`) from Node-run configuration settings (`tsconfig.node.json`). This avoids pretending browser globals and Node globals are interchangeable.

## `client/tsconfig.app.json`

**Purpose.** Type-checks React/browser source.

**Actual code/configuration.** This is the current file being explained:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}

```

- It extends strict root rules and targets modern ES2022 browsers.
- DOM libraries define browser APIs such as `document`.
- JavaScript source is disallowed so the app stays consistently typed.
- `moduleResolution: Bundler` matches Vite's import behavior.
- `isolatedModules` ensures each file can be transformed independently, as Vite does.
- `noEmit` leaves JavaScript generation to Vite.
- `jsx: react-jsx` uses the modern JSX transform, so components do not need `import React` solely for JSX.
- Only `src` belongs to the browser application project.

## `client/tsconfig.node.json`

**Purpose.** Type-checks build-tool configuration files.

**Actual code/configuration.** This is the current file being explained:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["vite.config.ts", "eslint.config.js"]
}

```

It is a composite project so `tsc -b` can manage it as a reference. ESNext/Bundler settings match Vite's config loader. `allowImportingTsExtensions` supports configuration imports when needed, while `noEmit` prevents duplicate output. The include list covers Vite and ESLint configs.

## `client/vite.config.ts`

**Purpose.** Configures the client build and development proxy.

**Actual code/configuration.** This is the current file being explained:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '');

  return {
    base: env.APP_BASE_PATH || '/',
    envDir: '..',
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: `http://localhost:${env.APP_PORT || '3001'}`,
          changeOrigin: true,
        },
      },
    },
  };
});

```

`defineConfig` provides editor typing. Its callback receives the current mode, then `loadEnv(mode, '..', '')` loads variables from the repository root and does not restrict keys to Vite's usual `VITE_` prefix because these values configure the tool itself, not browser code.

- `base` supports hosting Pawprint below an Apache path.
- `envDir: '..'` points Vite at the root environment directory.
- `plugins: [react()]` enables JSX transformation and React Fast Refresh.
- The `/api` proxy forwards development API calls to Express. Client code can always request relative `/api/...` URLs, avoiding hard-coded production hosts and CORS complexity.
- `changeOrigin` updates the forwarded Host header for compatibility.

**Connections.** Reads the same `APP_PORT` convention as the server. Used automatically by `vite` and `vite build`.

## `client/eslint.config.js`

**Purpose.** Applies browser, TypeScript, React Hooks, and Fast Refresh lint rules.

**Actual code/configuration.** This is the current file being explained:

```js
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
);

```

The flat config ignores `dist`, layers recommended JavaScript/TypeScript rules, and targets `.ts`/`.tsx`. Browser globals make `document` valid. Hooks rules catch incorrect hook ordering/dependencies. The Fast Refresh rule warns when a component module exports incompatible extra values; allowing constants keeps harmless exports possible.

## `client/index.html`

**Purpose.** The one HTML entry document for the React single-page application.

**Actual code/configuration.** This is the current file being explained:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="A cozy personal tracking capstone application." />
    <title>Pawprint</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- The HTML5 doctype and `lang="en"` improve standards behavior and accessibility.
- UTF-8 supports normal Unicode text.
- The viewport meta tag makes layout sizing behave correctly across screens.
- Description and title provide browser/search metadata.
- `<div id="root">` is the empty mount point React takes over.
- The module script loads `src/main.tsx`; Vite rewrites this reference to the hashed production bundle during build.

**Connections.** `main.tsx` searches for `root`. Express serves the built version in production.

## `client/src/vite-env.d.ts`

**Purpose.** Adds compile-time declarations that are provided by Vite rather than ordinary TypeScript.

**Actual code/configuration.** This is the current file being explained:

```ts
/// <reference types="vite/client" />

declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
```

The triple-slash reference enables types for `import.meta.env`, including `BASE_URL`. The `*.module.css` declaration tells TypeScript that importing a CSS Module returns a read-only mapping from local class names to generated class strings.

**Connections.** Makes the environment access in `main.tsx` and CSS imports throughout components type-check.

## `client/src/main.tsx`

**Purpose.** Boots the React application in the browser.

**Actual code/configuration.** This is the current file being explained:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import './styles/globals.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

```

The imports bring in React strict checking, React's DOM root API, routing, the top-level `App`, and global CSS. `document.getElementById('root')` connects to `index.html`. The explicit missing-root error gives a clear failure rather than an obscure null error.

`createRoot(...).render(...)` starts React 18/19 concurrent rendering. `StrictMode` adds development checks and can intentionally run some lifecycle behavior twice to reveal unsafe side effects. `BrowserRouter` uses real browser history. Its `basename` comes from Vite so routing still works under a Turing proxy subpath. `App` then defines the route tree.

## `client/src/app/App.tsx`

**Purpose.** Defines all current client routes.

**Actual code/configuration.** This is the current file being explained:

```tsx
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { HomePage } from '../features/home/HomePage';
import { PlaceholderPage } from '../features/shell/PlaceholderPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/app" element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="insights" element={<PlaceholderPage title="Insights" />} />
        <Route path="history" element={<PlaceholderPage title="History" />} />
        <Route path="tracking" element={<PlaceholderPage title="Tracking" />} />
        <Route path="habits" element={<PlaceholderPage title="Habits" />} />
        <Route path="decorate" element={<PlaceholderPage title="Decorate" />} />
        <Route path="settings" element={<PlaceholderPage title="Settings" />} />
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

```

- `/` redirects to `/app` with `replace`, so the temporary redirect does not remain as a confusing Back-button entry.
- `/app` renders `AppShell`. Nested routes render inside its `<Outlet>`.
- The index nested route displays `HomePage`.
- Insights, History, Tracking, Habits, Decorate, and Settings currently reuse a title-only `PlaceholderPage`.
- Relative child paths automatically become `/app/insights`, etc.
- The final wildcard catches unknown paths and returns users to Home.

**Connections.** Mounted by `main.tsx`; imports the shell and feature pages. React Router matches this tree whenever the URL changes.

## `client/src/app/AppShell.tsx`

**Purpose.** Provides persistent page chrome shared by all `/app` routes.

**Actual code/configuration.** This is the current file being explained:

```tsx
import { NavLink, Outlet } from 'react-router-dom';
import styles from './AppShell.module.css';

const links = [
  ['Home', '/app'],
  ['Tracking', '/app/tracking'],
  ['History', '/app/history'],
  ['Insights', '/app/insights'],
] as const;

export function AppShell() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <NavLink className={styles.brand!} to="/app">Pawprint</NavLink>
        <nav aria-label="Primary navigation" className={styles.navigation!}>
          {links.map(([label, path]) => (
            <NavLink key={path} to={path} end={path === '/app'}>
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className={styles.main!}>
        <Outlet />
      </main>
    </div>
  );
}
```

The `links` tuple is data rather than repeated markup. `as const` preserves exact read-only strings, improving TypeScript inference. `map` turns each tuple into a `NavLink`; `key={path}` gives React stable list identity. `end` is true only for Home so `/app` is not also considered active at `/app/history`.

`NavLink` automatically adds `aria-current="page"` to the active link, which CSS uses and assistive technology understands. The brand links home. `<Outlet>` is the slot where React Router places the matched child page.

The CSS values use non-null assertions (`!`) because the generic CSS-module declaration allows any lookup to be undefined under strict indexed-access checking, while these literal classes are known to exist.

## `client/src/app/AppShell.module.css`

**Purpose.** Styles only `AppShell`; CSS Modules prevent class-name collisions elsewhere.

**Actual code/configuration.** This is the current file being explained:

```css
.shell { min-height: 100vh; }
.header { display: flex; align-items: center; justify-content: space-between; gap: 2rem; padding: 1rem 2rem; background: var(--surface); border-bottom: 1px solid var(--border); }
.brand { color: var(--text); font-size: 1.2rem; font-weight: 750; text-decoration: none; }
.navigation { display: flex; gap: 1rem; }
.navigation a { color: var(--text-muted); font-weight: 650; text-decoration: none; }
.navigation a[aria-current='page'] { color: var(--accent-strong); }
.main { width: min(1120px, calc(100% - 3rem)); margin: 0 auto; padding: 3rem 0; }

```

- `.shell` keeps the layout at least viewport height.
- `.header` uses flexbox to separate brand and navigation, then applies theme surface and border tokens.
- `.brand` and navigation links remove default underlines and establish visual hierarchy.
- `[aria-current='page']` styles the semantic active-state attribute produced by `NavLink`.
- `.main` caps readable width while staying fluid and centers content with auto margins.

**Connections.** Imported as `styles` by `AppShell.tsx`; consumes variables defined in `tokens.css`.

## `client/src/app/App.test.tsx`

**Purpose.** Smoke-tests that routing produces the Home screen.

**Actual code/configuration.** This is the current file being explained:

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the application home shell', () => {
    render(<MemoryRouter initialEntries={['/app']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Cat Room' })).toBeInTheDocument();
  });
});
```

The file-level Vitest comment chooses jsdom. jest-dom adds matchers such as `toBeInTheDocument`. React Testing Library renders the real `App` inside `MemoryRouter`, which supplies an in-memory URL without a browser server. Starting at `/app` should expose an accessible heading named “Cat Room.” Querying by role and name tests user-visible semantics rather than fragile CSS selectors.

## `client/src/features/home/HomePage.tsx`

**Purpose.** Renders the current centered Cat Room placeholder.

**Actual code/configuration.** This is the current file being explained:

```tsx
import styles from './HomePage.module.css';

export function HomePage() {
  return (
    <section className={styles.home!} aria-labelledby="cat-room-title">
      <div className={styles.room!}>
        {/* TODO: Cat-room art and animation are deferred. */}
        <h1 id="cat-room-title">Cat Room</h1>
      </div>
    </section>
  );
}
```

The component imports its local CSS Module and returns semantic structure. `aria-labelledby` names the section using the heading's `id`, so screen readers understand the region. The TODO records the explicit scope choice to defer room art and animation. The only visible room text is the `h1` “Cat Room.”

**Connections.** Used as the `/app` index route by `App.tsx`; styled by the neighboring CSS Module.

## `client/src/features/home/HomePage.module.css`

**Purpose.** Creates the temporary room composition without art assets.

**Actual code/configuration.** This is the current file being explained:

```css
.home {
  min-height: calc(100vh - 11rem);
  display: grid;
  place-items: center;
}

.room {
  width: min(52rem, 88vw);
  min-height: min(32rem, 65vh);
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 2rem;
  background: linear-gradient(
    to bottom,
    var(--sky) 0 58%,
    var(--floor) 58% 100%
  );
  box-shadow: var(--shadow);
}

.room h1 {
  margin: 0;
  padding: 0.7rem 1.25rem;
  border-radius: 999px;
  background: rgb(255 255 255 / 82%);
  color: var(--text);
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  line-height: 1;
}
```

`.home` fills the remaining viewport area and uses CSS Grid's `place-items: center` to center the room both horizontally and vertically. The `11rem` subtraction accounts approximately for header and main padding.

`.room` uses `min()` to cap width/height while remaining usable on smaller screens. Grid centers the label. Rounded border, theme tokens, and shadow follow the reference UI's friendly card language. The linear gradient paints blue sky through 58% and green floor below it; no image or animation is involved.

The heading is placed on a translucent white pill for contrast. `clamp()` scales text between minimum and maximum sizes based on viewport width.

## `client/src/features/shell/PlaceholderPage.tsx`

**Purpose.** Avoids creating six nearly identical temporary components.

**Actual code/configuration.** This is the current file being explained:

```tsx
interface PlaceholderPageProps { title: string; }

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <section>
      <h1>{title}</h1>
    </section>
  );
}
```

`PlaceholderPageProps` requires one string `title`. Destructuring extracts that prop, and JSX renders only a semantic section and heading. Different route declarations pass different titles. Later, real feature pages will replace these placeholders independently.

## `client/src/styles/tokens.css`

**Purpose.** Centralizes design values as CSS custom properties.

**Actual code/configuration.** This is the current file being explained:

```css
:root {
  --background: #f5efe3;
  --surface: #fffaf1;
  --text: #3c352f;
  --text-muted: #6f665d;
  --border: #ddcfbc;
  --accent: #b7cda3;
  --accent-strong: #6d8460;
  --sky: #bfe7f5;
  --floor: #79b968;
  --shadow: 0 18px 45px rgb(76 62 44 / 10%);
}
```

`:root` makes variables available throughout the document. Background, surface, text, muted text, border, and accents establish the cream/sage theme. `--sky` and `--floor` drive the room gradient. `--shadow` provides one reusable elevation style. Central tokens prevent components from scattering slightly different color literals and make later visual tuning much easier.

## `client/src/styles/globals.css`

**Purpose.** Applies the minimal global reset, typography, and keyboard accessibility.

**Actual code/configuration.** This is the current file being explained:

```css
@import './tokens.css';
* { box-sizing: border-box; }
html { background: var(--background); color: var(--text); font-family: Inter, ui-rounded, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
body { margin: 0; min-width: 320px; min-height: 100vh; }
button, a { outline-offset: 3px; }
button:focus-visible, a:focus-visible { outline: 3px solid var(--accent-strong); }

```

- It imports tokens first.
- Universal `border-box` makes declared widths include padding and borders, simplifying layout math.
- The `html` rule sets global theme colors and a rounded system-font fallback stack without downloading a font.
- `body` removes browser margin, protects a minimum width, and fills the viewport.
- Focus rules move outlines away from controls and show a visible accent outline only for keyboard-style focus (`:focus-visible`), preserving accessibility without constant mouse-click rings.

**Connections.** Imported once by `main.tsx`; supplies global foundations and variables used by CSS Modules.

# Project documentation

The six specification documents are not executable, but they control what executable code should become. Their headings are the meaningful “blocks,” so each explanation below follows those blocks rather than restating hundreds of individual prose lines.

## `docs/PRODUCT.md`

**Purpose.** Defines what Pawprint is, its ethical boundaries, user experience, trackers, game layer, and explicit non-goals.

- Sections 1–4 establish document authority, capstone status/deadlines, the cozy tracking vision, and the one-sentence definition.
- Section 5 sets non-negotiable principles: track rather than diagnose, preserve missing values, keep logging understandable, use the game layer as motivation, remain cozy, and prioritize desktop.
- Sections 6–7 describe the target journey and repeated track/reward/learn loop.
- Section 8 limits the companion to one primary cat and outlines eventual cat/room behavior.
- Section 9 defines each data concept and scale: mood 1–5, generalized pain 0–10, symptom severity 0–4, contextual factor tags, sleep, medication, habits, and deferred food/water.
- Sections 10–13 define flexible check-ins, short onboarding, home hierarchy, and navigation levels.
- Section 14 separates pixel-art world assets from accessible modern application UI.
- Sections 15–20 cover gamification, history, core insights, cautious language, minimal administration, and the synthetic demo account.
- Sections 21–22 prevent scope drift and define capstone success.

**Connections.** `MVP.md` turns this vision into priorities; UI, architecture, database, and analytics specs provide specialized implementation rules.

## `docs/MVP.md`

**Purpose.** Converts the product vision into semester scope, acceptance criteria, sequence, and deadlines.

- Sections 1–3 define scope discipline, deadlines, and what “MVP” means for this capstone.
- Section 4 lists P0 requirements: foundation, auth, onboarding, home, tracking domains, history, analytics, demo data, deployment, and presentation reliability.
- Section 5 lists strongly preferred P1 engagement/polish work.
- Sections 6–7 separate stretch ideas and explicit semester non-goals.
- Section 8 expresses completion through user journeys, making requirements testable.
- Section 9 orders implementation into ten phases; this repository currently represents Phase 1 plus the simplest visual shell.
- Section 10 maps sponsor targets to dates.
- Sections 11–12 define “done” across frontend/server/database/authorization/testing and provide the scope rule for new ideas.

**Connections.** Root scripts and current skeleton satisfy the initial foundation items. Future work should follow this build order.

## `docs/UI_DESIGN.md`

**Purpose.** Defines Pawprint's visual and interaction language.

- Sections 1–4 establish cozy/playful/readable goals, desktop target, the pixel-art plus modern-UI split, and tokenized palette.
- Sections 5–6 govern Mega Cat and Sprout Lands asset use and crisp integer pixel scaling.
- Sections 7–9 describe the centered home world, room layering, navigation hierarchy, overlays, and full pages.
- Sections 10–17 specify controls and flows for mood, pain, symptoms, factors, check-ins, sleep, medication, and habits.
- Sections 18–21 define Insights, History, empty/loading/error states.
- Sections 22–23 set accessibility and motion baselines.
- Sections 24–26 choose CSS Modules, identify reusable component candidates, and give a presentation-quality checklist.

**Connections.** `tokens.css`, Home styles, and the UI screenshot rule implement the earliest part of this direction.

## `docs/ARCHITECTURE.md`

**Purpose.** Locks the full-stack design and explains how it develops and deploys.

- Sections 1–4 select React/Vite/Express/TypeScript/MariaDB and explicitly reject unnecessary frameworks/services.
- Sections 5–8 show development and Turing runtime diagrams, deployment rules, repository organization, and npm workspaces.
- Sections 9–10 split frontend features/services from backend routes/services/repositories/analytics.
- Sections 11–12 define REST endpoints and consistent JSON envelopes.
- Sections 13–18 govern sessions, password hashing, `mysql2`, SQL migrations, Zod validation, UTC timestamps, and logical dates.
- Sections 19–22 cover production SPA serving, Node analytics, optional Python validation, and lightweight sprite/state architecture.
- Sections 23–26 establish error handling, security, testing, and logging.
- Sections 27–30 define scripts, PM2 startup, deployment updates, and success criteria.

**Connections.** The current file tree, proxy, static serving, environment parser, and connection pool directly implement its Phase 1 decisions.

## `docs/DATABASE.md`

**Purpose.** Specifies future MariaDB entities, constraints, ownership, and transaction rules.

- Sections 1–3 explain flexible check-ins and separate event types, then classify P0 versus P1 entities.
- Sections 4–19 define SQL-shaped models for users/profiles/preferences, check-ins, mood, pain, factors, symptoms, sleep, medication, and game state.
- Sections 20–23 defer habits, coin ledger, inventory, and room placement to P1.
- Section 24 defines logical tracking dates.
- Sections 25–28 require session-derived ownership, cascading deletes, bounded values, and atomic check-in transactions.
- Sections 29–30 describe analytics query shapes and practical indexes.
- Sections 31–33 govern stable seeds, deterministic demo data, and the presentation explanation.

**Connections.** `db/pool.ts` provides transport only; schema/migrations intentionally have not been implemented yet. Future SQL must follow this document.

## `docs/ANALYTICS.md`

**Purpose.** Defines server-side statistical calculations and safe user-facing interpretation.

- Sections 1–4 establish descriptive, non-causal analysis and separate check-in from day-level data.
- Sections 5–8 define daily means, ranges, summaries, and trend charts.
- Sections 9–11 specify minimum samples and factor group comparisons/effect sizes.
- Sections 12–17 choose Spearman correlation, tie handling, strength/direction language, candidate pairs, and sleep-day alignment.
- Sections 18–20 cover weekday/time patterns and ranked pattern cards.
- Sections 21–27 limit significance claims, multiple comparisons, missing/outlier handling, note analysis, and machine learning.
- Sections 28–30 define API shapes, module layout, and required tests.
- Sections 31–32 define deterministic but noisy demo relationships.
- Sections 33–36 provide language templates, disclaimer, presentation story, and definition of done.

**Connections.** Future server analytics modules and tests must implement these formulas; the client should only render server-calculated results.

## `docs/UI_REFERENCE.md`

**Purpose.** Makes the Finch and Bearable screenshots an explicit design rule.

The first block identifies both folders. The rule then extracts transferable qualities—rounded typography, generous spacing, clear hierarchy, approachable controls, sky backgrounds, and green/teal accents—while forbidding literal brand copying or allowing mobile references to override Pawprint's desktop-first specifications.

**Connections.** Complements `UI_DESIGN.md`; current room colors and rounded surfaces begin applying it.

# UI reference image inventory

These PNG files are design evidence, not application source. They contain no executable lines, imports, functions, or variables, and Vite does not bundle them. Their connection to the product is governed by `docs/UI_REFERENCE.md` and `docs/UI_DESIGN.md`.

## `docs/Finch UI/UI interfaces for Finch/`

**Purpose.** This folder contains 69 sequential Finch screenshots. As a set, they demonstrate companion-centered presentation, generous whitespace, rounded typography and controls, clear primary/secondary actions, green emphasis, and friendly onboarding/task flows. Pawprint should learn from those qualities without copying Finch branding or its mobile layout.

**What to inspect.** Compare how hierarchy is created through scale rather than clutter; how one primary action dominates a screen; how the companion adds warmth without replacing functional text; and how disabled, secondary, and active choices remain visually distinct.

**Connections.** Designers and implementers consult this folder when refining Pawprint components. No TypeScript or CSS imports these files.

**Files (69):**

```text
IMG_8649.PNG IMG_8650.PNG IMG_8651.PNG IMG_8652.PNG IMG_8653.PNG IMG_8654.PNG IMG_8655.PNG 
IMG_8656.PNG IMG_8657.PNG IMG_8658.PNG IMG_8659.PNG IMG_8660.PNG IMG_8661.PNG IMG_8662.PNG 
IMG_8663.PNG IMG_8664.PNG IMG_8665.PNG IMG_8666.PNG IMG_8667.PNG IMG_8668.PNG IMG_8669.PNG 
IMG_8670.PNG IMG_8671.PNG IMG_8672.PNG IMG_8673.PNG IMG_8674.PNG IMG_8675.PNG IMG_8676.PNG 
IMG_8677.PNG IMG_8678.PNG IMG_8679.PNG IMG_8680.PNG IMG_8681.PNG IMG_8682.PNG IMG_8683.PNG 
IMG_8684.PNG IMG_8685.PNG IMG_8686.PNG IMG_8687.PNG IMG_8688.PNG IMG_8689.PNG IMG_8690.PNG 
IMG_8691.PNG IMG_8692.PNG IMG_8693.PNG IMG_8694.PNG IMG_8695.PNG IMG_8696.PNG IMG_8697.PNG 
IMG_8698.PNG IMG_8699.PNG IMG_8700.PNG IMG_8701.PNG IMG_8702.PNG IMG_8703.PNG IMG_8704.PNG 
IMG_8705.PNG IMG_8706.PNG IMG_8707.PNG IMG_8708.PNG IMG_8709.PNG IMG_8710.PNG IMG_8711.PNG 
IMG_8712.PNG IMG_8713.PNG IMG_8714.PNG IMG_8715.PNG IMG_8716.PNG IMG_8717.PNG
```

## `docs/Bearable UI/Bearable UI/`

**Purpose.** This folder contains 113 sequential Bearable screenshots. As a set, they demonstrate sky-toned backgrounds, approachable health-input controls, soft cards, readable information density, progress/onboarding patterns, and teal emphasis. Pawprint uses these as interaction and hierarchy references, not as a template to duplicate.

**What to inspect.** Study how complex tracking choices are broken into understandable groups, how cards separate information, how labels and controls remain legible, and how empty space lowers visual stress. Keep Pawprint desktop-first and retain its cat-room identity.

**Connections.** These screens inform future check-in, onboarding, history, and insights work under the limits in the specifications. They are never served as Pawprint assets.

**Files (113):**

```text
IMG_8718.PNG IMG_8719.PNG IMG_8720.PNG IMG_8721.PNG IMG_8722.PNG IMG_8723.PNG IMG_8724.PNG 
IMG_8725.PNG IMG_8726.PNG IMG_8727.PNG IMG_8728.PNG IMG_8729.PNG IMG_8730.PNG IMG_8731.PNG 
IMG_8732.PNG IMG_8733.PNG IMG_8734.PNG IMG_8735.PNG IMG_8736.PNG IMG_8737.PNG IMG_8738.PNG 
IMG_8739.PNG IMG_8740.PNG IMG_8741.PNG IMG_8742.PNG IMG_8743.PNG IMG_8744.PNG IMG_8745.PNG 
IMG_8746.PNG IMG_8747.PNG IMG_8748.PNG IMG_8749.PNG IMG_8750.PNG IMG_8751.PNG IMG_8752.PNG 
IMG_8753.PNG IMG_8754.PNG IMG_8755.PNG IMG_8756.PNG IMG_8757.PNG IMG_8758.PNG IMG_8759.PNG 
IMG_8760.PNG IMG_8761.PNG IMG_8762.PNG IMG_8763.PNG IMG_8764.PNG IMG_8765.PNG IMG_8766.PNG 
IMG_8767.PNG IMG_8768.PNG IMG_8769.PNG IMG_8770.PNG IMG_8771.PNG IMG_8772.PNG IMG_8773.PNG 
IMG_8774.PNG IMG_8775.PNG IMG_8776.PNG IMG_8777.PNG IMG_8778.PNG IMG_8779.PNG IMG_8780.PNG 
IMG_8781.PNG IMG_8782.PNG IMG_8783.PNG IMG_8784.PNG IMG_8785.PNG IMG_8786.PNG IMG_8787.PNG 
IMG_8788.PNG IMG_8789.PNG IMG_8790.PNG IMG_8791.PNG IMG_8792.PNG IMG_8793.PNG IMG_8794.PNG 
IMG_8795.PNG IMG_8796.PNG IMG_8797.PNG IMG_8798.PNG IMG_8799.PNG IMG_8800.PNG IMG_8801.PNG 
IMG_8802.PNG IMG_8803.PNG IMG_8804.PNG IMG_8805.PNG IMG_8806.PNG IMG_8807.PNG IMG_8808.PNG 
IMG_8809.PNG IMG_8810.PNG IMG_8811.PNG IMG_8812.PNG IMG_8813.PNG IMG_8814.PNG IMG_8815.PNG 
IMG_8816.PNG IMG_8817.PNG IMG_8818.PNG IMG_8819.PNG IMG_8820.PNG IMG_8821.PNG IMG_8822.PNG 
IMG_8823.PNG IMG_8824.PNG IMG_8825.PNG IMG_8826.PNG IMG_8827.PNG IMG_8828.PNG IMG_8829.PNG 
IMG_8830.PNG
```

# Commands and tooling used

## Installation and environment

The normal project setup commands are:

```bash
npm install
cp .env.example .env
npm run dev
```

- `npm install` reads all four `package.json` manifests, downloads dependencies, and links npm workspaces. Run it after cloning and whenever dependency declarations change.
- `cp .env.example .env` creates a local configuration file from the safe template. Replace placeholder database values; never commit `.env`.
- `npm run dev` builds shared contracts once, then runs the shared watcher, Express watcher, and Vite server together.

The constrained implementation environment did not expose a normal `npm` executable, so dependency verification there used its bundled pnpm fallback:

```bash
pnpm install --store-dir .pnpm-store
```

That command served only to download/link the same declared dependencies for verification. Temporary pnpm caches and its lockfile were not kept; npm workspaces remain the documented project workflow.

No scaffolding generator such as `create-vite`, Create React App, Express Generator, an ORM CLI, or a database migration CLI was used. The small structure was written directly so every configuration decision stays visible.

## Quality and build commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run start
```

- `typecheck` runs TypeScript without producing application output. It catches incompatible props, imports, environment use, and API contracts.
- `lint` applies ESLint's JavaScript, TypeScript, React Hooks, browser, and Node rules.
- `test` runs Vitest in every workspace. The shared package currently passes with no test files; client and server each have a smoke/integration test.
- `build` emits `shared/dist`, produces optimized browser files in `client/dist`, and compiles Express to `server/dist`.
- `start` runs compiled `server/dist/server.js`. Build first; this is production behavior rather than Vite development behavior.

Useful focused commands are:

```bash
npm run test --workspace=@capstone/client
npm run test --workspace=@capstone/server
npm run build --workspace=@capstone/shared
npm run build --workspace=@capstone/client
npm run build --workspace=@capstone/server
```

Workspace selection is useful when iterating on one layer. The full root commands should still run before committing.

## Manual endpoint checks

With development servers running:

```bash
curl --fail http://127.0.0.1:3001/api/health
```

`curl` makes an HTTP request, `--fail` returns a nonzero status for HTTP errors, and the endpoint should return the typed JSON envelope. Open `http://localhost:5173` in a browser to exercise the Vite client and proxy.

# Major choices: why this, not that

These choices optimize for a one-student capstone, a known Turing deployment environment, and code that can be explained during a presentation. A different project could reasonably choose differently.

## npm workspaces instead of Turborepo or Nx

npm workspaces provide local package linking and workspace-targeted commands with no additional orchestration system. Turborepo and Nx add powerful caching, dependency graphs, generators, and CI features, but those solve larger-team/large-repository problems and would add concepts without improving this three-package capstone yet.

## React and Vite instead of Next.js

React supplies component UI, and Vite supplies a fast development server and simple static production build. Next.js adds server rendering, file-based full-stack routing, and its own deployment conventions; Pawprint already has an explicitly selected Express server and does not need two overlapping backend models.

## Express instead of Next.js API routes or Fastify

Express has a small mental model—ordered middleware plus routes—and matches the university's documented Node deployment path. Fastify offers stronger built-in schemas and often higher throughput, but performance at Pawprint's scale is not the constraint; familiarity, ecosystem, and explainability are more valuable.

## TypeScript instead of plain JavaScript

Pawprint has contracts that cross browser, server, database, and analytics boundaries. TypeScript catches mismatched shapes and missing cases before runtime. The cost is additional configuration and occasional type annotations, which is justified for a semester-long application with many bounded health-data rules.

## ESM instead of CommonJS

ESM is the JavaScript standard used naturally by Vite and modern TypeScript. Keeping client, server, and shared packages on `import`/`export` avoids conversion boundaries; CommonJS remains common in older Node projects but would provide no benefit here.

## Zod instead of manual `if` checks

Zod keeps the expected shape, conversion, defaults, and error details in one composable schema and infers useful TypeScript types from runtime validation. Handwritten checks are dependency-free but become repetitive and easy to make inconsistent as forms and nested request bodies grow.

## `mysql2/promise` and direct SQL instead of Prisma or Sequelize

`mysql2` talks directly to the required MariaDB database, supports parameterized SQL, and makes the relational model visible for an academically defensible database component. Prisma or Sequelize could reduce some repetitive mapping, but they add schema/migration abstractions and generated behavior that are unnecessary before the query layer becomes genuinely painful.

## Connection pool instead of opening one connection per request

Database handshakes cost time and database resources. A bounded pool reuses a small number of connections across requests and queues excess work, which is both faster and safer. One global permanent connection would be fragile if it disconnects and would serialize or complicate concurrent work.

## Server-side sessions instead of JWT authentication

The documented application is same-origin and small-scale. Server-side sessions make logout/revocation straightforward and keep most authentication state off the client. JWTs are useful across distributed services, but secure rotation/revocation and token storage would add complexity without a Pawprint requirement.

## `bcryptjs` instead of native bcrypt or Argon2 (future auth milestone)

`bcryptjs` avoids native compilation risk on the Turing host while still providing salted, deliberately slow password hashing with an appropriate cost. Argon2 is a strong modern choice, but deployment reliability is more important for this capstone; raw fast hashes such as SHA-256 are never appropriate for passwords.

## Vitest instead of Jest

Vitest understands the same modern ESM/TypeScript/Vite environment as the client, reducing duplicated transforms and configuration. Jest is mature and widely used, but would need additional ESM/TypeScript setup here while providing little advantage for the current tests.

## React Testing Library instead of testing component internals

Testing roles and visible labels survives refactors better than asserting private state or exact component trees. It also encourages accessible markup. Snapshot-heavy or shallow-render tests can be quick to write but often pass while real user behavior breaks.

## Supertest instead of starting a real test port

Supertest invokes the Express app directly, so tests are fast, isolated, and do not collide on ports. A separate end-to-end suite may later test the deployed URL, but every API test should not require managing a background process.

## CSS Modules and tokens instead of Tailwind or a component framework

CSS Modules give local class isolation while leaving ordinary CSS visible to a student; shared custom properties centralize the theme. Tailwind or Material UI could accelerate broad UI construction, but would introduce another vocabulary or a generic visual identity that conflicts with Pawprint's custom cozy direction.

## React component state first instead of Redux

The current shell has no complex shared client state. React state and focused hooks keep data flow local and teach the platform fundamentals. Redux becomes valuable when many distant features coordinate state, but adding it before that pain exists creates boilerplate rather than clarity.

## One Express process instead of microservices

One process serves both API and built client behind Apache, which is easy to deploy, restart, debug, and explain. Microservices would add network failures, multiple deployments, service authentication, and observability needs while serving roughly a dozen capstone users.

## MariaDB instead of an embedded or hosted database service

MariaDB is the verified university production database and demonstrates relational modeling, joins, constraints, and transactions. SQLite is simpler locally but would diverge from deployment/concurrency behavior; hosted services such as Firebase or Supabase would bypass the chosen Turing architecture.

## Environment variables instead of committed configuration

Ports and credentials vary by machine and secrets do not belong in Git. `.env.example` documents the contract while `.env` supplies local values. Hard-coded settings look simpler initially but make deployment unsafe and brittle.

# How the files connect during one request

## Existing `GET /api/health` flow

1. The browser first loads `client/index.html` from Vite.
2. Its module script runs `client/src/main.tsx`.
3. `main.tsx` installs `BrowserRouter` and renders `App`.
4. `App.tsx` matches the URL and places a page inside `AppShell`'s `Outlet`.
5. CSS starts with `globals.css`/`tokens.css`; components add scoped CSS Modules.
6. A browser, `curl`, or test requests relative URL `/api/health`.
7. During development, `vite.config.ts` sees the `/api` prefix and proxies the request to `http://localhost:${APP_PORT}`. In production, Apache has already forwarded the public request to Express.
8. `server.ts` is listening on that port with the app created by `app.ts`.
9. Express processes middleware in registration order: the JSON parser runs, then `/api/health` matches `healthRouter`.
10. The router's path is `/` *relative to its mount point*, so it handles the full `/api/health` URL.
11. The handler creates a `HealthResponse` object and calls `response.json(body)`. Express serializes it as JSON and sets the content type.
12. The response travels back through the proxy to the caller. No MariaDB connection is created because the pool is lazy and health is only a liveness check.
13. `server/src/app.test.ts` covers the same path in memory with Supertest, skipping network/proxy layers while exercising Express and the router together.
14. In production, Express also serves the Vite build, so client and API share one origin behind Apache.

# Full POST request walkthrough

The check-in route below is **hypothetical teaching code based on the approved architecture**; it is not implemented yet. It demonstrates the intended happy and unhappy paths for a future `POST /api/check-ins`.

## 1. Client builds and sends the request

A future service module would centralize `fetch` rather than placing raw requests in components:

```ts
export async function createCheckIn(input: CreateCheckInInput) {
  const response = await fetch('/api/check-ins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const body: unknown = await response.json();
  if (!response.ok) throw new ApiError(response.status, body);
  return createCheckInResponseSchema.parse(body);
}
```

The component supplies values such as mood, pain, symptoms, and factor IDs. `JSON.stringify` converts the object to request text. The client checks `response.ok`, but client validation is never authoritative: a caller can bypass the UI.

## 2. Proxy and JSON middleware

Vite forwards `/api/check-ins` to Express in development. This existing line runs before routes:

```ts
app.use(express.json({ limit: '1mb' }));
```

It verifies JSON syntax, limits body size, parses the text, and assigns the result to `request.body`. Invalid JSON or an oversized body becomes an error before the route handler runs.

## 3. Authentication middleware identifies ownership

After the authentication milestone, session middleware would load the session and a small guard would require a user:

```ts
function requireUser(request: Request, _response: Response, next: NextFunction) {
  if (!request.session.userId) {
    return next(new AppError(401, 'AUTH_REQUIRED', 'Please log in.'));
  }
  next();
}
```

The client must not submit a trusted `userId`. The server derives ownership from the authenticated session, preventing one user from writing another user's data.

## 4. Route validates unknown input

TypeScript cannot prove a network body is safe, so Zod checks it at runtime:

```ts
const createCheckInSchema = z.object({
  occurredAt: z.iso.datetime(),
  mood: z.number().int().min(1).max(5).optional(),
  pain: z.number().int().min(0).max(10).optional(),
  symptoms: z.array(z.object({
    symptomId: z.number().int().positive(),
    severity: z.number().int().min(0).max(4),
  })).default([]),
  factorIds: z.array(z.number().int().positive()).default([]),
  note: z.string().trim().max(1000).optional(),
}).refine(
  value => value.mood !== undefined || value.pain !== undefined || value.symptoms.length > 0,
  { message: 'Record at least one measurement or symptom.' },
);

checkInsRouter.post('/', requireUser, async (request, response, next) => {
  try {
    const input = createCheckInSchema.parse(request.body);
    const checkIn = await checkInService.create(request.session.userId!, input);
    response.status(201).json({ data: checkIn });
  } catch (error) {
    next(error);
  }
});
```

Notice three boundaries: the router handles HTTP, Zod handles untrusted shape/ranges, and the service handles business rules. `201 Created` communicates successful creation more precisely than a generic `200`.

## 5. Service and repository perform an atomic write

The service calculates the logical date, confirms referenced symptoms/factors are built-in or owned by the user, and starts a transaction through the repository:

```ts
const connection = await getDatabasePool().getConnection();
try {
  await connection.beginTransaction();
  const checkInId = await insertCheckIn(connection, userId, input);
  if (input.mood !== undefined) await insertMood(connection, checkInId, input.mood);
  if (input.pain !== undefined) await insertPain(connection, checkInId, input.pain);
  await insertSymptoms(connection, checkInId, input.symptoms);
  await insertFactors(connection, checkInId, input.factorIds);
  await connection.commit();
  return await findCheckInById(connection, userId, checkInId);
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
}
```

If insert number four fails, rollback removes inserts one through three. `finally` releases the connection even after errors, returning it to the pool. SQL functions must use placeholders/parameters rather than string-concatenating user input.

## 6. Validation failure reaches the error handler

Suppose the client sends `pain: 12`. `createCheckInSchema.parse` throws a `ZodError`; the route catches it and calls `next(error)`. Express skips normal middleware and searches for four-argument error middleware.

The **current** `errorHandler.ts` treats every unexpected error as `500`. During the check-in milestone it should be extended to classify expected errors before the generic fallback:

```ts
export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Some submitted values are invalid.',
        fields: z.flattenError(error).fieldErrors,
      },
    });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  console.error('Unexpected request error', error);
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  });
};
```

The user receives `400 VALIDATION_ERROR`, the form keeps its unsaved state, and no SQL transaction starts. A duplicate/ownership/business failure becomes a typed `AppError` with an appropriate 4xx status. Truly unknown bugs are logged server-side and return a generic 500 without exposing internals.

This is the unhappy-path chain:

```text
invalid browser JSON value
  -> Vite proxy
  -> express.json
  -> requireUser
  -> Zod parse throws
  -> route catch calls next(error)
  -> errorHandler recognizes ZodError
  -> HTTP 400 JSON error
  -> client ApiError
  -> form displays fields and preserves input
```

# Troubleshooting and common errors

## `node: command not found` or `npm: command not found`

**Meaning:** Node/npm is not installed or the VS Code terminal has not loaded the shell configuration that exposes it.

**Fix:** install/use Node 24 (for example through `nvm`), close and reopen the terminal, then confirm `node --version` and `npm --version`. Make sure VS Code is opened in the same environment where Node was installed.

## `npm install` tries to download `@capstone/shared` from the registry

**Meaning:** npm did not recognize the root workspace or the local package name/version no longer matches.

**Fix:** run `npm install` from the repository root, not from `server`; verify root `workspaces` includes `shared`, shared is named `@capstone/shared`, and dependent versions match. Do not publish the private package as a workaround.

## `Cannot find module '@capstone/shared'` or missing `shared/dist`

**Meaning:** the local workspace is linked but its exported build files do not exist yet.

**Fix:** run `npm run build --workspace=@capstone/shared`, then restart development. The root `npm run dev` already performs this initial build before starting watchers.

## `npm run dev` and MariaDB is not running

**Meaning:** in the current skeleton, this alone should *not* stop startup because the pool is lazy and `/api/health` does not query the database. Once a database-backed endpoint is called, errors such as `ECONNREFUSED` mean no server is accepting the configured host/port.

**Fix:** start MariaDB, verify `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`, then test a readiness/database command. On Turing, configure the documented socket instead of guessing a TCP port.

## `Access denied for user` from MariaDB

**Meaning:** MariaDB is reachable, but credentials or grants are wrong.

**Fix:** confirm the `.env` account, database name, and whether the account is permitted from the connecting host. Grant only the required schema privileges; do not solve it by using a root database account in the app.

## `ENOENT ... mysqld.sock`

**Meaning:** `DB_SOCKET` points to a nonexistent socket file, perhaps because a Turing value was copied into local configuration.

**Fix:** clear `DB_SOCKET` locally to use `DB_HOST`/`DB_PORT`. On Turing, verify `/run/mysqld/mysqld.sock` exists and is the administrator-documented path.

## Zod prints an environment validation error at startup

**Meaning:** a variable is outside its schema—for example `APP_PORT=hello`, an invalid `NODE_ENV`, or an empty required database name.

**Fix:** read the issue path in the error, compare `.env` with `.env.example`, and correct the value. Do not weaken validation merely to make startup continue; fail-fast behavior is preventing a later, less clear failure.

## `EADDRINUSE: address already in use`

**Meaning:** another process already occupies `APP_PORT` (Express) or Vite's port.

**Fix:** stop the old `npm run dev` process with Ctrl+C, identify the process using the port, or intentionally choose another `APP_PORT`. Keep Vite and Express configuration aligned.

## The Vite page loads but `/api/...` returns 404

**Meaning:** either the Express route is not mounted at that exact path, or the request never reached the expected server.

**Fix:** check the browser Network tab, confirm the request begins with `/api`, verify `APP_PORT`, open `/api/health` directly on Express, and compare `app.use('/api/...', router)` with the router-relative path. Restart Vite after changing `.env`.

## The Vite proxy reports `ECONNREFUSED`

**Meaning:** Vite tried to forward the request but Express is not listening at its configured target.

**Fix:** read the server terminal for startup errors, verify port values, and confirm both server and client processes launched. This differs from a 404: refusal means no connection; 404 means a server answered but had no matching route.

## Refreshing `/app/history` returns an Apache/Express 404 in production

**Meaning:** SPA fallback or proxy-path configuration is missing. Client navigation worked because React already ran, but a refresh asks the server for that literal path.

**Fix:** build the client, start Express from the repository root, verify production mode enables the non-API `index.html` fallback, and configure Apache/Vite `APP_BASE_PATH` consistently.

## TypeScript says “object is possibly undefined” after an indexed lookup

**Meaning:** `noUncheckedIndexedAccess` correctly notes that an array index or object key may not exist.

**Fix:** prefer checking the value, using optional chaining, providing a fallback, or narrowing the key. Use `!` only where generation/static structure truly guarantees existence, as with literal CSS Module classes.

## TypeScript cannot find a `.module.css` file or `import.meta.env`

**Meaning:** Vite's ambient declarations are not included in the client TypeScript project.

**Fix:** verify `client/src/vite-env.d.ts` exists, remains under the included `src` directory, references `vite/client`, and declares `*.module.css`.

## A React test fails with `document is not defined`

**Meaning:** Vitest is using a Node environment for a test that renders browser DOM.

**Fix:** add `// @vitest-environment jsdom` to the UI test or set jsdom in a client Vitest config. Server tests should stay in Node because they do not need a browser simulation.

## React behavior seems to run twice during development

**Meaning:** React `StrictMode` intentionally repeats certain development-only behavior to reveal side effects.

**Fix:** make effects safe and clean them up rather than removing StrictMode. Production does not perform the extra development checks.

## ESLint rejects `_next` as unused or Express does not recognize an error handler

**Meaning:** Express identifies error middleware by its four-argument signature, even when the handler does not read every argument.

**Fix:** keep `(error, _request, response, _next)` and keep the ESLint `argsIgnorePattern: '^_'` rule. Removing the fourth parameter can change Express behavior.

## `npm run start` fails because `server/dist/server.js` is missing

**Meaning:** `start` runs production output, not TypeScript source.

**Fix:** run `npm run build` first. Use `npm run dev` while editing.

## The browser still shows old code after a successful build

**Meaning:** an old dev process, browser cache, service proxy, or stale production `dist` may be serving a previous asset.

**Fix:** stop/restart processes, hard-refresh, confirm which port/URL is open, rebuild, and inspect the served asset filenames. Hashed Vite filenames should change when content changes.

# How to reproduce this yourself

1. Create an empty repository and add `client`, `server`, `shared`, and `docs` folders.
2. Create a private root `package.json` with npm workspaces and unified `dev`, `build`, `lint`, `test`, and `typecheck` scripts.
3. Add a strict root TypeScript config and let each workspace extend it.
4. In `shared`, configure TypeScript declaration output and define the first API contract.
5. In `server`, install Express, `mysql2`, dotenv, and Zod. Separate environment loading, database pooling, route registration, app construction, and network startup.
6. Add a health route and test it with Supertest before building feature APIs.
7. In `client`, install React, React DOM, React Router, Vite, and the React Vite plugin. Add separate browser/tool TypeScript configs.
8. Create `index.html`, mount React from `main.tsx`, define the route tree, and place nested pages inside an `AppShell` outlet.
9. Add global design tokens plus component-scoped CSS Modules. Build the simplest Cat Room placeholder without introducing deferred art systems.
10. Add a React Testing Library smoke test that verifies accessible user-visible output.
11. Create `.env.example`, ignore `.env`, and configure Vite to proxy relative `/api` requests to Express.
12. In production mode, let Express serve `client/dist` and return `index.html` for non-API routes.
13. Write the product, scope, UI, architecture, database, and analytics specifications before expanding features.
14. Install and verify:

    ```bash
    npm install
    cp .env.example .env
    npm run typecheck
    npm run lint
    npm test
    npm run build
    npm run dev
    ```

15. Explain the system using the request flow above, then implement the next vertical slice from `docs/MVP.md` rather than adding unrelated frameworks or features.

# Check-In and Tracking Implementation

This section continues from the original project-skeleton guide above. It describes what was actually implemented after the health endpoint and application shell: authentication, MariaDB-backed Check-Ins, personalized tracking libraries, the overlay wizard, History, and the current sprite-based UI.

Some earlier passages intentionally remain as a historical snapshot. In particular, the earlier “Full POST request walkthrough” calls Check-In hypothetical, describes Mood as optional, and says authentication is future work. Those statements have now been superseded by the implementation documented below. They were not silently rewritten because this continuation is meant to preserve the project's learning history.

## Continuation contents

- [From skeleton to a vertical slice](#from-skeleton-to-a-vertical-slice)
- [Authentication and Check-In ownership](#authentication-and-check-in-ownership)
- [Database relationships](#database-relationships)
- [Migrations and seed data](#migrations-and-seed-data)
- [Expanded tracking model](#expanded-tracking-model)
- [Personalized tracking libraries](#personalized-tracking-libraries)
- [The Check-In transaction](#the-check-in-transaction)
- [Check-In API and validation](#check-in-api-and-validation)
- [Check-In overlay and wizard](#check-in-overlay-and-wizard)
- [Mood, pain, symptoms, feelings, and factors](#mood-pain-symptoms-feelings-and-factors)
- [History and persistence](#history-and-persistence)
- [Pixel-art asset workflow](#pixel-art-asset-workflow)
- [Debugging lessons from this phase](#debugging-lessons-from-this-phase)
- [Testing strategy for tracking](#testing-strategy-for-tracking)
- [Check-In implementation file reference](#check-in-implementation-file-reference)
- [Commands used in this phase](#commands-used-in-this-phase)
- [How to rebuild the Check-In system yourself](#how-to-rebuild-the-check-in-system-yourself)

## From skeleton to a vertical slice

The initial repository proved that React, Express, the shared package, and MariaDB configuration could coexist. It did not yet prove that a real user could create data, refresh the browser, and retrieve the same data safely. The first Check-In milestone solved that larger problem as one narrow **vertical slice**.

A vertical slice crosses every layer needed by one feature:

```text
React Check-In UI
  -> shared request contract
  -> Express route and middleware
  -> authentication session
  -> service business rules
  -> repository transaction
  -> normalized MariaDB rows
  -> API response
  -> React History view
```

This was more useful than building many disconnected screens. It proved the hardest architectural connections early: credentials, sessions, validation, user ownership, SQL transactions, persistence, and browser rendering.

The first database-backed version added:

- `users` and `sessions` for identity;
- `check_ins` as the parent logging event;
- `check_in_moods` and `check_in_pain` as one-to-one measurements;
- `factors` as a reusable library;
- `check_in_factors` as the many-to-many connection;
- a migration runner, seed runner, and verification script;
- protected create/list endpoints;
- a simple React Check-In form and Recent Check-Ins page.

The simplest alternative would have been one wide table with columns such as `mood`, `pain`, `study`, `stress`, and `caffeine`. That would be easy for the first few fields but would require schema changes for every new symptom or factor. The normalized design takes slightly more SQL, but it supports reusable libraries, custom items, and history without continually adding columns.

Intentionally deferred work included Sleep, medication, analytics, coins, inventory, room decoration, and cat animation. None was needed to prove the data pipeline.

## Authentication and Check-In ownership

The earlier guide explains the general idea of server-side sessions. The important new connection is that every private tracking operation gets its user identity from the server session—not from a request body.

### Registration

`POST /api/auth/register` validates a username and password with shared Zod schemas. `AuthService.register` checks whether the username exists, hashes the password with bcryptjs cost 12, and asks `AuthRepository` to insert the user with parameterized SQL.

Only the hash is stored:

```text
users
id | username | password_hash
```

A password is never stored in readable form. bcryptjs is deliberately slow, salted password hashing, which makes stolen hashes more expensive to attack than a fast general-purpose hash.

After registration, the route regenerates the session and sets:

```ts
request.session.userId = user.id;
```

Registration therefore also logs the user in.

### Login

`POST /api/auth/login` loads the stored user by username and uses `compare` from bcryptjs. It returns the same generic error for an unknown username and a wrong password, avoiding needless account information leakage.

On success, the route regenerates the session before storing `userId`. Regeneration replaces the pre-login session identifier and protects against session fixation, where an attacker tries to make a victim log in using a session identifier the attacker already knows.

### MariaDB-backed sessions

The browser receives an opaque cookie named `pawprint.sid`. The useful data stays server-side in the `sessions` table. `MariaDbSessionStore` implements `get`, `set`, `destroy`, and `touch` with parameterized queries.

The cookie is:

- `httpOnly`, so browser JavaScript cannot read it;
- `sameSite: 'lax'`, reducing cross-site request exposure;
- `secure` in production, so it travels only over HTTPS;
- valid for seven days unless refreshed or destroyed.

Tests use Express's in-memory session store so unit/integration tests do not require MariaDB. Development and production use the MariaDB store so login survives process requests and can be inspected operationally.

### Protected requests

`requireAuth` rejects requests that lack `request.session.userId`. Check-In and tracking-library routers install this guard before their handlers.

The frontend never sends this:

```json
{ "userId": 27, "mood": 4 }
```

It sends only tracking data. The route calls the service with the trusted session value:

```ts
service.create(request.session.userId!, request.body)
```

This matters because browser input is editable. If the server trusted a submitted `userId`, user 1 could change it to 2. Instead, SQL reads and writes are scoped using the authenticated ID supplied by the session middleware.

### Current user and logout

`GET /api/auth/me` lets React restore login state after a refresh. `POST /api/auth/logout` destroys the server record and clears the cookie. `AuthProvider` wraps these endpoints and maintains the current `user`; `ProtectedRoute` displays a loading state while `/me` runs and redirects unauthenticated visitors to `/login`.

## Database relationships

The implemented relationship model is:

```text
users
├── sessions (indirectly, through session data containing userId)
├── user_feeling_preferences ── feelings
├── user_symptom_preferences ── symptoms
├── user_factor_preferences ─── factors
└── check_ins
    ├── check_in_moods
    ├── check_in_pain
    ├── check_in_feelings ────── feelings
    ├── symptom_entries ──────── symptoms
    └── check_in_factors ─────── factors
```

### Why `check_ins` is the parent

A Check-In is one event at one time. Its parent row records:

- the owner (`user_id`);
- the exact event time (`occurred_at`);
- the application's day grouping (`logical_date`);
- creation/update metadata and a currently unused nullable note column.

Every measurement references that event. This lets one Check-In contain several kinds of data without pretending they are all the same kind of value.

### Why Mood and generalized Pain have child tables

`check_in_moods` and `check_in_pain` each use `check_in_id` as both primary key and foreign key. That enforces at most one Mood and at most one generalized Pain score per Check-In.

Separate child rows preserve missingness. Although the current product requires Mood for newly created Check-Ins, the schema still supports historical/legacy events without a Mood row. Pain remains optional:

- no `check_in_pain` row means “pain was not measured”;
- a row with `pain_score = 0` means “the user explicitly measured pain and reported none.”

Using a default of zero would destroy that distinction and produce misleading analytics later.

### Why symptoms use definitions and entries

`symptoms` defines reusable items such as Headache and Brain Fog. `symptom_entries` records how one symptom was measured in one Check-In. It stores `check_in_id`, `symptom_id`, and severity 0–4.

That separation allows the same definition to appear in thousands of Check-Ins without repeating its name and category in every entry. It also allows a user-created definition such as Sensory Overload to participate in the same system as built-ins.

### Why factors use a join table

A Check-In can have many factors, and one factor can appear in many Check-Ins. This is a many-to-many relationship, represented by `check_in_factors`. The relationship itself stores intensity because intensity describes that factor *during that particular Check-In*.

### Why Feelings are separate from Factors

Feelings describe the emotional quality accompanying Mood: Calm, Happy, Anxious. Factors describe context: Study, Work, Poor Sleep, Caffeine. Combining them would make the data ambiguous—for example, “Stress” as context is not the same question as “Stressed” as a feeling.

Feelings have no severity. A selected feeling creates a `check_in_feelings` link and only makes sense alongside Mood. Factors have an intensity of 1–3 and can add context to the required Mood.

### General Pain versus Physical Pain symptoms

Generalized Pain answers “overall, how much pain am I in?” on 0–10. Physical Pain symptoms answer “which specific pain and how severe?” on 0–4. Headache and Back Pain therefore live in the common symptom system rather than requiring another custom-pain schema.

### Preferences and custom ownership

Preference tables do not duplicate library definitions. They connect a user to a definition and store whether it is pinned plus display order. Built-ins remain shared while each user gets a different quick list.

Custom definitions store `created_by_user_id`. Library and Check-In access queries permit an item only when it is built-in or owned by the authenticated user.

### Concrete row example

Suppose user 7 saves:

```text
Mood = 4 (Good)
Feeling = Calm
Pain = 0
Headache = 2 (Moderate)
Study = 3 (A lot)
```

The database conceptually contains:

```text
check_ins:            id=41, user_id=7, occurred_at=..., logical_date=...
check_in_moods:       check_in_id=41, mood_score=4
check_in_feelings:    check_in_id=41, feeling_id=<Calm id>
check_in_pain:        check_in_id=41, pain_score=0
symptom_entries:      check_in_id=41, symptom_id=<Headache id>, severity=2
check_in_factors:     check_in_id=41, factor_id=<Study id>, intensity=3
```

No rows are created for untouched symptoms or unselected factors.

## Migrations and seed data

A migration is a named, versioned schema change. It lets local and Turing databases reach the same structure in a repeatable order.

### The migration runner

`server/src/db/migrate.ts` creates `schema_migrations` if needed, reads sorted `.sql` files, and skips filenames already recorded. Migration files use `-- statement-breakpoint` where the lightweight runner must issue separate statements. A filename is recorded only after all its statements complete successfully.

This runner is intentionally small and understandable. It does not attempt an automatic destructive reset or a full ORM migration abstraction.

### Migration 001

`001_auth_and_check_ins.sql` created users, sessions, Check-Ins, Mood, Pain, factors, and the first factor join table. It also established ownership indexes, score constraints, and foreign keys.

Once applied, migration 001 was not edited. Editing an applied file makes its filename say “already applied” while its contents differ between databases. A fresh machine and an existing machine could silently end with different schemas.

### Migration 002

`002_feelings_symptoms_factor_intensity.sql` added:

- feelings and their preferences/join table;
- symptoms, per-category preferences, and symptom entries;
- nullable factor intensity.

Factor intensity was nullable so old yes/no factor links remained valid. New UI-created rows use 1–3; old rows can still read as “legacy/no intensity.” This is a non-destructive evolution.

### Migration 003

`003_factor_preferences.sql` added `user_factor_preferences`, bringing Factors into the same persistent quick-list model as Feelings and Symptoms.

### Seeds

The three seed files insert built-in Factors, Feelings, and Symptoms. Stable slugs such as `study`, `calm`, and `brain-fog` provide machine-readable identities that do not depend on display wording.

Each seed uses `ON DUPLICATE KEY UPDATE`. Rerunning a seed updates the canonical built-in definition instead of creating duplicates. This makes local setup and deployment safer.

Run the database lifecycle with:

```bash
npm run db:migrate
npm run db:seed
npm run db:verify
```

- `db:migrate` applies only unrecorded migration filenames.
- `db:seed` safely inserts/refreshes the built-in libraries.
- `db:verify` lists tables, counts built-ins by type/category, and verifies factor intensity and factor-preference columns.

Migrations are safer than manually changing production because the change is reviewable, repeatable, and recorded. This lightweight runner does not wrap an entire migration file in one database transaction, so a failed migration should be investigated rather than blindly rerun or edited after partial application.

## Expanded tracking model

### Feelings

The `feelings` table contains shared built-ins and user-owned custom definitions. `user_feeling_preferences` stores the quick list. `check_in_feelings` attaches zero or more feelings to the Check-In. The request schema requires Mood, so a valid new Check-In cannot contain dangling feelings without Mood.

### Symptoms

The symptom library has exactly four centralized categories:

- Physical Pain;
- Physical Other;
- Mental;
- Cognitive.

Each explicitly answered symptom creates a severity 0–4 entry. Untouched controls create no entry; clicking 0 creates a real row meaning the symptom was explicitly measured as absent.

### Factor intensity

The initial factor link represented only selected/not selected. Migration 002 changed new factor recordings to:

```text
1 = A little
2 = Medium
3 = A lot
```

This says how present or relevant a factor was, not whether it helped or hurt. No selection still means no join row.

## Personalized tracking libraries

The tracking-library router exposes active Feelings, Symptoms, and Factors. The repository merges each library with the current user's preference rows.

### Default quick lists

Before a user saves preferences, server-side stable-slug sets choose a manageable default. Once any preference rows exist for the relevant library/category, those rows become authoritative. The normal wizard filters returned items by `isPinned`.

Saving preferences replaces that user's preference set inside a transaction. The repository first confirms every submitted ID is accessible, deletes only that user's old rows, and inserts a complete true/false snapshot with display order.

### Creating custom items

Custom creation follows this pattern:

1. Validate the name and category where relevant.
2. Check active accessible definitions for a trimmed, case-insensitive duplicate.
3. Insert a definition with `created_by_user_id` and `is_builtin = FALSE`.
4. Add it to the user's pinned IDs.
5. Return the refreshed active library.

Custom factors need a globally unique non-null slug because the original `factors.slug` schema requires one. The service generates `custom-<userId>-<random UUID>` while keeping the human name separate.

Symptom duplicates are checked within a category, so the category is part of their identity rule. Feelings and Factors are checked across their respective accessible libraries. A duplicate produces HTTP 409 with a clear message rather than silently creating another row.

### Pinning versus deleting

Unpinning removes an item only from the normal quick list. It does not deactivate the definition and does not affect history. Built-ins can be pinned/unpinned but cannot be deactivated through the custom-item endpoint.

Removing a custom item performs a scoped update:

```sql
UPDATE <library>
SET is_active = FALSE
WHERE id = ?
  AND created_by_user_id = ?
  AND is_builtin = FALSE
  AND is_active = TRUE;
```

Active library queries filter `is_active = TRUE`, so the item disappears from future selection. History joins intentionally do **not** filter on `is_active`, so old Check-Ins still resolve the name.

Example:

```text
User creates “Sensory Overload” in Mental
  -> custom symptoms row owned by that user
  -> automatically pinned in Mental preferences
  -> appears in future Mental steps
  -> user later removes it
  -> symptoms.is_active becomes false
  -> old symptom_entries still join to and display “Sensory Overload”
```

Hard deletion would either violate the foreign key or cascade away evidence from old Check-Ins. Soft deactivation preserves the meaning of historical records.

## The Check-In transaction

Consider this current request:

```json
{
  "mood": 4,
  "feelingIds": [2, 8],
  "pain": 2,
  "symptoms": [
    { "symptomId": 12, "severity": 1 },
    { "symptomId": 19, "severity": 3 }
  ],
  "factors": [
    { "factorId": 1, "intensity": 3 }
  ]
}
```

After validation and accessibility checks, `CheckInRepository.create` obtains one pooled connection:

```text
BEGIN
  INSERT check_ins for the session user
  INSERT check_in_moods with 4
  INSERT two check_in_feelings links
  INSERT check_in_pain with 2
  INSERT symptom_entries with severities 1 and 3
  INSERT check_in_factors with intensity 3
COMMIT
release connection
```

If any child insert fails, the `catch` block executes `ROLLBACK`; the `finally` block releases the connection. This prevents a parent row with only half its intended children.

The repository uses `input.pain != null`, not a truthiness test. Therefore pain 0 is inserted. For symptoms, only entries present in the request array are inserted, so explicit severity 0 is preserved while untouched symptoms remain absent.

After commit, the service reads the new Check-In through the same user-scoped history query. If it cannot be read, it reports a server error instead of pretending the response is complete.

## Check-In API and validation

### Shared boundary

`shared/src/index.ts` defines the Zod request schema and TypeScript response types used on both sides. The current schema requires:

- integer Mood 1–5;
- unique positive feeling IDs;
- optional/nullable integer Pain 0–10;
- unique symptom IDs with integer severity 0–4;
- unique factor IDs with integer intensity 1–3.

Mood is required at this boundary. Pain-only, symptom-only, feelings-only, and factors-only bodies are rejected.

### HTTP layer

`POST /api/check-ins` runs, in order:

```text
session middleware
-> requireAuth
-> validateBody(createCheckInRequestSchema)
-> CheckInService.create(session userId, parsed body)
-> HTTP 201 with { checkIn }
```

`validateBody` replaces `request.body` with Zod's parsed output, including defaults for omitted arrays. Validation errors become an `AppError` with status 400 and structured Zod details.

Frontend disabled states improve usability, but they are not security. A caller can bypass React and send HTTP manually, so the server remains authoritative.

### Service accessibility checks

Before opening the write transaction, the service asks the repository which submitted Feeling, Symptom, and Factor IDs are active and accessible to the user. A valid definition is either built-in or has the same `created_by_user_id`. Count mismatches produce `INVALID_FEELINGS`, `INVALID_SYMPTOMS`, or `INVALID_FACTORS`.

This prevents a user from attaching another user's custom item even if they learn its numeric ID.

### Logical date

The server supplies `occurred_at`; it does not trust a browser timestamp. `getLogicalDate` subtracts the centralized four-hour cutoff and returns the UTC calendar date. Thus 3:59 AM belongs to the previous logical day and 4:00 AM starts the next. User-profile timezones remain deferred and the code comments clearly call UTC temporary.

## Check-In overlay and wizard

### Why Home remains mounted

`App.tsx` nests the `check-in` route beneath `HomeLayer`. `HomeLayer` always renders `HomePage` and then an `<Outlet>`. At `/app`, the outlet is empty. At `/app/check-in`, it contains the fixed-position dialog while Home remains behind it.

This preserves the feeling of opening an in-world action rather than leaving for a long document. The backdrop dims and subtly blurs Home while the dialog provides accessible `role="dialog"` and `aria-modal="true"` semantics.

### Draft state

`CheckInPage` owns one in-memory draft:

```text
mood
feelingIds
pain
symptomRatings: symptomId -> severity
factorRatings: factorId -> intensity
```

Changing `step` changes only which controls are rendered. It does not replace the parent component, so Back and Next preserve the draft. Nothing reaches MariaDB until final Save. Closing a dirty draft asks for discard confirmation; Escape also closes when a customization dialog is not open.

### Wizard progression

The six steps are:

1. Mood and optional Feelings
2. Generalized Pain and Physical Pain symptoms
3. Physical Other symptoms
4. Mental symptoms
5. Cognitive symptoms
6. Factors

The first long-form prototype showed Mood, Pain, and many Factors together. It was useful for proving the pipeline, but it felt like a web form. The wizard reduces cognitive load by presenting one subject at a time while retaining one atomic final save.

### Save behavior

Mood's Next button remains disabled until a Mood is selected. Final Save also checks `mood !== null` and prevents duplicate clicks while `saving` is true. On success, the dialog shows brief status feedback, waits 650 milliseconds, and navigates to `/app` with replacement. History remains a user-chosen destination rather than an automatic redirect.

## Mood, pain, symptoms, feelings, and factors

### Mood and Feelings

Mood is required and remains numeric:

```text
1 Very Low | 2 Low | 3 Okay | 4 Good | 5 Great
```

The UI now uses five extracted cat sprites, but each button still calls `setMood(value)` with exactly 1–5. Its accessible name includes both the label and value. Feelings appear only after Mood selection and remain optional.

### Pain and symptoms

Generalized Pain begins as `null`; the 0–10 buttons do not default to zero. Clicking 0 records zero. Clicking the selected value again returns it to unanswered.

Symptom controls use the same behavior with severity 0–4. The `Ratings` object contains only touched IDs. `selectedSymptoms` converts its entries to the API array at save time.

Physical Pain uses the shared symptom implementation, followed by Physical Other, Mental, and Cognitive. This keeps customization, ownership, validation, and persistence consistent across categories.

### Factors

Factors are contextual or lifestyle conditions such as Study, Stress, Poor Sleep, and Exercise. They are neither feelings nor symptoms. `FactorIntensityControl` exposes three native keyboard-operable buttons and CSS-drawn increasing bars:

```text
1 A little | 2 Medium | 3 A lot
```

Clicking an active intensity again removes the rating. Only selected factor entries enter the request. “Edit Factors” opens the shared customization dialog; it does not expand an uncontrolled wall of factors.

### Customization dialogs

`CustomizationDialog` handles three related modes through a TypeScript union. It loads the supplied library, lets users toggle quick-list checkboxes, creates custom items, and offers Remove only for non-built-ins. Factor items are grouped by centralized category. The dialog has an internal scroll area rather than growing beyond the viewport.

Saving sends the complete pinned ID list to the appropriate preferences endpoint. The server validates accessibility and returns the refreshed library, which updates the parent wizard state immediately and persists for future Check-Ins.

## History and persistence

`GET /api/check-ins` is protected and always passes the session user ID to `CheckInRepository.list`. The base query filters `WHERE ci.user_id = ?`, orders newest first, and limits results to 50.

The repository first reads parent/Mood/Pain rows, then loads all related Factors, Feelings, and Symptoms for those Check-In IDs. It groups those rows in memory into the frontend-friendly `CheckIn[]` response.

Historical library joins intentionally omit `is_active = TRUE`. A deactivated custom definition is unavailable for new selection but still supplies its name to old History entries. Legacy factor links with `NULL` intensity are rendered explicitly as legacy/no intensity.

History proves persistence because it fetches from MariaDB after navigation or refresh; it is not reading the wizard's former React state.

## Pixel-art asset workflow

The UI sheet used by the current Home/Mood controls is 160×608 pixels and contains a 5-column by 19-row grid of 32×32 cells. The private `docs/UI_ASSET_MAP` records exact one-based row/column references and pixel crops.

Exact mapping matters because adjacent sprites can look similar but represent different approved choices. When the map originally described 16×16 cells, test crops returned partial sprites. Work stopped instead of guessing. After the grid was corrected to 32×32, all six crops were visually verified and extracted without resampling.

Current standalone assets are:

| Meaning | Source mapping | Extracted file |
|---|---|---|
| Check In heart | row 9, column 4; `x=96, y=256, w=32, h=32` | `client/src/assets/ui/check-in-heart.png` |
| Very Low / 1 | row 4, column 2; `x=32, y=96, w=32, h=32` | `mood-very-low.png` |
| Low / 2 | row 3, column 4; `x=96, y=64, w=32, h=32` | `mood-low.png` |
| Okay / 3 | row 3, column 3; `x=64, y=64, w=32, h=32` | `mood-okay.png` |
| Good / 4 | row 3, column 2; `x=32, y=64, w=32, h=32` | `mood-good.png` |
| Great / 5 | row 3, column 1; `x=0, y=64, w=32, h=32` | `mood-great.png` |

Named files avoid spreading unexplained `background-position` values through CSS and make imports self-documenting. Transparency is preserved. The heart renders at its native 32px; Mood sprites render at exactly 64px (2×). `image-rendering: pixelated` prevents smoothing.

The Home Check In action combines the decorative heart (`alt=""`, `aria-hidden="true"`) with one real text label. CSS adds spacing, a cozy rounded shape, focus/hover/pressed states, and `white-space: nowrap`. The image does not duplicate the accessible name.

The included pixel font has not been wired into the application. Keeping the normal rounded system font currently avoids reducing readability or building a brittle bitmap-font system for one label. A pixel font can later be introduced selectively as an accent.

## Debugging lessons from this phase

### MariaDB was not running

`ECONNREFUSED` means the configured host and port answered with no listening database service. Start MariaDB, then verify connection variables. The application should not “fix” this by switching to root credentials.

### `MariaDB [(none)]>` is not an error

It means the MariaDB client connected successfully but no default database has been selected. Use:

```sql
USE capstone;
SHOW TABLES;
```

### Local database setup

The local setup created the `capstone` database, a `capstone_user@localhost` account, and privileges limited to `capstone.*`. Application credentials belong in ignored `.env`, never in source or this guide.

### `castone` versus `capstone`

A misspelled `DB_NAME=castone` can produce an access-denied message even when the username/password are correct, because the account was granted access to `capstone.*`, not the misspelled schema. Read the database name inside the error instead of assuming every “access denied” is a bad password.

### Local TCP versus Turing socket

Local configuration normally uses:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
```

Turing can set:

```dotenv
DB_SOCKET=/run/mysqld/mysqld.sock
```

`databaseConnectionOptions` gives a configured socket priority. Copying a Turing-only socket path onto a local machine produces `ENOENT` if that file does not exist.

### Applied migrations are history

When a schema needs to change, add the next numbered migration. Do not edit migration 001 or 002 after `schema_migrations` records it, because existing databases will skip the changed filename.

### Sprite coordinates must match actual geometry

Treating the 160×608 sheet as 16×16 cells extracted corners of sprites. Inspecting the source dimensions and previewing all six crops revealed the mismatch. The corrected 32×32, 5×19 grid produced complete approved sprites. Stopping at the inconsistency was safer than committing a visually similar neighbor.

### Test sockets in restricted environments

Supertest may internally open an ephemeral local socket. A sandbox can report `listen EPERM 0.0.0.0` even when application code is correct. The proper response is to rerun with localhost permission and still require a green suite—not to hide or delete the API tests.

## Testing strategy for tracking

Tests protect meanings that are easy to break while refactoring:

- shared-schema tests cover Mood 1/5 bounds, Pain 0/10 bounds, symptom 0/4 bounds, and factor intensity 1/3 bounds;
- schema/API tests prove Mood is required and duplicate IDs are rejected;
- repository tests distinguish absent Pain from Pain 0 and absent symptoms from severity 0;
- transaction tests force a child insert failure and expect rollback;
- ownership tests confirm History SQL is scoped to the authenticated user;
- accessibility tests reject unknown, inactive, or another user's library IDs;
- library tests cover defaults, preference transactions, custom ownership, case-insensitive duplicates, and soft deactivation;
- history tests confirm archived names and legacy null intensity still render;
- logical-date tests cover both sides of 4:00 AM;
- React tests cover disabled Mood progression, Back/Next state, explicit zeros, preference calls, customization removal, successful return Home, and overlay opening;
- parameterized Mood UI tests save each cat option and verify it produces exactly 1–5.

These tests matter before Turing deployment because deployment changes environment and transport, not business meaning. A green local suite cannot replace a Turing smoke test, but it sharply narrows deployment problems to configuration/integration rather than basic rules.

## Check-In implementation file reference

This reference covers only files created or materially changed for authentication, tracking, History, the overlay, and current UI assets. It intentionally does not repeat the initial Vite/Express/workspace explanations.

### Phase configuration

#### `package.json` and `server/package.json`

**Material changes.** The root gained `db:migrate`, `db:seed`, and `db:verify` delegations. The server gained their `tsx` scripts plus bcryptjs and express-session runtime dependencies and Supertest/session typings for development.

**Connections.** These manifests expose the database workflow described above and install the libraries used by auth/session modules. The npm-workspace behavior itself remains as explained in the earlier guide.

#### `.env.example` and `server/src/config/env.ts`

**Material changes.** `SESSION_SECRET` became active configuration, with a minimum 32-character production rule. Database host, port, socket, account, and schema variables now drive real persistence rather than only a future pool.

**Connections.** Session signing reads the parsed secret; every repository and database script shares the parsed connection configuration. Real `.env` values remain private.

#### `README.md`

**Material change.** The concise public setup instructions gained migration, seed, verification, and current authentication/Check-In milestone information without linking the private planning documents.

### Shared contract

#### `shared/src/index.ts`

**Purpose and important blocks.** Defines username/password schemas, auth responses, centralized symptom/factor categories, the required-Mood Check-In schema, preference/custom-item schemas, and response interfaces.

**Why and connections.** One runtime contract prevents client/server drift. Express validation imports the schemas; React and repositories import the inferred types. It is the boundary between UI objects and server-authoritative data.

#### `shared/src/index.test.ts`

**Purpose.** Parameterized boundary tests for Mood, Pain, symptoms, factor intensity, missing Mood, and duplicate IDs.

**Role.** Protects the API meaning before requests reach SQL or UI behavior.

### Database

#### `database/migrations/001_auth_and_check_ins.sql`

**Purpose.** Creates identity/session tables and the first normalized Check-In/Mood/Pain/Factor schema.

**Connections.** Auth repositories use `users`; the session store uses `sessions`; Check-In repositories use the remaining tables.

#### `database/migrations/002_feelings_symptoms_factor_intensity.sql`

**Purpose.** Adds the Feeling and Symptom systems plus nullable Factor intensity.

**Why.** It extends the applied base without rewriting history and preserves legacy factor rows.

#### `database/migrations/003_factor_preferences.sql`

**Purpose.** Adds persistent per-user Factor quick lists.

#### `database/seeds/001_builtin_factors.sql`

**Purpose.** Idempotently provides the categorized contextual Factor library.

#### `database/seeds/002_builtin_feelings.sql`

**Purpose.** Idempotently provides starter emotion words with stable slugs.

#### `database/seeds/003_builtin_symptoms.sql`

**Purpose.** Idempotently provides modest starter lists in the four symptom categories.

#### `server/src/db/migrate.ts`

**Purpose and blocks.** Creates the migration ledger, sorts SQL files, splits marked statements, applies unrecorded files, and records successful filenames.

**Role.** Turns repository schema files into the actual MariaDB structure.

#### `server/src/db/seed.ts`

**Purpose.** Reads sorted seed SQL and executes each idempotent library insert.

#### `server/src/db/verify.ts`

**Purpose.** Prints tables, built-in counts, and critical evolved columns so a developer can verify the schema rather than assume it.

#### `server/src/db/pool.ts`

**Material change/connection.** The same lazy pool now supports real auth, session, migration, library, and Check-In queries. Its UTC setting supports consistent timestamps, and its socket/TCP selection supports local and Turing environments.

### Authentication connections

#### `server/src/auth/authRepository.ts`

**Purpose.** Contains parameterized user lookup/insert SQL and maps snake_case `password_hash` to a TypeScript object.

#### `server/src/auth/authService.ts`

**Purpose.** Owns username uniqueness, bcryptjs hashing/comparison, safe credential errors, and current-user lookup.

**Why.** Password rules do not belong in route or SQL plumbing.

#### `server/src/auth/mariaDbSessionStore.ts`

**Purpose.** Adapts Express session operations to the `sessions` table, including expiry and touch behavior.

#### `server/src/auth/session.ts`

**Purpose.** Centralizes cookie/security settings and selects memory storage only during tests.

#### `server/src/routes/auth.ts`

**Purpose.** Implements register, login, logout, and current-user HTTP behavior. It regenerates sessions after successful credentials and stores `userId`.

#### `server/src/types/express-session.d.ts`

**Purpose.** Teaches TypeScript that Pawprint adds `userId?: number` to Express's `SessionData`.

#### `server/src/middleware/requireAuth.ts`

**Purpose.** Stops anonymous requests before private business logic and narrows the runtime expectation that a session user exists.

#### `client/src/auth/AuthContext.tsx`, `authContextValue.ts`, and `useAuth.ts`

**Purpose.** Provide current identity and login/register/logout actions across React without prop-drilling.

#### `client/src/auth/ProtectedRoute.tsx`

**Purpose.** Keeps private React routes behind the `/api/auth/me` loading/identity result. This is UX protection; the server guard remains the security boundary.

#### `client/src/features/auth/AuthPage.tsx`

**Purpose.** Provides controlled login/register forms, calls AuthContext, shows API errors, and returns authenticated users Home.

### Check-In backend

#### `server/src/checkIns/checkInRepository.ts`

**Purpose and blocks.** Checks accessible IDs, writes one complete transaction, lists user-owned parents, loads normalized children, and reconstructs `CheckIn` objects.

**Why.** SQL/mapping complexity stays out of HTTP and business-rule layers. History queries omit active filters so archived definitions remain readable.

#### `server/src/checkIns/checkInService.ts`

**Purpose.** Validates library accessibility, supplies server time/logical date, coordinates create/read, and translates impossible post-save reads into a clear error.

#### `server/src/routes/checkIns.ts`

**Purpose.** Defines protected `GET /api/check-ins` and validated `POST /api/check-ins`. It derives ownership from the session and returns HTTP 201 for creation.

#### `server/src/checkIns/logicalDate.ts`

**Purpose.** Centralizes the 4:00 AM UTC logical-day calculation so the cutoff is testable and not scattered as magic numbers.

#### `server/src/middleware/validateBody.ts`

**Purpose.** Converts unknown JSON into parsed typed input or forwards a structured validation error.

#### `server/src/errors/AppError.ts` and `server/src/middleware/errorHandler.ts`

**Purpose.** Carry expected status/code/details across layers and convert them into safe JSON. Unexpected errors are logged and become generic 500 responses.

#### `server/src/app.ts`

**Material change.** Installs session middleware before auth/private routes and mounts auth, Check-In, and tracking-library routers before the final error handler.

### Tracking-library backend

#### `server/src/trackingLibrary/trackingLibraryRepository.ts`

**Purpose and blocks.** Lists only active accessible definitions, computes default/persisted pinning, replaces preferences transactionally, checks normalized duplicates, creates owned definitions, and soft-deactivates only owned non-built-ins.

**Role.** This is the SQL authority for personalized libraries.

#### `server/src/trackingLibrary/trackingLibraryService.ts`

**Purpose.** Coordinates create-and-pin, clear duplicate conflict messages, inaccessible preference translation, custom Factor slugs, and deactivation results.

#### `server/src/routes/trackingLibrary.ts`

**Purpose.** Implements protected GET/POST/DELETE/PUT endpoints for Feelings, Symptoms, Factors, and preferences. It validates bodies, positive path IDs, and symptom categories.

### Client flow

#### `client/src/api/api.ts`

**Purpose.** Centralizes same-origin cookies, JSON headers, response parsing, 204 handling, and readable `ApiError` messages for every auth/tracking request.

#### `client/src/app/App.tsx`

**Material change.** Adds auth pages, a protected application subtree, Home-mounted Check-In, History, and a safe redirect from obsolete `/app/tracking`.

#### `client/src/app/AppShell.tsx`

**Material change.** Shows Home, Check In, History, Insights, the session username, and logout. Redundant Tracking navigation was removed.

#### `client/src/app/AppShell.module.css`

**Material change.** Supports the authenticated header/navigation/account layout that surrounds Home, History, and the overlay route.

#### `client/src/features/home/HomeLayer.tsx`

**Purpose.** Keeps `HomePage` mounted and renders the Check-In route through an outlet above it.

#### `client/src/features/home/HomePage.tsx` and `HomePage.module.css`

**Purpose.** Render the centered placeholder Cat Room and left-side Check In action. The exact heart asset is decorative; text supplies the accessible label. Grid symmetry reserves future right-side space without fake features.

#### `client/src/features/auth/AuthPage.module.css`

**Purpose.** Gives the login/register forms a readable Pawprint surface without mixing authentication styling into the component or global stylesheet.

#### `client/src/features/checkIn/CheckInPage.tsx`

**Purpose and blocks.** Loads libraries, owns draft/step/dialog/error/save state, renders each wizard step, translates maps to request arrays, posts once, and returns Home.

**Why.** One parent draft makes Back/Next preservation straightforward and delays database writes until the user confirms the complete event.

#### `client/src/features/checkIn/CustomizationDialog.tsx`

**Purpose.** Reuses one compact dialog pattern for pinning, creating, and safely removing Feelings, Symptoms, and Factors.

#### `client/src/features/checkIn/FactorIntensityControl.tsx`

**Purpose.** Encapsulates the accessible 1–3 interaction and its CSS visual meter so factor rows do not repeat logic.

#### `client/src/features/checkIn/CheckInPage.module.css`

**Purpose.** Owns overlay/dialog layout, compact rating rows, Mood sprites, selected states, Factor meters, and bounded customization layout.

#### `client/src/features/history/HistoryPage.tsx`

**Purpose.** Fetches persisted recent Check-Ins and renders Mood labels, Feelings, Pain, Symptoms, Factor intensities, and legacy null intensity.

#### `client/src/features/history/HistoryPage.module.css`

**Purpose.** Keeps the recent-entry list, nested measurement lists, and error styling local to History.

#### `client/src/assets/ui/*.png`

**Purpose.** Six exact extracted sprite tiles: the Check In heart and five Mood cats. Named imports eliminate runtime sprite-coordinate calculations.

### Tests

#### `server/src/app.test.ts` and `server/src/routes/checkIns.test.ts`

**Purpose.** Protect anonymous endpoint rejection and verify missing Mood fails at the route validation boundary before the service runs.

#### `server/src/checkIns/checkInRepository.test.ts`

**Purpose.** Exercises transaction calls, missing/zero behavior, children, ownership filters, legacy intensity, and archived historical names with a controlled fake pool.

#### `server/src/checkIns/checkInService.test.ts`

**Purpose.** Proves inaccessible Factor IDs stop creation.

#### `server/src/checkIns/logicalDate.test.ts`

**Purpose.** Protects the two sides of the centralized 4:00 AM boundary.

#### `server/src/trackingLibrary/trackingLibraryRepository.test.ts`

**Purpose.** Protects owner parameters, transactional preference snapshots, active filtering, and normalized duplicate SQL.

#### `server/src/trackingLibrary/trackingLibraryService.test.ts`

**Purpose.** Protects duplicate conflicts and custom-item ownership/deactivation behavior at the business-rule layer.

#### `client/src/app/App.test.tsx`

**Purpose.** Covers anonymous routing, removal/redirect of Tracking, and opening the Home Check-In overlay through its accessible label.

#### `client/src/features/checkIn/CheckInPage.test.tsx`

**Purpose.** Exercises the wizard like a user: required Mood, all six steps, Back preservation, explicit zeros, preferences, safe custom removal, return Home, and exact cat-to-number mappings.

## Commands used in this phase

Run these from the repository root:

```bash
npm run dev
npm run db:migrate
npm run db:seed
npm run db:verify
npm run typecheck
npm run lint
npm test
npm run build
```

- `npm run dev` builds Shared once, then watches Shared while running Express and Vite.
- `db:migrate` brings the configured schema forward without destroying it.
- `db:seed` loads or refreshes built-in tracking libraries.
- `db:verify` prints evidence that expected tables/data/columns exist.
- `typecheck` checks all TypeScript contracts without relying on browser execution.
- `lint` runs static correctness/style rules.
- `test` runs Shared, server, and client test suites.
- `build` produces deployable Shared declarations/JavaScript, Vite assets, and Express JavaScript.

Useful MariaDB inspection:

```sql
USE capstone;
SHOW TABLES;
SELECT id, username, created_at FROM users;
SELECT * FROM check_ins ORDER BY id DESC;
SELECT * FROM check_in_moods ORDER BY check_in_id DESC;
SELECT * FROM check_in_pain ORDER BY check_in_id DESC;
SELECT * FROM check_in_feelings ORDER BY check_in_id DESC;
SELECT * FROM symptom_entries ORDER BY check_in_id DESC;
SELECT * FROM check_in_factors ORDER BY check_in_id DESC;
SELECT * FROM user_feeling_preferences ORDER BY user_id, display_order;
SELECT * FROM user_symptom_preferences ORDER BY user_id, display_order;
SELECT * FROM user_factor_preferences ORDER BY user_id, display_order;
```

`SHOW TABLES` checks structure. `users` proves registration. `check_ins` proves ownership/timestamps. Each child query demonstrates normalization and, especially for Pain/Symptoms, the difference between no row and a zero row. Preference queries prove personalized quick lists are stored separately from definitions.

Never put real passwords or session secrets in SQL notes, Markdown, Git, or screenshots. Configure them in ignored `.env`.

## How to rebuild the Check-In system yourself

Starting from an already-working React/Vite/Express/shared-package skeleton:

1. **Install and start MariaDB.** Confirm you can enter the monitor and that the service listens locally.
2. **Create a least-privilege database and user.** Create `capstone`, create an application account, grant only `capstone.*`, and put credentials in `.env`.
3. **Build a migration runner.** Read numbered SQL files, maintain `schema_migrations`, and add `db:migrate` before making feature tables manually.
4. **Add auth/session tables.** Create `users` with `password_hash` and a store-compatible `sessions` table.
5. **Add the base Check-In schema.** Create parent `check_ins`, one-to-one Mood/Pain, Factor definitions, and their join table with keys and constraints.
6. **Build registration/login/session ownership.** Separate repository SQL, bcryptjs service rules, session routes, `requireAuth`, and `request.session.userId` typing.
7. **Build the first Check-In API.** Put Zod contracts in Shared, check IDs, insert with one transaction, and never accept a trusted body user ID.
8. **Build the first simple UI.** Start with Mood/Pain/Factors controls that prove correct request values; preserve null versus zero.
9. **Add History.** Query only the session user's parents, join children, reconstruct response objects, and prove persistence after refresh.
10. **Add Feelings.** Create definitions, user preferences, and Check-In links; keep them semantically separate from Factors.
11. **Add Symptoms.** Use one library/entry design across the four categories with explicit 0–4 values.
12. **Evolve Factor intensity.** Add a nullable column in migration 002 so historical yes/no links survive while new writes use 1–3.
13. **Add personalization.** Implement quick-list preference tables, owned custom definitions, duplicate checks, and soft deactivation without hiding History names.
14. **Convert the form to an overlay wizard.** Nest it under Home, keep one draft state, add Back/Next, gate progression on required Mood, and write only on Save.
15. **Add approved sprites.** Verify documented sheet geometry, extract exact transparent tiles into named files, and use integer pixelated scaling.
16. **Test meanings, not implementation trivia.** Cover bounds, ownership, rollback, missing/zero, preferences, navigation, and every Mood mapping.
17. **Verify manually.** Run migrate/seed/verify, create a real Check-In, inspect normalized rows, refresh History, and test with a second user.
18. **Prepare for Turing.** Use the production session secret, secure proxy/cookie settings, the verified MariaDB socket, compiled builds, Apache forwarding, and a post-deploy smoke test.

This sequence keeps every milestone demonstrable. The next likely data slice—Sleep—can follow the same pattern: define its semantics and shared schema, add a new numbered migration and normalized rows, extend the transaction and History mapper, insert one new wizard step, and protect missing-data behavior with tests. It should not require replacing authentication, the parent Check-In model, or the overlay architecture.
