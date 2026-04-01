# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project overview
- Primary app: SvelteKit (Svelte 5, TypeScript, Vite 6) in the repository root
- Supporting components:
  - scripts/: ad‑hoc Node utilities for Amazon SP-API, data import/verification
  - render-service/: Node service intended for background/Render deployment (buy box monitoring)
  - chrome-extension/: Chrome extension for Buy Box page previews alongside the app UI

Common commands (root SvelteKit app)
- Install dependencies
  ```bash path=null start=null
  npm install
  ```
- Dev server (port 3000)
  ```bash path=null start=null
  npm run dev
  # open a browser automatically
  npm run dev -- --open
  ```
- Build and preview
  ```bash path=null start=null
  npm run build
  npm run preview
  ```
- Type checks (Svelte + TS)
  ```bash path=null start=null
  npm run check
  # watch mode
  npm run check:watch
  ```
- Lint and format
  ```bash path=null start=null
  npm run lint      # prettier --check . && eslint .
  npm run format    # prettier --write .
  ```

Ad‑hoc scripts and service commands
- scripts/ utilities (run individually)
  ```bash path=null start=null
  # examples (adjust args/paths as needed)
  node scripts/test-amazon-spapi.js
  node scripts/test-pricing-api.js
  node scripts/check-database.js
  node scripts/csv-to-json.js input.csv output.json
  ```
- render-service/ (independent Node service)
  ```bash path=null start=null
  # install once inside the folder
  (cd render-service && npm install)
  # start (uses main=server.js)
  (cd render-service && npm run dev)
  ```

About tests in this repo
- There is a Jest‑style test file at src/lib/services/__tests__/significance-fixes.test.ts, but no test runner is currently configured in the root package.json or devDependencies.
- If you want to run that single test quickly with Vitest (Jest‑compatible APIs), install and run on demand:
  ```bash path=null start=null
  npm i -D vitest @vitest/ui @vitest/coverage-v8 jsdom
  npx vitest run src/lib/services/__tests__/significance-fixes.test.ts
  # or interactive: npx vitest src/lib/services/__tests__/significance-fixes.test.ts
  ```
- Alternatively, keep using the ad‑hoc Node scripts in scripts/ for integration checks as shown above.

Environment and configuration
- Vite SSR build configuration externalizes some modules and keeps others bundled:
  - noExternal: ['openai']
  - external: ['@prisma/client', 'crypto', 'aws4']
- Important environment variables (set via .env for local dev and Vite/SvelteKit envs):
  - PUBLIC_SUPABASE_URL
  - PUBLIC_SUPABASE_ANON_KEY
  - PRIVATE_SUPABASE_SERVICE_KEY (server‑only, optional; enables admin operations)
  - OPENAI_API_KEY (used at runtime in API routes)
  - AMAZON_CLIENT_ID and AMAZON_CLIENT_SECRET (for Amazon OAuth at /api/amazon/oauth/*)
- Local .env loading: src/lib/loadEnv.js can load a .env file at project root at runtime (if imported by a module).

High‑level architecture
- SvelteKit app (root)
  - UI routes in src/routes/ with +page.svelte files for major features:
    - dashboards (analytics, sales, inventory, buy-box, scheduling, etc.)
    - authentication flows under routes/auth and server endpoints under routes/api
  - API endpoints live alongside routes under src/routes/api/** using +server.ts files. Examples include:
    - Amazon OAuth: /api/amazon/oauth/authorize and /api/amazon/oauth/callback (uses AMAZON_CLIENT_ID/SECRET)
    - Buy box monitoring, data import/export, inventory, pricing endpoints, and various test/debug endpoints
  - Server middleware and auth:
    - src/hooks.server.ts configures Supabase (browser and admin contexts), route protection groups, helper methods on event.locals (getSession, getUserWithProfile), and logs/access control
    - src/lib/supabaseClient.ts and src/lib/supabaseServer.ts provide browser/server clients; server variant exports supabaseAdmin when a service key is available
  - Domain services live in src/lib/services/** (business logic)
    - Examples: significance analyzers (legacy and enhanced), pricing/inventory services, Amazon import service, data loaders, PDF export, and Microsoft Graph/Linnworks integrations
  - Shared libraries
    - src/lib/utils, stores, types, shadcn components, and charts compose the UI behavior and type system
  - Tooling
    - Vite 6 + @sveltejs/kit plugin; Prettier with Svelte plugin; ESLint dependencies present; Svelte Check for type-level validation

- scripts/ (utility scripts)
  - Standalone Node scripts to validate data, interact with Amazon SP-API, perform imports/exports, and run quick diagnostics
  - scripts/package.json defines a few composed scripts (import and validation), but most utilities are executed directly with node

- render-service/ (background service)
  - Node service intended for long‑running buy‑box monitoring and Render deployment
  - Service code under render-service/services/**; database utilities under render-service/utils/**

- chrome-extension/
  - Complementary Chrome extension to preview Amazon pages contextually when using the Buy Box Manager UI; developed and loaded as an unpacked extension during development

Notes for future instances of Warp
- Commands above reflect the actual scripts defined in root package.json and discovered utility/service folders
- No CLAUDE.md, Cursor rules, or Copilot instruction files were found in this repository at the time of writing
- The root README includes standard SvelteKit dev/build/preview guidance that matches the commands listed here
