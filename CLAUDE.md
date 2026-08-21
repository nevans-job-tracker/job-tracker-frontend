# job-tracker-frontend — Project Context

React (Vite) single-page app for the Job Tracker project. This file covers
**frontend-specific** decisions only.

## Shared documentation

Project-wide architecture and functional requirements live in the
`job-tracker-docs` repo, included here as a submodule at `docs/`:

@docs/ARCHITECTURE.md
@docs/REQUIREMENTS.md

`REQUIREMENTS.md` is the authority where it overlaps with anything else.

**Do not edit files under `docs/` from this repo** — it is a detached-HEAD
snapshot of another repo, so edits made here are easy to lose. Edit them in
`job-tracker-docs`, then bump the pointer:

```bash
git submodule update --remote docs && git commit -am "Bump docs" && git push
```

If `docs/` is empty after cloning, run `git submodule update --init`.

## Frontend design choices

- Vite + plain React (no framework like Next.js — not needed for a small
  internal tool).
- Talks to backend via `VITE_API_URL`.
- **Routed, multi-screen app** — list (`/`), application detail
  (`/applications/:id`), and new entry (`/applications/new`), via
  `react-router-dom`. This *reverses* the original "no routing library,
  everything is one page" decision: each application needs its own URL so the
  browser back button works correctly on mobile and so records are bookmarkable.
- The detail screen *is* the edit form rather than a read view with a separate
  edit mode, and the new-entry screen is the same component with no initial
  values.
- The list is a sortable, searchable, filterable table. Column visibility is
  responsive — see `REQUIREMENTS.md` §4.2.
- **`STATUS_LABELS` in `StatusBadge.jsx` is the only place a status is spelled
  for a human** (KAN-34). Both dropdowns and the badge read it, and its
  declaration order is the order the dropdowns offer — which is why
  `interested` leads even though the database appends it.
- **On a new record the status follows the date until the user picks one**
  (KAN-31): clearing Date applied shows Interested, entering one shows Applied.
  This mirrors the API's own rule rather than duplicating it. The form always
  sends a status, so without it the select would read Applied while an undated
  record is anything but.
- **Mobile matters.** The app is used from a phone on the LAN, so responsive
  layout is a requirement, not a nicety.

## Deployment

**Decided (KAN-20): nginx serves `dist/` and proxies `/api/` to the backend on
`127.0.0.1:8000`** — one origin for both. See `docs/ARCHITECTURE.md`.

Two consequences for this repo:

- **`VITE_API_URL=/api`** in the deployed build — a relative path. Vite inlines
  it at build time, so an absolute origin would bake the server's IP into the
  bundle and an address change would mean rebuilding. `/api` does not.
  Unset in development, where it falls back to `http://localhost:8000`.
- **Client-side routing needs the static server to rewrite unknown paths to
  `index.html`**, or deep links like `/applications/10` 404 in production while
  working fine in the dev server. nginx does this with
  `try_files $uri $uri/ /index.html`. Clicking around will not catch a
  regression here — only a cold load of a deep URL will.

## Testing

```bash
npm test      # 170 tests, 99% statements, 100% functions
```
