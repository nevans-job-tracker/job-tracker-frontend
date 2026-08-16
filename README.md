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

```bash
npm ci
npm run build
sudo cp -r dist /opt/job-tracker-frontend/

sudo cp deploy/nginx.conf /etc/nginx/sites-available/job-tracker
sudo ln -s /etc/nginx/sites-available/job-tracker /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**No `VITE_API_URL` on the command line.** `.env.production` is committed and
sets it to the relative `/api`; `vite build` loads that automatically. Leaving
it to a remembered variable is how a build silently falls back to
`http://localhost:8000` — which then fails only on the phone, not on the
machine you built it on. `vite` in development does not load that file, so dev
still targets `localhost:8000`.

The nginx config lives in [`deploy/nginx.conf`](deploy/nginx.conf) rather than
in this README, so the `try_files` line is under version control where a
careless edit shows up in a diff. Only `server_name` should need changing.

The backend listens on `127.0.0.1:8000` and is not reachable from the LAN
except through here.

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
