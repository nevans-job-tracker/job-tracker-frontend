# Job Tracker — Frontend (React + Vite)

Talks to the [job-tracker-backend](../job-tracker-backend) FastAPI API.

## 1. Local setup

```bash
npm install
cp .env.example .env
# edit .env to point at your backend, e.g. VITE_API_URL=http://localhost:8000
npm run dev
```

App runs at http://localhost:5173 by default.

## 2. Build for production

```bash
npm run build
```

Outputs static files to `dist/`.

## 3. Tests

```bash
npm test          # single run, with coverage
npm run test:watch
```

Vitest + Testing Library, running in jsdom. Covers routing, the API client, both
page components (URL state, pagination, create/save/delete flows), the list
table, the application form, and the contacts editor.

Every run writes two browsable reports:

- `coverage/index.html` — line-by-line coverage
- `test-results/index.html` — which tests ran and passed

Both are generated output, and both are gitignored.

137 tests: 99% of statements and 100% of functions.

Function coverage is worth holding at 100%. Most of the handlers here are
inline arrows that pass a field name to a shared helper — the helper is well
covered, so a mistyped name is invisible to every other test, and the value it
writes is silently dropped on save. The parametrised wiring tests in
`ApplicationForm`, `ApplicationList`, and `ContactsEditor` exist to pin those
strings; a drop below 100% usually means a new field arrived without one.

## 4. Deploy on your Linux machine

**nginx serves `dist/` and proxies the API on the same origin** — decided in
KAN-20, with the reasoning in `docs/ARCHITECTURE.md`. The `serve` package is
not used; nginx covers both jobs and Node stays a build-time dependency only.

Build with the API path set to a **relative** `/api`:

```bash
VITE_API_URL=/api npm run build
```

Vite inlines env vars at build time. An absolute origin here would bake the
server's IP into the bundle, so changing the machine's address would mean
rebuilding — `/api` avoids that entirely.

Copy `dist/` to `/opt/job-tracker-frontend/dist`, then:

```nginx
server {
    listen 80;
    server_name your-machine-hostname-or-ip;

    root /opt/job-tracker-frontend/dist;
    index index.html;

    # SPA fallback. Client-side routing means a cold request for
    # /applications/10 — a bookmark, a refresh, a shared link — asks for a path
    # with no file on disk. Without this, deep links 404 in production while
    # working perfectly in the dev server.
    location / {
        try_files $uri $uri/ /index.html;
    }

    # The trailing slash on proxy_pass strips the /api prefix, so
    # /api/applications reaches the backend as /applications and the FastAPI
    # routes need no root_path.
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Reload nginx. The backend listens on `127.0.0.1:8000` and is not reachable from
the LAN except through here.

### Verifying the fallback

Clicking from the list to a detail screen proves nothing — the router handles
that in the browser and no request is made. Test it cold:

- paste `/applications/<id>` into a fresh tab
- reload while on a detail screen
- open a detail URL from a bookmark

All three must render the app rather than a 404.

## 5. CORS

**Not needed for the deployed setup.** Everything is same-origin behind nginx,
so `CORS_ORIGINS` is not exercised.

It still applies in development, where Vite serves on `:5173` and the API
answers on `:8000` — two origins. The backend's default already covers that.
