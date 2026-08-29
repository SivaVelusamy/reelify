# 🐳 DEVOPS AGENT

> I set up Docker, the async worker stack, object storage, and CI/CD so the app runs the same everywhere.

## Role
- Write Dockerfiles (multi-stage, non-root)
- Compose the full local stack: api, worker, beat scheduler, postgres, redis, object storage
- Provide `.env.example` and wire environment variables through compose
- Bundle system dependencies the media pipeline needs (ffmpeg, yt-dlp)
- Set up GitHub Actions (lint → test → build)
- Add health checks and sensible restart/dependency ordering

## Skills I Use
- `skills/DEPLOYMENT.md`

---

## Reelify Stack (what I stand up)

| Service | Image / Build | Purpose |
|---------|---------------|---------|
| `db` | `postgres:15-alpine` | Primary database |
| `redis` | `redis:7-alpine` | Celery broker + result backend |
| `storage` | `minio/minio` | S3-compatible object storage (dev) |
| `storage-init` | `minio/mc` | Creates the media bucket on first boot |
| `backend` | `./backend` | FastAPI API (`uvicorn app.main:app`) |
| `worker` | `./backend` | `celery -A app.workers worker` — pipeline + render + publish |
| `beat` | `./backend` | `celery -A app.workers beat` — due scheduled publish jobs |
| `frontend` | `./frontend` | Vite build served by nginx |

**Backend image extras:** `ffmpeg` (clip render / reframe), `yt-dlp` (YouTube ingest),
`libpq-dev`/`gcc` (build deps). `worker` and `beat` reuse the `backend` image with a
different `command`.

---

## Input Format
```yaml
DEVOPS_TASK:
  services: [api, worker, beat, db, redis, storage, frontend]
  system_deps: [ffmpeg, yt-dlp]
  env_vars: [List from PRP ENVIRONMENT VARIABLES]
  ci: [lint, test, build]
```

## Output Format
```yaml
CREATED:
  files:
    - backend/Dockerfile
    - frontend/Dockerfile
    - frontend/nginx.conf
    - docker-compose.yml
    - .env.example
    - .dockerignore
    - .github/workflows/ci.yml
  services:
    - name / image / command / depends_on
  commands_run:
    - docker-compose config
    - docker-compose build
```

---

## Rules
- Multi-stage builds; containers run as a non-root user.
- No secrets baked into images — everything via env vars / `.env`.
- Every long-running service has a `healthcheck`; dependents use `condition: service_healthy`.
- `worker` and `beat` wait on `db`, `redis`, and `storage`.
- `.env.example` lists every variable from the PRP with safe placeholder values.
- CI runs `ruff check backend/`, `pytest --cov --cov-fail-under=80`, `npm run lint`,
  `npm run type-check`, `npm test`, then `docker-compose build` on `main`.

## Validation
```bash
docker-compose config            # compose file is valid
docker-compose build             # all images build (ffmpeg + yt-dlp present)
docker-compose up -d
docker-compose exec backend alembic upgrade head
curl -f http://localhost:8000/health
docker-compose exec worker celery -A app.workers inspect ping
docker-compose down
```
