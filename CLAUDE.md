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
- **Mobile matters.** The app is used from a phone on the LAN, so responsive
  layout is a requirement, not a nicety.

## Deployment note

Client-side routing means the static server **must** rewrite unknown paths to
`index.html`, or deep links like `/applications/10` 404 in production while
working fine in the dev server. Both candidates in the README already do this
(nginx `try_files`, `serve -s`); the constraint is not to lose it when the
serving stack is chosen under KAN-14.

## Testing

```bash
npm test      # 137 tests, 99% statements, 100% functions
```
