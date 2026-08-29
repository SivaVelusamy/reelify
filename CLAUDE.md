# CLAUDE.md - Reelify Project Rules

> Project-specific rules for Claude Code. This file is read automatically.

---

## Project Overview

**Project Name:** Reelify
**Description:** Turn any long video into short, share-ready clips — without losing the story.
Ingests long-form video (upload or YouTube URL), transcribes and analyzes it, and produces
ranked, caption-ready vertical clips that editors refine and publish.
**Target User:** Corporate L&D and internal communications teams.

**Tech Stack:**
- Backend: FastAPI + Python 3.11+
- Frontend: React + Vite + TypeScript
- Database: PostgreSQL + SQLAlchemy
- Auth: Email/Password (JWT access + refresh)
- UI: Tailwind CSS + shadcn/ui + Framer Motion
- Payments: Stripe
- Media: S3-compatible object storage
- Async: Redis + worker queue (Celery or RQ) for the processing pipeline and publish scheduler

---

## Project Structure

```
reelify/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── token.py
│   │   │   ├── project.py
│   │   │   ├── source_video.py
│   │   │   ├── transcript.py
│   │   │   ├── clip.py
│   │   │   ├── caption.py
│   │   │   ├── export.py
│   │   │   ├── tag.py
│   │   │   ├── brand_kit.py
│   │   │   ├── caption_preset.py
│   │   │   ├── social_account.py
│   │   │   ├── publish_job.py
│   │   │   ├── share_link.py
│   │   │   ├── subscription.py
│   │   │   └── usage_record.py
│   │   ├── schemas/
│   │   ├── routers/
│   │   ├── services/
│   │   │   ├── pipeline/        # transcribe, analyze, clip, render
│   │   │   ├── storage.py       # signed URLs, uploads
│   │   │   ├── billing.py       # Stripe
│   │   │   └── publishing/      # per-platform publish adapters
│   │   ├── workers/             # queue tasks + scheduler
│   │   └── auth/
│   ├── alembic/
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── context/
│   │   └── types/
│   └── package.json
├── .claude/commands/
├── skills/
├── agents/
└── PRPs/
```

---

## Code Standards

### Python (Backend)
```python
# ALWAYS use type hints
def get_clip(db: Session, clip_id: int) -> Clip:
    ...

# ALWAYS add docstrings for public service functions
def create_clip(db: Session, data: ClipCreate) -> Clip:
    """
    Create a new clip.

    Args:
        db: Database session
        data: Clip creation data

    Returns:
        Created Clip object
    """
    ...

# Async endpoints
@router.get("/clips/{clip_id}")
async def get_clip(clip_id: int, db: Session = Depends(get_db)):
    ...
```

### TypeScript (Frontend)
```typescript
// ALWAYS define interfaces for props and data - NO any types
interface Clip {
  id: number;
  sourceVideoId: number;
  title: string;
  startSeconds: number;
  endSeconds: number;
  score: number;
  status: "suggested" | "draft" | "rendered" | "archived";
  aspectRatio: "9:16" | "1:1" | "16:9";
}

const fetchClip = async (id: number): Promise<Clip> => { ... };
```

---

## Forbidden Patterns

### Backend
- ❌ Never use `print()` — use the `logging` module
- ❌ Never store passwords in plain text — use bcrypt
- ❌ Never hardcode secrets — use environment variables
- ❌ Never use `SELECT *` — specify columns
- ❌ Never skip input validation — every endpoint takes a Pydantic schema
- ❌ Never run transcription / rendering / publishing synchronously in a request — enqueue a job
- ❌ Never store third-party OAuth tokens unencrypted

### Frontend
- ❌ Never use the `any` type
- ❌ Never leave `console.log` in production
- ❌ Never skip error handling in async operations
- ❌ Never use inline styles — use Tailwind utilities / shadcn components

---

## Module-Specific Rules

### Ownership
- Every Project, SourceVideo, Clip, BrandKit, SocialAccount, PublishJob, and Subscription
  belongs to a user via `user_id`. Every query is scoped to the current user
  (except `/admin/*` and public share-link routes).

### Projects / Uploads
- `SourceVideo.status` must be one of:
  `queued | transcribing | analyzing | clipping | ready | failed`.
- A `failed` video must carry a human-readable `error_message` and support `POST /videos/{id}/reprocess`.
- Uploads validate MIME type and size before accepting; YouTube URL imports validate the URL host.

### Clips
- `Clip.aspect_ratio` ∈ `9:16 | 1:1 | 16:9`; `Clip.status` ∈ `suggested | draft | rendered | archived`.
- `start_seconds < end_seconds` and both within the source duration.
- AI-suggested clips are created with `status = "suggested"`; user edits promote them to `draft`.
- Rendering and export always go through a worker job; the endpoint returns a job id.

