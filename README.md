# arkivia-collab-todo

## Architecture overview

This repository is a production-minded monorepo for a collaborative todo application.

- **Frontend**: React + TypeScript
- **Backend**: Express + TypeScript
- **Auth/Data**: Firebase Auth + Firestore

At a high level:

- The frontend is a single-page app that authenticates users and calls backend APIs.
- The backend exposes an HTTP API and is responsible for authorization and server-side validation.
- Firestore is the system of record for application data; Firebase Auth is the identity provider.

## Project structure

Monorepo layout (npm workspaces):

```text
apps/
  frontend/           # React app (scaffold)
  backend/            # Express API (minimal /health)
packages/
  shared/             # Shared TypeScript types/utilities (scaffold)
```

Notes:

- `packages/shared` is intended to hold shared types (DTOs), validation helpers, and other utilities used by both frontend and backend.
- `apps/` contains runnable applications.

## Security model (draft)

This section is a draft and will evolve as implementation lands.

- **Identity**
  - Users authenticate via Firebase Auth.
  - The backend should verify Firebase ID tokens on every authenticated request.

- **Authorization**
  - Authorization is enforced server-side (backend), based on the authenticated user identity.
  - Firestore security rules should be treated as a second layer of defense, not the only enforcement point.

- **Data access boundaries**
  - Prefer a backend-mediated access model for sensitive operations.
  - Minimize client direct writes where it complicates authorization, auditing, or validation.

- **Secrets/config**
  - No secrets are committed to the repo.
  - Environment variables are used for configuration.
  - Separate configs per environment (local/dev/staging/prod).

## Local setup

Prerequisites:

- Node.js (LTS recommended)
- npm (workspaces enabled)

Install dependencies:

```bash
npm install
```

Typecheck all workspaces:

```bash
npm run typecheck
```

Build all workspaces:

```bash
npm run build
```

Firebase (local emulators):

```bash
firebase emulators:start
```

Firebase Hosting note:

- Hosting is configured with `public: apps/frontend/dist`.
- Once the frontend build tooling is added and it outputs to `apps/frontend/dist`, you can deploy with:

```bash
firebase deploy
```

Next steps (not included in the current scaffold):

- Add frontend build tooling (e.g. Vite) and dev scripts.
- Add backend dev runner (e.g. tsx) and a minimal server entrypoint.
- Add Firebase project configuration for local development.