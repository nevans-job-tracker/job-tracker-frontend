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

## 3. Deploy on your Linux machine

You just need something to serve the static `dist/` folder. Two easy options:

### Option A: nginx

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
