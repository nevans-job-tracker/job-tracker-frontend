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

You just need something to serve the static `dist/` folder — **with SPA fallback**.

The app uses client-side routing, so a direct request for `/applications/10`
(a bookmark, a refresh, or a shared link) asks the server for a path that has no
file on disk. Unknown paths must be rewritten to `index.html`, or deep links
404 in production while working perfectly in the dev server. Both options below
already do this; don't drop it if you swap in something else.

### Option A: nginx

The `try_files $uri /index.html;` line below is what provides the SPA fallback.

```nginx
server {
    listen 80;
    server_name your-machine-hostname-or-ip;

    root /opt/job-tracker-frontend/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }
}
```

Build, copy `dist/` to `/opt/job-tracker-frontend/dist`, reload nginx.

### Option B: `serve` (no nginx needed)

The `-s` flag is what provides the SPA fallback.

```bash
npm install -g serve
serve -s dist -l 5173
```

Wrap that in a systemd unit if you want it to survive reboots:

```ini
[Unit]
Description=Job Tracker frontend
After=network.target

[Service]
WorkingDirectory=/opt/job-tracker-frontend
ExecStart=/usr/bin/serve -s dist -l 5173
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## 4. Remember

Whatever origin this ends up served from (e.g. `http://192.168.1.50` or
`http://192.168.1.50:5173`), add it to `CORS_ORIGINS` in the backend's `.env`.