### Brand Kit
- Exactly one `BrandKit` per user may have `is_default = true`.
- Caption style presets belong to a brand kit; deleting a kit soft-detaches presets, never clips already rendered.

### Publishing
- Every OAuth connect flow verifies the `state` parameter.
- `PublishJob.status` ∈ `draft | scheduled | publishing | published | failed`.
- Scheduled jobs run via the scheduler worker; a job may only be edited/cancelled while `draft` or `scheduled`.
- Per-platform caption length limits are validated before scheduling.

### Billing
- Stripe webhooks verify the signature and are idempotent by event id.
- Processing is blocked when the user's period usage exceeds their plan limit — return `402`/`403` with a clear message.

### Admin
- All `/api/v1/admin/*` routes require `is_admin`; non-admins get `403`.

---

## API Conventions

- All endpoints prefixed with `/api/v1/`
- Plural nouns for resources: `/projects`, `/clips`, `/brand-kits`, `/publish-jobs`
- HTTP status codes: 200 OK, 201 Created, 202 Accepted (job enqueued), 400 Bad Request,
  401 Unauthorized, 402 Payment Required (over limit), 403 Forbidden, 404 Not Found, 409 Conflict
- Long-running actions return `202` with a job resource; clients poll `GET /.../{id}/status`
- Media is served via signed, time-limited URLs — never stream bytes through the API

---

## Authentication

### JWT Configuration
- Access token expires: 30 minutes
- Refresh token expires: 7 days
- Algorithm: HS256
- Refresh tokens are stored hashed and can be revoked (logout)
- Password reset via single-use, time-limited emailed token
- Rate limit: login, register, forgot-password

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/reelify

# Auth
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Redis / workers
REDIS_URL=redis://localhost:6379/0

# Object storage (S3-compatible)
STORAGE_ENDPOINT=https://s3.amazonaws.com
STORAGE_BUCKET=reelify-media
STORAGE_ACCESS_KEY=xxx
STORAGE_SECRET_KEY=xxx
SIGNED_URL_TTL_SECONDS=3600

# Transcription
TRANSCRIPTION_API_KEY=xxx

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_STARTER=price_...
STRIPE_PRICE_ID_PRO=price_...

# Email
EMAIL_API_KEY=xxx
EMAIL_FROM=notifications@reelify.app

# Social publishing OAuth
TIKTOK_CLIENT_KEY=xxx
TIKTOK_CLIENT_SECRET=xxx
INSTAGRAM_CLIENT_ID=xxx
INSTAGRAM_CLIENT_SECRET=xxx
YOUTUBE_CLIENT_ID=xxx
YOUTUBE_CLIENT_SECRET=xxx
OAUTH_TOKEN_ENCRYPTION_KEY=xxx
OAUTH_REDIRECT_BASE_URL=http://localhost:8000/api/v1/social-accounts/callback

# Frontend
VITE_API_URL=http://localhost:8000
```

---

## Development Commands

```bash
# Backend
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# Worker + scheduler
celery -A app.workers worker --loglevel=info
celery -A app.workers beat --loglevel=info

# Frontend
cd frontend
npm install
npm run dev

# Docker
docker-compose up -d

# Tests
pytest backend/tests -v
cd frontend && npm test

# Linting / types
ruff check backend/ && pytest
cd frontend && npm run lint && npm run type-check
```

---

## Commit Message Format

```
feat(clips): add manual trim endpoint
fix(uploads): handle youtube url import failure
refactor(publishing): extract per-platform adapter
test(billing): add stripe webhook idempotency tests
docs: update INITIAL.md
```

---

## Skills Reference

| Task | Skill to Read |
|------|---------------|
| Database models | skills/DATABASE.md |
| API + Auth | skills/BACKEND.md |
| React + UI | skills/FRONTEND.md |
| Testing | skills/TESTING.md |
| Deployment | skills/DEPLOYMENT.md |

---

## Agent Coordination

| Agent | Role |
|-------|------|
| DATABASE-AGENT | Models + migrations |
| BACKEND-AGENT | API, services, pipeline, publishing adapters |
| FRONTEND-AGENT | UI pages + components |
| DEVOPS-AGENT | Docker, Redis/worker, storage, CI/CD |
| TEST-AGENT | Unit + integration tests |
| REVIEW-AGENT | Security + code quality audit |

Read agent definitions in `/agents/`.

---

## Validation

```bash
ruff check backend/ && pytest
npm run lint && npm run type-check
docker-compose build
```
